"""
File uploads routes for Hireabble API — Supabase Storage
Includes media tracking and automatic content moderation.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import RedirectResponse
from supabase import create_client
from datetime import datetime, timezone
import uuid
import os
import io
import re

from database import (
    db, get_current_user, SUPABASE_URL, SUPABASE_KEY, UPLOADS_DIR, logger
)

router = APIRouter(tags=["Uploads"])

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB

PHOTO_BUCKET = "photos"
VIDEO_BUCKET = "videos"

# Whether Supabase storage is configured
_USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)


def _get_supabase():
    if not _USE_SUPABASE:
        raise HTTPException(status_code=500, detail="Storage not configured")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _public_url(bucket: str, path: str) -> str:
    """Build the public URL for a stored object."""
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


def _save_local(subdir: str, filename: str, contents: bytes) -> str:
    """Save file to local uploads directory, return relative URL path."""
    target_dir = UPLOADS_DIR / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    filepath = target_dir / filename
    filepath.write_bytes(contents)
    return f"/uploads/{subdir}/{filename}"


def _analyze_image(contents: bytes) -> dict:
    """
    Basic image analysis for content moderation.
    Returns a dict with analysis results and whether to auto-flag.
    Uses PIL to check image properties. Falls back gracefully if PIL unavailable.
    """
    result = {"flagged": False, "reasons": [], "analysis": {}}

    try:
        from PIL import Image
        img = Image.open(io.BytesIO(contents))
        result["analysis"]["width"] = img.width
        result["analysis"]["height"] = img.height
        result["analysis"]["format"] = img.format

        # Flag suspiciously small images (likely spam/placeholder)
        if img.width < 10 or img.height < 10:
            result["flagged"] = True
            result["reasons"].append("Suspiciously small image dimensions")

        # Flag very large images that might be trying to exploit the system
        if img.width > 8000 or img.height > 8000:
            result["flagged"] = True
            result["reasons"].append("Extremely large image dimensions")

        # Check for animated GIFs (often used for inappropriate content)
        if img.format == "GIF":
            try:
                img.seek(1)
                result["analysis"]["animated"] = True
                # Animated GIFs get flagged for review (common vector for inappropriate content)
                result["flagged"] = True
                result["reasons"].append("Animated GIF - requires manual review")
            except EOFError:
                result["analysis"]["animated"] = False

        # Skin-tone pixel ratio analysis (basic NSFW heuristic)
        # This is a lightweight check - not a replacement for ML-based moderation
        if img.mode in ("RGB", "RGBA") and img.format != "GIF":
            try:
                # Sample a subset of pixels for performance
                small = img.resize((100, 100))
                pixels = list(small.getdata())
                skin_count = 0
                for pixel in pixels:
                    r, g, b = pixel[0], pixel[1], pixel[2]
                    # Skin tone detection heuristic
                    if (r > 95 and g > 40 and b > 20 and
                        max(r, g, b) - min(r, g, b) > 15 and
                        abs(r - g) > 15 and r > g and r > b):
                        skin_count += 1
                skin_ratio = skin_count / len(pixels)
                result["analysis"]["skin_ratio"] = round(skin_ratio, 3)
                # High skin-tone ratio flags for review
                if skin_ratio > 0.6:
                    result["flagged"] = True
                    result["reasons"].append(f"High skin-tone ratio ({skin_ratio:.0%}) - flagged for review")
            except Exception:
                pass

    except ImportError:
        # PIL not available - skip analysis, don't flag
        result["analysis"]["note"] = "PIL not installed - image analysis skipped"
    except Exception as e:
        logger.warning(f"Image analysis failed: {e}")
        result["analysis"]["error"] = str(e)

    return result


async def _track_upload(user_id: str, user_name: str, media_type: str, category: str,
                        url: str, filename: str, file_size: int, content_type: str,
                        analysis: dict = None):
    """Track upload in media_uploads collection and auto-flag to moderation if needed."""
    flagged = analysis.get("flagged", False) if analysis else False
    reasons = analysis.get("reasons", []) if analysis else []

    upload_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "media_type": media_type,  # 'image' or 'video'
        "category": category,       # 'profile_photo', 'video_intro', 'chat_image', 'chat_video'
        "url": url,
        "filename": filename,
        "file_size": file_size,
        "content_type": content_type,
        "status": "flagged" if flagged else "approved",  # auto-approve clean uploads
        "flagged": flagged,
        "flag_reasons": reasons,
        "analysis": analysis.get("analysis", {}) if analysis else {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    await db.media_uploads.insert_one(upload_doc)

    # If flagged, also add to the moderation queue
    if flagged:
        mod_doc = {
            "id": str(uuid.uuid4()),
            "content_type": "media",
            "content_id": upload_doc["id"],
            "user_id": user_id,
            "status": "pending",
            "violations": [{"category": "image_moderation", "word": r, "severity": "critical"} for r in reasons],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "media_url": url,
                "media_category": category,
                "filename": filename,
            }
        }
        await db.moderation_queue.insert_one(mod_doc)
        logger.warning(f"Media flagged for review: {filename} by user {user_id} - {reasons}")

    return upload_doc["id"]


@router.post("/upload/photo")
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile photo (Supabase Storage or local fallback)"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    # Analyze image content
    analysis = _analyze_image(contents)

    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"

    if _USE_SUPABASE:
        supabase = _get_supabase()

        # Remove old photo if it exists in the bucket
        user = await db.users.find_one({"id": current_user["id"]})
        if user and user.get("photo_url") and SUPABASE_URL in (user.get("photo_url") or ""):
            old_path = user["photo_url"].split(f"/{PHOTO_BUCKET}/")[-1]
            try:
                supabase.storage.from_(PHOTO_BUCKET).remove([old_path])
            except Exception:
                pass

        try:
            supabase.storage.from_(PHOTO_BUCKET).upload(
                filename,
                contents,
                file_options={"content-type": file.content_type}
            )
        except Exception as e:
            logger.error(f"Supabase upload failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload photo")

        photo_url = _public_url(PHOTO_BUCKET, filename)
    else:
        # Local fallback
        photo_url = _save_local("photos", filename, contents)

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"photo_url": photo_url}}
    )

    # Track upload
    await _track_upload(
        user_id=current_user["id"],
        user_name=current_user.get("name", "Unknown"),
        media_type="image",
        category="profile_photo",
        url=photo_url,
        filename=filename,
        file_size=len(contents),
        content_type=file.content_type,
        analysis=analysis
    )

    logger.info(f"Photo uploaded for user {current_user['id']}: {filename}")
    return {"photo_url": photo_url, "filename": filename}


@router.post("/upload/video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a video introduction to Supabase Storage"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can upload video intros")

    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Only video files (MP4, WebM, MOV) are allowed")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Video size exceeds 50MB limit")

    ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp4'
    filename = f"video_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"

    if _USE_SUPABASE:
        supabase = _get_supabase()

        user = await db.users.find_one({"id": current_user["id"]})
        if user and user.get("video_url") and SUPABASE_URL in (user.get("video_url") or ""):
            old_path = user["video_url"].split(f"/{VIDEO_BUCKET}/")[-1]
            try:
                supabase.storage.from_(VIDEO_BUCKET).remove([old_path])
            except Exception:
                pass

        try:
            supabase.storage.from_(VIDEO_BUCKET).upload(
                filename,
                contents,
                file_options={"content-type": file.content_type}
            )
        except Exception as e:
            logger.error(f"Supabase video upload failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload video")

        video_url = _public_url(VIDEO_BUCKET, filename)
    else:
        video_url = _save_local("videos", filename, contents)

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"video_url": video_url}}
    )

    # Track upload (no image analysis for video — flagged for manual review by default if needed)
    await _track_upload(
        user_id=current_user["id"],
        user_name=current_user.get("name", "Unknown"),
        media_type="video",
        category="video_intro",
        url=video_url,
        filename=filename,
        file_size=len(contents),
        content_type=file.content_type,
    )

    logger.info(f"Video uploaded for user {current_user['id']}: {filename}")
    return {"video_url": video_url, "filename": filename}


@router.delete("/upload/video")
async def delete_video(current_user: dict = Depends(get_current_user)):
    """Delete video introduction from Supabase Storage"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can manage video intros")

    user = await db.users.find_one({"id": current_user["id"]})
    if user and user.get("video_url"):
        # Delete from Supabase if it's a Supabase URL
        if SUPABASE_URL and SUPABASE_URL in (user.get("video_url") or ""):
            old_path = user["video_url"].split(f"/{VIDEO_BUCKET}/")[-1]
            try:
                supabase = _get_supabase()
                supabase.storage.from_(VIDEO_BUCKET).remove([old_path])
            except Exception:
                pass

        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"video_url": None}}
        )

        # Mark in media_uploads as removed
        await db.media_uploads.update_many(
            {"user_id": current_user["id"], "category": "video_intro"},
            {"$set": {"status": "removed", "reviewed_at": datetime.now(timezone.utc).isoformat()}}
        )

        logger.info(f"Video deleted for user {current_user['id']}")

    return {"message": "Video deleted successfully"}


