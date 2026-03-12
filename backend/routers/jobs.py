"""
Jobs routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import asyncio
import uuid
import os
import base64
import logging
import io
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.colors import HexColor, Color

from database import (
    db, get_current_user,
    JobCreate, JobResponse
)
from content_filter import check_fields, is_severe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Jobs"])

# Job category keywords for auto-detection
CATEGORY_KEYWORDS = {
    "technology": ["software", "developer", "engineer", "programming", "frontend", "backend", "fullstack",
                   "devops", "cloud", "data", "machine learning", "ai", "python", "javascript", "react",
                   "node", "java", "golang", "rust", "ios", "android", "mobile", "web", "api", "database",
                   "cybersecurity", "security", "infrastructure", "sre", "platform"],
    "design": ["designer", "ux", "ui", "graphic", "creative", "figma", "sketch", "photoshop",
               "illustration", "brand", "visual", "product design", "interaction"],
    "marketing": ["marketing", "seo", "content", "social media", "growth", "brand", "advertising",
                  "campaign", "analytics", "digital marketing", "copywriter", "pr", "communications"],
    "sales": ["sales", "account executive", "business development", "bdr", "sdr", "revenue",
              "partnerships", "client", "customer success", "account manager"],
    "finance": ["finance", "accounting", "financial", "analyst", "cfo", "controller", "audit",
                "tax", "investment", "banking", "fintech", "payroll", "bookkeeping"],
    "healthcare": ["healthcare", "medical", "nurse", "doctor", "clinical", "pharma", "biotech",
                   "health", "patient", "hospital", "therapy", "dental"],
    "engineering": ["mechanical", "electrical", "civil", "chemical", "aerospace", "structural",
                    "manufacturing", "industrial", "hardware", "robotics", "embedded"],
    "education": ["teacher", "professor", "instructor", "tutor", "education", "curriculum",
                  "training", "academic", "school", "university", "learning"],
}

def auto_categorize_job(title: str, requirements: list, description: str) -> str:
    """Auto-categorize a job based on title, requirements, and description keywords"""
    text = f"{title} {' '.join(requirements)} {description}".lower()
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        scores[category] = sum(1 for kw in keywords if kw in text)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "other"


def calculate_job_match_score(seeker: dict, job: dict) -> int:
    """Calculate how well a job matches a seeker's profile (0-100)"""
    score = 0
    max_score = 0

    # Skills match (40 points)
    if job.get("requirements"):
        max_score += 40
        seeker_skills = [s.lower().strip() for s in seeker.get("skills", [])]
        job_reqs = [r.lower().strip() for r in job["requirements"]]
        if job_reqs and seeker_skills:
            matched = sum(1 for r in job_reqs if any(r in s or s in r for s in seeker_skills))
            score += int((matched / len(job_reqs)) * 40)

    # Experience level (25 points)
    if job.get("experience_level"):
        max_score += 25
        exp_years = seeker.get("experience_years") or 0
        level_map = {"entry": (0, 2), "mid": (2, 5), "senior": (5, 10), "lead": (8, 99)}
        low, high = level_map.get(job["experience_level"], (0, 99))
        if low <= exp_years <= high:
            score += 25
        elif abs(exp_years - low) <= 2 or abs(exp_years - high) <= 2:
            score += 12

    # Location (20 points)
    max_score += 20
    if job.get("job_type") == "remote":
        score += 20
    elif job.get("location") and seeker.get("location"):
        job_loc = job["location"].lower().split(",")[0].strip()
        user_loc = seeker["location"].lower().split(",")[0].strip()
        if job_loc and user_loc and (job_loc in user_loc or user_loc in job_loc):
            score += 20

    # Salary match (15 points)
    if job.get("salary_min") and seeker.get("desired_salary"):
        max_score += 15
        if seeker["desired_salary"] <= (job.get("salary_max") or job["salary_min"] * 2):
            score += 15
        elif seeker["desired_salary"] <= job["salary_min"] * 1.3:
            score += 7

    if max_score == 0:
        return 50
    return min(100, int((score / max_score) * 100))

