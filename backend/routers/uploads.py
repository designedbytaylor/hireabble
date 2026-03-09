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