@router.post("/upload/chat-image")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image for chat messages"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image size exceeds 5MB limit")

    # Analyze image content
    analysis = _analyze_image(contents)

    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"chat_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"

    if _USE_SUPABASE:
        supabase = _get_supabase()
        try:
            supabase.storage.from_(PHOTO_BUCKET).upload(
                filename,
                contents,
                file_options={"content-type": file.content_type}
            )
        except Exception as e:
            logger.error(f"Supabase chat image upload failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload image")
        image_url = _public_url(PHOTO_BUCKET, filename)
    else:
        image_url = _save_local("photos", filename, contents)

    # Track upload
    await _track_upload(
        user_id=current_user["id"],
        user_name=current_user.get("name", "Unknown"),
        media_type="image",
        category="chat_image",
        url=image_url,
        filename=filename,
        file_size=len(contents),
        content_type=file.content_type,
        analysis=analysis
    )

    logger.info(f"Chat image uploaded by user {current_user['id']}: {filename}")
    return {"url": image_url, "filename": filename}


@router.post("/upload/chat-video")
async def upload_chat_video(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a video message for chat"""
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Only video files (MP4, WebM, MOV) are allowed")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Video size exceeds 50MB limit")

    ext = file.filename.split('.')[-1] if '.' in file.filename else 'webm'
    filename = f"chat_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"

    if _USE_SUPABASE:
        supabase = _get_supabase()
        try:
            supabase.storage.from_(VIDEO_BUCKET).upload(
                filename,
                contents,
                file_options={"content-type": file.content_type}
            )
        except Exception as e:
            logger.error(f"Supabase chat video upload failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload video")
        video_url = _public_url(VIDEO_BUCKET, filename)
    else:
        video_url = _save_local("videos", filename, contents)

    # Track upload
    await _track_upload(
        user_id=current_user["id"],
        user_name=current_user.get("name", "Unknown"),
        media_type="video",
        category="chat_video",
        url=video_url,
        filename=filename,
        file_size=len(contents),
        content_type=file.content_type,
    )

    logger.info(f"Chat video uploaded by user {current_user['id']}: {filename}")
    return {"url": video_url, "filename": filename}


# ==================== RESUME PARSING ====================

MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_RESUME_TYPES = ["application/pdf"]

def _parse_resume_text(text: str) -> dict:
    """Extract structured data from resume text using pattern matching."""
    result = {
        "name": None,
        "title": None,
        "email": None,
        "phone": None,
        "location": None,
        "skills": [],
        "work_history": [],
        "education": [],
        "certifications": [],
        "bio": None,
    }

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return result

    # Extract email
    email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
    if email_match:
        result["email"] = email_match.group(0)

    # Extract phone
    phone_match = re.search(r'[\+]?[\d\s\-\(\)]{10,15}', text)
    if phone_match:
        candidate = phone_match.group(0).strip()
        digits = re.sub(r'\D', '', candidate)
        if 10 <= len(digits) <= 15:
            result["phone"] = candidate

    # Common section headers
    skill_headers = re.compile(r'(?i)^(skills|technical skills|core competencies|technologies|proficiencies|expertise|key skills)', re.MULTILINE)
    work_headers = re.compile(r'(?i)^(work experience|experience|professional experience|employment|employment history|work history)', re.MULTILINE)
    edu_headers = re.compile(r'(?i)^(education|academic|academic background|qualifications)', re.MULTILINE)
    cert_headers = re.compile(r'(?i)^(certifications?|licenses?|professional development|certificates)', re.MULTILINE)
    summary_headers = re.compile(r'(?i)^(summary|objective|profile|professional summary|about me|about|career objective)', re.MULTILINE)

    # Split text into sections
    section_pattern = re.compile(
        r'(?i)^(skills|technical skills|core competencies|technologies|proficiencies|expertise|key skills|'
        r'work experience|experience|professional experience|employment|employment history|work history|'
        r'education|academic|academic background|qualifications|'
        r'certifications?|licenses?|professional development|certificates|'
        r'summary|objective|profile|professional summary|about me|about|career objective|'
        r'projects|references|volunteer|interests|languages|awards|honors|publications)\s*[:\-]?\s*$',
        re.MULTILINE
    )

    sections = {}
    matches = list(section_pattern.finditer(text))
    for i, m in enumerate(matches):
        header = m.group(1).lower().strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[header] = text[start:end].strip()

    # Extract name - typically the first non-empty line before any section
    first_section_pos = matches[0].start() if matches else len(text)
    header_lines = [l.strip() for l in text[:first_section_pos].split('\n') if l.strip()]
    # Filter out email/phone/links from candidate name lines
    name_candidates = [l for l in header_lines[:3]
                       if not re.search(r'@|http|www\.|[\d\s\-\(\)]{10,}', l) and len(l) < 60]
    if name_candidates:
        result["name"] = name_candidates[0]
        # Second line might be a title
        if len(name_candidates) > 1:
            candidate_title = name_candidates[1]
            if len(candidate_title) < 80 and not re.search(r'@|http|[\d]{5,}', candidate_title):
                result["title"] = candidate_title

    # Location - look for city, state patterns
    location_match = re.search(
        r'(?i)([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2}(?:\s+\d{5})?)',
        text[:first_section_pos]
    )
    if location_match:
        result["location"] = re.sub(r'\s+\d{5}$', '', location_match.group(1))

    # Extract skills
    for key in sections:
        if skill_headers.match(key):
            skill_text = sections[key]
            # Skills can be comma-separated, pipe-separated, bullet-separated, or newline-separated
            skills = re.split(r'[,\|•·●■◆▪\n]+', skill_text)
            result["skills"] = [s.strip().strip('- ').strip() for s in skills
                               if s.strip() and len(s.strip()) < 50 and len(s.strip()) > 1][:30]
            break

    # Extract work history
    for key in sections:
        if work_headers.match(key):
            work_text = sections[key]
            # Try to parse individual positions
            # Look for patterns like: "Position at Company" or "Company | Position" or date ranges
            position_blocks = re.split(r'\n(?=\S)', work_text)
            for block in position_blocks:
                if not block.strip() or len(block.strip()) < 5:
                    continue
                entry = {"company": "", "position": "", "start_date": "", "end_date": "", "description": ""}
                block_lines = [l.strip() for l in block.split('\n') if l.strip()]
                if not block_lines:
                    continue

                # First line often contains position and/or company
                first_line = block_lines[0]
                # Look for date range
                date_match = re.search(
                    r'(\w+\.?\s*\d{4})\s*[-–—to]+\s*(\w+\.?\s*\d{4}|[Pp]resent|[Cc]urrent)',
                    block
                )
                if date_match:
                    entry["start_date"] = date_match.group(1).strip()
                    end = date_match.group(2).strip()
                    entry["end_date"] = "" if end.lower() in ("present", "current") else end

                # Try to find position/company from first 2 lines
                if '|' in first_line or ' at ' in first_line.lower() or ' - ' in first_line:
                    parts = re.split(r'\s*[\|–—]\s*|\s+at\s+|\s+-\s+', first_line, maxsplit=1)
                    if len(parts) == 2:
                        entry["position"] = parts[0].strip()
                        entry["company"] = re.sub(r'\s*\(?\d{4}.*$', '', parts[1]).strip()
                elif len(block_lines) >= 2:
                    entry["position"] = first_line
                    entry["company"] = re.sub(r'\s*\(?\d{4}.*$', '', block_lines[1]).strip()
                else:
                    entry["position"] = first_line

                # Description from remaining lines (bullet points)
                desc_lines = [l.strip('•·●■◆▪- ').strip() for l in block_lines[2:] if l.strip()]
                if desc_lines:
                    entry["description"] = '. '.join(desc_lines[:3])

                if entry["position"] or entry["company"]:
                    result["work_history"].append(entry)

            result["work_history"] = result["work_history"][:10]
            break

    # Extract education
    for key in sections:
        if edu_headers.match(key):
            edu_text = sections[key]
            edu_blocks = re.split(r'\n(?=\S)', edu_text)
            for block in edu_blocks:
                if not block.strip() or len(block.strip()) < 5:
                    continue
                entry = {"school": "", "degree": "", "field": "", "year": ""}
                block_lines = [l.strip() for l in block.split('\n') if l.strip()]
                if not block_lines:
                    continue

                # Look for degree patterns
                degree_match = re.search(
                    r'(?i)(Bachelor|Master|Ph\.?D|Doctor|Associate|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|M\.?B\.?A\.?|'
                    r'B\.?Sc|M\.?Sc|High School|GED|Diploma)[^,\n]*',
                    block
                )
                if degree_match:
                    degree_text = degree_match.group(0).strip()
                    # Try to split degree and field
                    field_match = re.search(r'(?i)(?:in|of)\s+(.+)', degree_text)
                    if field_match:
                        entry["field"] = field_match.group(1).strip()
                        entry["degree"] = degree_text[:field_match.start()].strip().rstrip(' in of')
                    else:
                        entry["degree"] = degree_text

                # Year
                year_match = re.search(r'20\d{2}|19\d{2}', block)
                if year_match:
                    entry["year"] = year_match.group(0)

                # School name
                for line in block_lines:
                    if degree_match and degree_match.group(0) in line:
                        continue
                    if re.search(r'(?i)(university|college|institute|school|academy)', line):
                        entry["school"] = re.sub(r'\s*[-–—|,]\s*\d{4}.*$', '', line).strip()
                        break
                if not entry["school"] and block_lines:
                    entry["school"] = re.sub(r'\s*[-–—|,]\s*\d{4}.*$', '', block_lines[0]).strip()

                if entry["school"] or entry["degree"]:
                    result["education"].append(entry)

            result["education"] = result["education"][:5]
            break

    # Extract certifications
    for key in sections:
        if cert_headers.match(key):
            cert_text = sections[key]
            certs = re.split(r'[•·●■◆▪\n]+', cert_text)
            result["certifications"] = [c.strip().strip('- ').strip() for c in certs
                                        if c.strip() and len(c.strip()) > 2][:15]
            break

    # Extract summary/bio
    for key in sections:
        if summary_headers.match(key):
            result["bio"] = sections[key][:500].strip()
            break

    return result


@router.post("/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Parse a PDF resume and return extracted profile data for autofill."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can upload resumes")

    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    if len(contents) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="Resume must be less than 10MB")

    # Extract text from PDF
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(contents))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        logger.error(f"PDF parsing failed: {e}")
        raise HTTPException(status_code=400, detail="Could not read PDF. Please ensure it is a valid, text-based PDF.")

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from this PDF. It may be a scanned image. Please try a text-based PDF."
        )

    # Parse the extracted text
    parsed = _parse_resume_text(text)

    logger.info(f"Resume parsed for user {current_user['id']}: found {len(parsed.get('work_history', []))} positions, {len(parsed.get('skills', []))} skills")
    return {"parsed": parsed, "raw_text_length": len(text)}