@router.post("", response_model=JobResponse)
async def create_job(job: JobCreate, current_user: dict = Depends(get_current_user)):
    """Create a new job posting (recruiters only)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can post jobs")
    
    # Content moderation check
    is_clean, violations = check_fields({
        "title": job.title,
        "company": job.company,
        "description": job.description,
        "requirements": job.requirements,
    })
    if not is_clean and is_severe(violations):
        raise HTTPException(status_code=400, detail="Job posting contains prohibited content and cannot be published.")

    job_id = str(uuid.uuid4())

    # Gradient backgrounds for variety
    backgrounds = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    ]
    
    # Auto-detect category from title/requirements if not provided
    category = job.category or auto_categorize_job(job.title, job.requirements, job.description)

    job_doc = {
        "id": job_id,
        "title": job.title,
        "company": job.company,
        "description": job.description,
        "requirements": job.requirements,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "location": job.location,
        "job_type": job.job_type,
        "experience_level": job.experience_level,
        "recruiter_id": current_user["id"],
        "recruiter_name": current_user["name"],
        "company_logo": f"https://api.dicebear.com/7.x/identicon/svg?seed={job.company}",
        "background_image": backgrounds[hash(job_id) % len(backgrounds)],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "listing_photo": job.listing_photo if job.listing_photo and job.listing_photo != "profile" else (current_user.get("photo_url") if job.listing_photo == "profile" else None),
        "location_restriction": job.location_restriction,
        "category": category,
        "employment_type": job.employment_type or "full-time",
        "is_active": True
    }

    # Flag for review if non-severe violations found
    if not is_clean:
        job_doc["is_flagged"] = True
        await db.moderation_queue.insert_one({
            "id": str(uuid.uuid4()),
            "content_type": "job",
            "content_id": job_id,
            "user_id": current_user["id"],
            "violations": violations,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.jobs.insert_one(job_doc)
    return {k: v for k, v in job_doc.items() if k != '_id'}

@router.get("/recruiter")
async def get_recruiter_jobs(current_user: dict = Depends(get_current_user)):
    """Get all jobs posted by the current recruiter"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")
    jobs = await db.jobs.find(
        {"recruiter_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return jobs

@router.get("", response_model=List[JobResponse])
async def get_jobs(
    current_user: dict = Depends(get_current_user),
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    salary_min: Optional[int] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    employment_type: Optional[str] = None,
    search: Optional[str] = None,
    include_swiped: bool = False,
    skip: int = 0,
    limit: int = 100
):
    """Get available jobs for seekers or recruiter's own jobs, with smart matching"""

    if current_user["role"] == "recruiter":
        # Recruiters see their own jobs
        jobs = await db.jobs.find(
            {"recruiter_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    else:
        # Seekers see jobs they haven't swiped on yet
        swiped_jobs = await db.applications.find(
            {"seeker_id": current_user["id"]},
            {"job_id": 1}
        ).to_list(1000)
        swiped_job_ids = [s["job_id"] for s in swiped_jobs]

        query = {"is_active": True}

        # Search page passes include_swiped=true so seekers can find any active job
        if not include_swiped:
            query["id"] = {"$nin": swiped_job_ids}

        # Text search across title, company, description
        if search:
            import re
            safe_search = re.escape(search)
            and_clauses = query.setdefault("$and", [])
            and_clauses.append({"$or": [
                {"title": {"$regex": safe_search, "$options": "i"}},
                {"company": {"$regex": safe_search, "$options": "i"}},
                {"description": {"$regex": safe_search, "$options": "i"}},
            ]})

        # Apply filters
        if job_type:
            query["job_type"] = job_type
        if experience_level:
            query["experience_level"] = experience_level
        if salary_min:
            query["salary_min"] = {"$gte": salary_min}
        if location:
            query["location"] = {"$regex": location, "$options": "i"}
        if category:
            query["category"] = category
        if employment_type:
            query["employment_type"] = employment_type

        # Filter out jobs with specific location restrictions if seeker's location doesn't match
        seeker_location = current_user.get("location", "")
        if seeker_location:
            and_clauses = query.setdefault("$and", [])
            and_clauses.append({"$or": [
                {"location_restriction": None},
                {"location_restriction": "any"},
                {"location_restriction": {"$exists": False}},
                {"location": {"$regex": seeker_location.split(",")[0].strip(), "$options": "i"}},
            ]})

        clamped_limit = min(limit, 200)
        jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).to_list(clamped_limit)

        # Calculate match scores and check recruiter subscription status
        now = datetime.now(timezone.utc).isoformat()
        recruiter_ids = list(set(j.get("recruiter_id") for j in jobs if j.get("recruiter_id")))
        recruiter_subs = {}
        if recruiter_ids:
            recruiters = await db.users.find(
                {"id": {"$in": recruiter_ids}},
                {"_id": 0, "id": 1, "subscription": 1}
            ).to_list(len(recruiter_ids))
            for r in recruiters:
                sub = r.get("subscription", {})
                if sub.get("status") == "active" and sub.get("period_end", "") >= now:
                    recruiter_subs[r["id"]] = sub.get("tier_id", "")

        swiped_set = set(swiped_job_ids)
        for job in jobs:
            job["match_score"] = calculate_job_match_score(current_user, job)
            # Check if job is actively boosted
            job["is_boosted"] = bool(job.get("is_boosted") and job.get("boost_until", "") >= now)
            # Subscribers get a match score bonus (+15 for pro, +10 for enterprise already has other perks)
            rec_tier = recruiter_subs.get(job.get("recruiter_id"), "")
            if rec_tier:
                job["is_premium_listing"] = True
                job["match_score"] = min(100, job["match_score"] + 15)
            # Mark already-applied jobs for search page
            if include_swiped:
                job["already_applied"] = job["id"] in swiped_set

        # Sort: boosted jobs first (interleaved), then premium listings get priority, then by match score
        boosted = [j for j in jobs if j.get("is_boosted")]
        regular = [j for j in jobs if not j.get("is_boosted")]
        regular.sort(key=lambda j: (1 if j.get("is_premium_listing") else 0, j["match_score"]), reverse=True)

        # Interleave boosted jobs at positions 0, 3, 7, etc. for natural feel
        result = list(regular)
        boost_positions = [0, 3, 7, 12, 18]
        for i, bj in enumerate(boosted):
            pos = boost_positions[i] if i < len(boost_positions) else len(result)
            pos = min(pos, len(result))
            result.insert(pos, bj)
        jobs = result

    return jobs

@router.get("/company/{recruiter_id}")
async def get_company_jobs(recruiter_id: str, current_user: dict = Depends(get_current_user)):
    """Get active jobs posted by a specific recruiter/company — for seeker browsing"""
    recruiter, jobs = await asyncio.gather(
        db.users.find_one(
            {"id": recruiter_id, "role": "recruiter"},
            {"_id": 0, "id": 1, "name": 1, "company": 1, "photo_url": 1, "avatar": 1, "location": 1, "bio": 1}
        ),
        db.jobs.find(
            {"recruiter_id": recruiter_id, "is_active": True},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50),
    )
    if not recruiter:
        raise HTTPException(status_code=404, detail="Company not found")

    # If the viewer is a seeker, mark which jobs they've already applied to
    applied_set = set()
    if current_user.get("role") == "seeker":
        job_ids = [j["id"] for j in jobs]
        if job_ids:
            applied_apps = await db.applications.find(
                {"seeker_id": current_user["id"], "job_id": {"$in": job_ids}},
                {"job_id": 1}
            ).to_list(len(job_ids))
            applied_set = {a["job_id"] for a in applied_apps}

    for job in jobs:
        job["applied"] = job["id"] in applied_set

    return {"company": recruiter, "jobs": jobs}

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific job by ID"""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    """Update a job posting"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can update jobs")
    
    job = await db.jobs.find_one({"id": job_id, "recruiter_id": current_user["id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not authorized")
    
    allowed_fields = ["title", "company", "description", "requirements",
                      "salary_min", "salary_max", "location", "job_type",
                      "experience_level", "is_active", "location_restriction", "category", "employment_type",
                      "listing_photo"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}

    # Content moderation on text fields being updated
    text_fields = {k: v for k, v in update_data.items() if k in ("title", "company", "description", "requirements")}
    if text_fields:
        is_clean, violations = check_fields(text_fields)
        if not is_clean and is_severe(violations):
            raise HTTPException(status_code=400, detail="Update contains prohibited content.")
        if not is_clean:
            update_data["is_flagged"] = True
            await db.moderation_queue.insert_one({
                "id": str(uuid.uuid4()),
                "content_type": "job",
                "content_id": job_id,
                "user_id": current_user["id"],
                "violations": violations,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    if update_data:
        await db.jobs.update_one({"id": job_id}, {"$set": update_data})
    
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return updated_job

@router.post("/{job_id}/duplicate")
async def duplicate_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Duplicate an existing job posting."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can duplicate jobs")

    job = await db.jobs.find_one({"id": job_id, "recruiter_id": current_user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not authorized")

    new_id = str(uuid.uuid4())
    new_job = {**job}
    new_job["id"] = new_id
    new_job["title"] = f"{job['title']} (Copy)"
    new_job["created_at"] = datetime.now(timezone.utc).isoformat()
    new_job["is_active"] = True
    new_job.pop("is_boosted", None)
    new_job.pop("boost_until", None)
    new_job.pop("is_flagged", None)

    backgrounds = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    ]
    new_job["background_image"] = backgrounds[hash(new_id) % len(backgrounds)]

    await db.jobs.insert_one(new_job)
    return {k: v for k, v in new_job.items() if k != '_id'}


@router.delete("/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a job posting"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can delete jobs")
    
    result = await db.jobs.delete_one({"id": job_id, "recruiter_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found or not authorized")
    
    return {"message": "Job deleted successfully"}


# ==================== SCREENSHOT PARSING & AI ASSIST ====================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

def _resize_image_bytes(img_bytes: bytes, max_dim: int = 1500) -> bytes:
    """Resize image to max dimension while preserving aspect ratio."""
    from PIL import Image
    img = Image.open(io.BytesIO(img_bytes))
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    buf = io.BytesIO()
    fmt = img.format or "JPEG"
    if fmt.upper() not in ("JPEG", "PNG", "WEBP"):
        fmt = "JPEG"
    img.save(buf, format=fmt)
    return buf.getvalue()

def _extract_json(text: str) -> dict:
    """Extract JSON from model response, handling markdown code blocks."""
    import json as json_module
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        json_lines = []
        in_block = False
        for line in lines:
            if line.startswith("```") and not in_block:
                in_block = True
                continue
            elif line.startswith("```") and in_block:
                break
            elif in_block:
                json_lines.append(line)
        text = "\n".join(json_lines)
    return json_module.loads(text)

def _get_anthropic_client():
    """Create Anthropic client or raise."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    import anthropic
    return anthropic.Anthropic(api_key=api_key)

def _call_anthropic(client, messages, max_tokens=4000):
    """Call Anthropic API with model fallback chain."""
    models = [
        "claude-haiku-4-5-20251001",
        "claude-3-5-haiku-20241022",
        "claude-3-haiku-20240307",
    ]
    last_error = None
    for model_id in models:
        try:
            message = client.messages.create(
                model=model_id,
                max_tokens=max_tokens,
                messages=messages,
            )
            logger.info(f"Anthropic call used model: {model_id}")
            return message
        except Exception as e:
            last_error = e
            logger.warning(f"Model {model_id} failed: {type(e).__name__}: {e}")
            continue
    raise last_error or Exception("All models failed")


@router.post("/parse-screenshots")
async def parse_job_screenshots(
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Parse job listing screenshots using Claude Vision to extract structured job data."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can use this feature")

    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one image is required")

    # Validate and read images
    images = []
    for f in files:
        if f.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid image type: {f.content_type}. Use JPEG, PNG, or WebP.")
        data = await f.read()
        if len(data) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail=f"Image {f.filename} exceeds 5MB limit")
        # Resize to keep API payload small
        data = _resize_image_bytes(data)
        images.append((data, f.content_type))

    client = _get_anthropic_client()

    # Build multi-image content
    content = []
    for img_bytes, media_type in images:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.b64encode(img_bytes).decode("utf-8"),
            },
        })

    content.append({
        "type": "text",
        "text": """You are parsing a job listing from screenshots. Extract ALL available information and return ONLY valid JSON with this structure:

{
  "title": "Job Title",
  "company": "Company Name",
  "description": "Full job description text",
  "requirements": ["requirement 1", "requirement 2"],
  "salary_min": 80000,
  "salary_max": 120000,
  "location": "City, State",
  "job_type": "remote",
  "experience_level": "mid",
  "employment_type": "full-time",
  "category": "technology"
}

Rules:
- "job_type": one of "remote", "onsite", "hybrid". Default "onsite" if unclear.
- "experience_level": one of "entry", "mid", "senior", "lead". Infer from title/requirements.
- "employment_type": one of "full-time", "part-time", "contract", "internship". Default "full-time".
- "category": one of "technology", "design", "marketing", "sales", "finance", "healthcare", "engineering", "education", "other".
- "salary_min"/"salary_max": integers (annual USD). Convert hourly rates to annual (×2080). Use null if not found.
- "requirements": array of individual skills/qualifications extracted from the listing.
- "description": the full job description. Combine text across multiple screenshots if needed.
- Use null for any field you cannot determine.
- Return ONLY the JSON object, no explanation.""",
    })

    try:
        message = _call_anthropic(client, [{"role": "user", "content": content}])
        parsed = _extract_json(message.content[0].text)

        # Normalize and validate
        result = {
            "title": parsed.get("title"),
            "company": parsed.get("company"),
            "description": parsed.get("description"),
            "requirements": parsed.get("requirements", [])[:30],
            "salary_min": parsed.get("salary_min"),
            "salary_max": parsed.get("salary_max"),
            "location": parsed.get("location"),
            "job_type": parsed.get("job_type", "onsite"),
            "experience_level": parsed.get("experience_level", "mid"),
            "employment_type": parsed.get("employment_type", "full-time"),
            "category": parsed.get("category"),
        }
        return result

    except Exception as e:
        logger.error(f"Screenshot parsing failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse screenshots. Please try again.")


class AIAssistRequest(BaseModel):
    title: str = ""
    company: str = ""
    description: str = ""
    mode: str = "generate"  # "generate" or "improve"


@router.post("/ai-assist")
async def ai_assist_job(
    req: AIAssistRequest,
    current_user: dict = Depends(get_current_user),
):
    """Use AI to generate or improve a job description."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can use this feature")

    if req.mode == "generate" and not req.title:
        raise HTTPException(status_code=400, detail="Job title is required to generate a description")
    if req.mode == "improve" and not req.description:
        raise HTTPException(status_code=400, detail="Existing description is required to improve")

    client = _get_anthropic_client()

    if req.mode == "generate":
        prompt = f"""Write a compelling job description for the following position. Return ONLY valid JSON.

Job Title: {req.title}
Company: {req.company or "a growing company"}

Return JSON:
{{
  "description": "A professional, engaging job description (3-4 paragraphs covering role overview, responsibilities, and what makes this opportunity exciting)",
  "requirements": ["requirement 1", "requirement 2", "...up to 8 key requirements"]
}}

Write in a professional but approachable tone. Do NOT include salary or location — just the description and requirements."""
    else:
        prompt = f"""Improve the following job description to be more professional, engaging, and well-structured. Return ONLY valid JSON.

Job Title: {req.title or "Not specified"}
Company: {req.company or "Not specified"}
Current Description:
{req.description}

Return JSON:
{{
  "description": "The improved, polished job description",
  "requirements": ["requirement 1", "requirement 2", "...extracted or improved requirements"]
}}

Keep the core content but make it more compelling and well-organized. Do NOT include salary or location."""

    try:
        message = _call_anthropic(client, [{"role": "user", "content": prompt}])
        parsed = _extract_json(message.content[0].text)
        return {
            "description": parsed.get("description", ""),
            "requirements": parsed.get("requirements", [])[:15],
        }
    except Exception as e:
        logger.error(f"AI assist failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="AI assist failed. Please try again.")


# ==================== SAVED JOBS ====================

@router.post("/{job_id}/save")
async def save_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Save/bookmark a job for later."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can save jobs")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "id": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = await db.saved_jobs.find_one({"user_id": current_user["id"], "job_id": job_id})
    if existing:
        return {"saved": True, "message": "Already saved"}

    await db.saved_jobs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "job_id": job_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"saved": True, "message": "Job saved"}


@router.delete("/{job_id}/save")
async def unsave_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a saved/bookmarked job."""
    await db.saved_jobs.delete_one({"user_id": current_user["id"], "job_id": job_id})
    return {"saved": False, "message": "Job removed from saved"}


@router.get("/saved/list")
async def get_saved_jobs(current_user: dict = Depends(get_current_user)):
    """Get all saved jobs for the current user."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can view saved jobs")

    saved = await db.saved_jobs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    job_ids = [s["job_id"] for s in saved]
    if not job_ids:
        return {"jobs": []}

    jobs = await db.jobs.find(
        {"id": {"$in": job_ids}},
        {"_id": 0}
    ).to_list(100)

    # Preserve saved order
    job_map = {j["id"]: j for j in jobs}
    ordered = []
    for s in saved:
        job = job_map.get(s["job_id"])
        if job:
            job["saved_at"] = s["created_at"]
            ordered.append(job)

    return {"jobs": ordered}


@router.get("/saved/ids")
async def get_saved_job_ids(current_user: dict = Depends(get_current_user)):
    """Get just the IDs of saved jobs (for UI bookmark state)."""
    saved = await db.saved_jobs.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "job_id": 1}
    ).to_list(500)
    return {"job_ids": [s["job_id"] for s in saved]}


@router.get("/{job_id}/poster")
async def generate_job_poster(job_id: str, current_user: dict = Depends(get_current_user)):
    """Generate a printable 'We're Hiring' poster PDF with QR code for a job listing."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can generate posters")

    job = await db.jobs.find_one(
        {"id": job_id, "recruiter_id": current_user["id"]},
        {"_id": 0}
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Generate QR code
    qr_url = f"https://hireabble.com/download?ref=poster&job={job_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    # Build poster PDF
    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    w, h = letter  # 612 x 792

    green_start = (0x2d / 255, 0xd4 / 255, 0xa8 / 255)  # #2dd4a8
    green_end = (0x1a / 255, 0x8a / 255, 0x7a / 255)    # #1a8a7a
    dark = "#1a1a2e"
    gray = "#6b7280"
    brand_green = "#2dd4a8"

    # -- Green gradient banner (draw as thin horizontal strips) --
    banner_h = 150
    banner_y = h - banner_h
    strips = 60
    strip_h = banner_h / strips
    for i in range(strips):
        t = i / max(strips - 1, 1)
        r = green_start[0] + (green_end[0] - green_start[0]) * t
        g = green_start[1] + (green_end[1] - green_start[1]) * t
        b = green_start[2] + (green_end[2] - green_start[2]) * t
        c.setFillColor(Color(r, g, b))
        y = banner_y + banner_h - (i + 1) * strip_h
        c.rect(0, y, w, strip_h + 0.5, fill=1, stroke=0)

    # -- Logo image in banner (logo-white.png) --
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-white.png")
    logo_size = 50
    logo_x = w / 2 - 110
    logo_y = banner_y + banner_h - logo_size - 28
    c.drawImage(ImageReader(logo_path), logo_x, logo_y, logo_size, logo_size, mask='auto')

    # -- "hireabble" brand text in banner --
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 36)
    c.drawString(logo_x + logo_size + 8, logo_y + 10, "hireabble")

    # -- "Swipe right on your next career move" tagline in banner --
    c.setFillColor(Color(1, 1, 1, 0.8))
    c.setFont("Helvetica", 13)
    c.drawCentredString(w / 2, banner_y + 18, "Swipe right on your next career move")

    # -- WE'RE HIRING --
    c.setFillColor(HexColor(dark))
    c.setFont("Helvetica-Bold", 48)
    c.drawCentredString(w / 2, banner_y - 50, "WE'RE HIRING")

    # -- Thin green accent line under heading --
    c.setStrokeColor(HexColor(brand_green))
    c.setLineWidth(3)
    c.line(w / 2 - 80, banner_y - 58, w / 2 + 80, banner_y - 58)

    # -- Company name --
    company = job.get("company", "")
    if company:
        c.setFillColor(HexColor(gray))
        c.setFont("Helvetica", 20)
        c.drawCentredString(w / 2, banner_y - 85, company)

    # -- Job title (may wrap) --
    title_style = ParagraphStyle(
        "title",
        fontName="Helvetica-Bold",
        fontSize=30,
        leading=36,
        alignment=TA_CENTER,
        textColor=HexColor(dark),
    )
    title_text = job.get("title", "Open Position")
    title_para = Paragraph(title_text, title_style)
    tw, th = title_para.wrap(w - 80, 200)
    title_y = banner_y - 100 - th if company else banner_y - 75 - th
    title_para.drawOn(c, 40, title_y)

    # -- Details line --
    details_parts = []
    if job.get("location"):
        details_parts.append(job["location"])
    if job.get("job_type"):
        details_parts.append(job["job_type"].replace("_", " ").title())
    if job.get("employment_type"):
        details_parts.append(job["employment_type"].replace("-", " ").title())
    if job.get("experience_level"):
        details_parts.append(job["experience_level"].title() + " Level")

    cursor_y = title_y - 24
    if details_parts:
        c.setFillColor(HexColor(gray))
        c.setFont("Helvetica", 13)
        c.drawCentredString(w / 2, cursor_y, "  ·  ".join(details_parts))
        cursor_y -= 10

    # -- Salary range --
    sal_min = job.get("salary_min")
    sal_max = job.get("salary_max")
    if sal_min:
        cursor_y -= 16
        c.setFillColor(HexColor(dark))
        c.setFont("Helvetica-Bold", 18)
        if sal_max:
            sal_text = f"${sal_min:,} – ${sal_max:,} / year"
        else:
            sal_text = f"From ${sal_min:,} / year"
        c.drawCentredString(w / 2, cursor_y, sal_text)
        cursor_y -= 10

    # -- QR code with rounded border --
    qr_size = 180
    qr_x = (w - qr_size) / 2
    qr_y = cursor_y - qr_size - 25
    # Draw a light border/background around QR
    pad = 12
    c.setFillColor(HexColor("#f9fafb"))
    c.setStrokeColor(HexColor("#e5e7eb"))
    c.setLineWidth(1)
    c.roundRect(qr_x - pad, qr_y - pad, qr_size + pad * 2, qr_size + pad * 2, 10, fill=1, stroke=1)
    c.drawImage(ImageReader(qr_buffer), qr_x, qr_y, qr_size, qr_size)

    # -- Prominent scan/download instruction --
    inst_y = qr_y - pad - 28
    c.setFillColor(HexColor(dark))
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, inst_y, "Scan to download Hireabble & apply")

    inst_y -= 24
    c.setFillColor(HexColor(gray))
    c.setFont("Helvetica", 13)
    c.drawCentredString(w / 2, inst_y, "Available on the App Store and Google Play")

    # -- Bottom green accent bar --
    bottom_bar_h = 36
    strips_b = 20
    strip_bh = bottom_bar_h / strips_b
    for i in range(strips_b):
        t = i / max(strips_b - 1, 1)
        r = green_end[0] + (green_start[0] - green_end[0]) * t
        g = green_end[1] + (green_start[1] - green_end[1]) * t
        b = green_end[2] + (green_start[2] - green_end[2]) * t
        c.setFillColor(Color(r, g, b))
        y = i * strip_bh
        c.rect(0, y, w, strip_bh + 0.5, fill=1, stroke=0)

    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(w / 2, 12, "hireabble.com")

    c.save()
    pdf_buffer.seek(0)

    safe_title = job.get("title", "Job").replace(" ", "_")[:40]
    filename = f"Hiring_Poster_{safe_title}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )
