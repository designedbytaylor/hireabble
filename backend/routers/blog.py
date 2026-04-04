"""
Blog/SEO batch generation routes for Hireabble admin panel.

Generates programmatic SEO blog posts targeting city+role combinations
across 40 cities and 30 roles using Claude API.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import asyncio
import random
import re
import os

from database import db, logger, get_current_admin
from slowapi import Limiter
from slowapi.util import get_remote_address
import anthropic

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Admin"])

# ==================== CONSTANTS ====================

CITIES_CANADA = [
    "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton",
    "Winnipeg", "Quebec City", "Hamilton", "Kitchener", "London", "Halifax",
    "Victoria", "Saskatoon", "Regina", "St. John's", "Kelowna", "Barrie",
    "Windsor", "Mississauga",
]

CITIES_US = [
    "New York", "San Francisco", "Los Angeles", "Chicago", "Seattle",
    "Austin", "Boston", "Denver", "Miami", "Dallas", "Atlanta", "Phoenix",
    "Minneapolis", "Portland", "San Diego", "Washington DC", "Philadelphia",
    "Nashville", "Raleigh", "Charlotte",
]

ALL_CITIES = CITIES_CANADA + CITIES_US

ROLES = [
    "Software Developer", "Data Analyst", "Project Manager", "Registered Nurse",
    "Marketing Manager", "Accountant", "Graphic Designer", "Sales Representative",
    "HR Manager", "Electrician", "Mechanical Engineer", "Teacher", "Pharmacist",
    "Financial Analyst", "UX Designer", "DevOps Engineer", "Business Analyst",
    "Civil Engineer", "Dental Hygienist", "Social Worker", "Construction Manager",
    "Plumber", "Welder", "Truck Driver", "Administrative Assistant",
    "Customer Service Rep", "Retail Manager", "Chef", "Physiotherapist", "Paramedic",
]

PAGE_TYPES = ["jobs_in_city", "salary_guide", "career_guide", "interview_prep"]

# Salary data (CAD baseline for Canada, multiply ~1.1x for US/USD)
# Format: { role: { "junior": (low, high), "mid": (low, high), "senior": (low, high) } }
SALARY_DATA_CAD = {
    "Software Developer":      {"junior": (60000, 78000),  "mid": (82000, 110000),  "senior": (115000, 155000)},
    "Data Analyst":            {"junior": (50000, 62000),  "mid": (65000, 85000),   "senior": (88000, 120000)},
    "Project Manager":         {"junior": (55000, 70000),  "mid": (72000, 95000),   "senior": (98000, 135000)},
    "Registered Nurse":        {"junior": (62000, 72000),  "mid": (74000, 90000),   "senior": (92000, 110000)},
    "Marketing Manager":       {"junior": (48000, 62000),  "mid": (65000, 88000),   "senior": (90000, 125000)},
    "Accountant":              {"junior": (48000, 60000),  "mid": (62000, 82000),   "senior": (85000, 115000)},
    "Graphic Designer":        {"junior": (40000, 52000),  "mid": (54000, 72000),   "senior": (75000, 100000)},
    "Sales Representative":    {"junior": (42000, 55000),  "mid": (58000, 78000),   "senior": (80000, 120000)},
    "HR Manager":              {"junior": (52000, 65000),  "mid": (68000, 88000),   "senior": (90000, 120000)},
    "Electrician":             {"junior": (45000, 58000),  "mid": (60000, 78000),   "senior": (80000, 105000)},
    "Mechanical Engineer":     {"junior": (55000, 70000),  "mid": (72000, 95000),   "senior": (98000, 130000)},
    "Teacher":                 {"junior": (45000, 55000),  "mid": (58000, 75000),   "senior": (78000, 98000)},
    "Pharmacist":              {"junior": (75000, 88000),  "mid": (90000, 110000),  "senior": (112000, 140000)},
    "Financial Analyst":       {"junior": (52000, 65000),  "mid": (68000, 90000),   "senior": (92000, 130000)},
    "UX Designer":             {"junior": (52000, 68000),  "mid": (70000, 92000),   "senior": (95000, 130000)},
    "DevOps Engineer":         {"junior": (62000, 80000),  "mid": (82000, 110000),  "senior": (112000, 150000)},
    "Business Analyst":        {"junior": (52000, 65000),  "mid": (68000, 88000),   "senior": (90000, 120000)},
    "Civil Engineer":          {"junior": (55000, 68000),  "mid": (70000, 92000),   "senior": (95000, 125000)},
    "Dental Hygienist":        {"junior": (55000, 68000),  "mid": (70000, 85000),   "senior": (87000, 105000)},
    "Social Worker":           {"junior": (42000, 52000),  "mid": (54000, 68000),   "senior": (70000, 90000)},
    "Construction Manager":    {"junior": (55000, 70000),  "mid": (72000, 95000),   "senior": (98000, 135000)},
    "Plumber":                 {"junior": (42000, 55000),  "mid": (58000, 75000),   "senior": (78000, 100000)},
    "Welder":                  {"junior": (40000, 52000),  "mid": (54000, 70000),   "senior": (72000, 95000)},
    "Truck Driver":            {"junior": (40000, 52000),  "mid": (55000, 70000),   "senior": (72000, 92000)},
    "Administrative Assistant": {"junior": (35000, 42000), "mid": (44000, 55000),   "senior": (58000, 72000)},
    "Customer Service Rep":    {"junior": (32000, 40000),  "mid": (42000, 52000),   "senior": (54000, 68000)},
    "Retail Manager":          {"junior": (38000, 48000),  "mid": (50000, 65000),   "senior": (68000, 88000)},
    "Chef":                    {"junior": (35000, 45000),  "mid": (48000, 62000),   "senior": (65000, 88000)},
    "Physiotherapist":         {"junior": (58000, 70000),  "mid": (72000, 88000),   "senior": (90000, 115000)},
    "Paramedic":               {"junior": (50000, 62000),  "mid": (64000, 78000),   "senior": (80000, 100000)},
}

# Track running generation jobs for cancellation
_running_jobs: dict[str, bool] = {}

# ==================== PROMPT VARIETY ====================

VOICE_VARIATIONS = [
    "Write as an experienced career coach talking to a friend.",
    "Write from the perspective of a hiring manager who's reviewed thousands of applications.",
    "Write as a local recruiter who knows the {city} market inside out.",
    "Write as a career journalist covering the job market.",
    "Write as someone who's worked as a {role} and switched careers, giving honest insider advice.",
]

STRUCTURE_VARIATIONS = [
    "Start with a compelling question, then dive into the data.",
    "Lead with the most surprising statistic, then explain why it matters.",
    "Tell a brief story about someone in this exact situation, then transition to practical advice.",
    "Start with a quick summary of key numbers, then go deeper into each one.",
    "Open with a common misconception about this topic, then set the record straight.",
]

ANGLE_VARIATIONS = {
    "jobs_in_city": [
        "Focus on the hidden job market and networking strategies specific to {city}.",
        "Emphasize remote vs. in-office trends for {role} positions in {city}.",
        "Highlight the fastest-growing companies hiring {role}s in {city} right now.",
        "Compare the {role} job market in {city} to similar-sized cities.",
        "Focus on what makes {city} uniquely attractive for {role} professionals.",
    ],
    "salary_guide": [
        "Emphasize negotiation strategies that work specifically in {city}'s market.",
        "Focus on the total compensation picture beyond base salary.",
        "Highlight how {role} salaries in {city} have changed over the past few years.",
        "Compare what startups vs. established companies pay for {role}s in {city}.",
        "Focus on the cost-of-living-adjusted value of {role} salaries in {city}.",
    ],
    "career_guide": [
        "Focus on non-traditional paths into the {role} career.",
        "Emphasize the most in-demand specializations within {role} in {city}.",
        "Highlight mentorship and community resources in {city} for aspiring {role}s.",
        "Focus on the step-by-step certification and licensing process.",
        "Emphasize real career progression timelines and what to expect each year.",
    ],
    "interview_prep": [
        "Focus on behavioral questions and the STAR method with {role}-specific examples.",
        "Emphasize technical skills assessment and how to demonstrate competence.",
        "Highlight cultural fit questions and what {city} employers value most.",
        "Focus on questions candidates should ask the interviewer.",
        "Emphasize common mistakes {role} candidates make in interviews and how to avoid them.",
    ],
}


# ==================== HELPERS ====================

def _get_country(city: str) -> str:
    return "Canada" if city in CITIES_CANADA else "US"


def _get_salary_range(role: str, city: str) -> dict:
    """Get salary data for a role in a given city, adjusted for country."""
    base = SALARY_DATA_CAD.get(role, {"junior": (45000, 58000), "mid": (60000, 80000), "senior": (82000, 110000)})
    multiplier = 1.1 if city in CITIES_US else 1.0
    currency = "USD" if city in CITIES_US else "CAD"
    return {
        "currency": currency,
        "junior": f"{int(base['junior'][0] * multiplier / 1000)}K-{int(base['junior'][1] * multiplier / 1000)}K",
        "mid": f"{int(base['mid'][0] * multiplier / 1000)}K-{int(base['mid'][1] * multiplier / 1000)}K",
        "senior": f"{int(base['senior'][0] * multiplier / 1000)}K-{int(base['senior'][1] * multiplier / 1000)}K",
    }


def _slugify(title: str) -> str:
    """Generate URL-friendly slug from title."""
    slug = title.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    return slug.strip('-')


def _build_prompt(page_type: str, city: str, role: str) -> tuple[str, str]:
    """Build Claude prompt and title for a given page type, city, and role.

    Each call randomly selects a voice, structure, and angle variation
    so that posts for the same page_type don't all sound identical.
    """
    salary = _get_salary_range(role, city)
    country = _get_country(city)
    currency = salary["currency"]

    # Randomly select variety elements
    voice = random.choice(VOICE_VARIATIONS).format(city=city, role=role)
    structure = random.choice(STRUCTURE_VARIATIONS)
    angle = random.choice(ANGLE_VARIATIONS.get(page_type, [""])).format(city=city, role=role)

    style_instructions = (
        f"{voice} "
        f"{structure} "
        "Use contractions (you'll, it's, don't, we've). "
        "Vary sentence length — mix short punchy sentences with longer flowing ones. "
        "Format with markdown H2/H3 headings and bullet lists. "
        "Target 800-1200 words. "
        "Include a 'Key Takeaways' section at the end with 4-6 bullet points. "
        "NEVER use these phrases: 'In today's fast-paced world', 'It's important to note', "
        "'In conclusion', 'Let's dive in', 'without further ado', 'game-changer', "
        "'navigating the landscape', 'look no further', 'comprehensive guide'. "
        "Reference the specific city with local context where relevant. "
        f"{angle}"
    )

    if page_type == "jobs_in_city":
        title = f"Finding {role} Jobs in {city}: 2026 Guide"
        prompt = (
            f"Write a comprehensive guide about finding {role} jobs in {city}, {country}. "
            f"Cover the local job market, top employers, neighborhoods where these jobs cluster, "
            f"and practical tips for job seekers. "
            f"Include salary expectations: junior {salary['junior']} {currency}, "
            f"mid-level {salary['mid']} {currency}, senior {salary['senior']} {currency}. "
            f"Mention how platforms like Hireabble can streamline the job search with swipe-based matching. "
            f"{style_instructions}"
        )
    elif page_type == "salary_guide":
        title = f"{role} Salary in {city} (2025-2026)"
        prompt = (
            f"Write a detailed salary guide for {role} positions in {city}, {country}. "
            f"Break down compensation by experience level: "
            f"junior/entry-level {salary['junior']} {currency}, "
            f"mid-level {salary['mid']} {currency}, senior {salary['senior']} {currency}. "
            f"Cover factors that affect pay (company size, industry, certifications), "
            f"cost of living considerations in {city}, benefits packages, and negotiation tips. "
            f"Compare briefly with nearby cities. "
            f"{style_instructions}"
        )
    elif page_type == "career_guide":
        title = f"How to Become a {role} in {city}"
        prompt = (
            f"Write a practical career guide on becoming a {role} in {city}, {country}. "
            f"Cover required education and certifications, typical career path, "
            f"local schools or training programs, licensing requirements specific to "
            f"{'the province' if country == 'Canada' else 'the state'}, "
            f"and expected salary progression: junior {salary['junior']} {currency}, "
            f"mid-level {salary['mid']} {currency}, senior {salary['senior']} {currency}. "
            f"Include networking tips and local professional associations. "
            f"Mention how Hireabble connects job seekers with employers through swipe-based matching. "
            f"{style_instructions}"
        )
    elif page_type == "interview_prep":
        title = f"{role} Interview Questions & Tips"
        prompt = (
            f"Write an interview preparation guide for {role} positions, "
            f"tailored to the {city}, {country} job market. "
            f"Include 8-10 common interview questions with guidance on strong answers. "
            f"Cover both technical and behavioral questions. "
            f"Add tips on researching {city}-based employers, salary negotiation "
            f"(typical range: {salary['mid']} {currency} mid-level), "
            f"and what hiring managers in {city} specifically look for. "
            f"{style_instructions}"
        )
    else:
        raise ValueError(f"Unknown page_type: {page_type}")

    return title, prompt


async def _call_claude(prompt: str) -> str:
    """Call Claude API with model fallback chain."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)
    models = [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-haiku-20240307",
    ]

    last_error = None
    for model in models:
        try:
            response = await asyncio.to_thread(
                client.messages.create,
                model=model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text
        except Exception as e:
            last_error = e
            logger.warning(f"Claude model {model} failed: {e}, trying next...")
            continue

    raise RuntimeError(f"All Claude models failed. Last error: {last_error}")


async def run_generation_job(job_id: str):
    """Background task that generates blog posts for a job."""
    _running_jobs[job_id] = True
    try:
        job = await db.blog_jobs.find_one({"id": job_id})
        if not job:
            logger.error(f"Blog generation job {job_id} not found")
            return

        page_type = job["page_type"]
        cities = job["cities"]
        roles = job["roles"]
        error_log = []

        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()}}
        )

        completed = 0
        failed = 0
        skipped = 0

        for city in cities:
            for role in roles:
                # Check for cancellation
                if not _running_jobs.get(job_id, False):
                    await db.blog_jobs.update_one(
                        {"id": job_id},
                        {"$set": {
                            "status": "cancelled",
                            "completed": completed,
                            "failed": failed,
                            "skipped": skipped,
                            "error_log": error_log,
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                        }}
                    )
                    logger.info(f"Blog generation job {job_id} cancelled")
                    return

                # Duplicate prevention: skip if this city+role+page_type already exists
                existing_post = await db.blog_posts.find_one({
                    "city": city, "role": role, "page_type": page_type
                })
                if existing_post:
                    skipped += 1
                    await db.blog_jobs.update_one(
                        {"id": job_id},
                        {"$set": {"completed": completed, "failed": failed, "skipped": skipped}}
                    )
                    continue

                try:
                    title, prompt = _build_prompt(page_type, city, role)
                    content = await _call_claude(prompt)
                    slug = _slugify(title)

                    # Check for duplicate slug, append uuid fragment if needed
                    existing_slug = await db.blog_posts.find_one({"slug": slug})
                    if existing_slug:
                        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

                    # Extract first paragraph as excerpt
                    lines = [l.strip() for l in content.split('\n') if l.strip() and not l.strip().startswith('#')]
                    excerpt = lines[0][:200] if lines else title

                    word_count = len(content.split())

                    post_doc = {
                        "id": str(uuid.uuid4()),
                        "slug": slug,
                        "title": title,
                        "content": content,
                        "excerpt": excerpt,
                        "page_type": page_type,
                        "city": city,
                        "role": role,
                        "country": _get_country(city),
                        "status": "draft",
                        "meta_title": title,
                        "meta_description": excerpt,
                        "word_count": word_count,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "published_at": None,
                        "generation_job_id": job_id,
                    }
                    await db.blog_posts.insert_one(post_doc)
                    completed += 1

                except Exception as e:
                    failed += 1
                    error_msg = f"{city}/{role}: {str(e)}"
                    error_log.append(error_msg)
                    logger.error(f"Blog generation error in job {job_id}: {error_msg}")

                # Update job progress
                await db.blog_jobs.update_one(
                    {"id": job_id},
                    {"$set": {"completed": completed, "failed": failed, "skipped": skipped, "error_log": error_log}}
                )

                # Rate limit between API calls
                await asyncio.sleep(0.5)

        # Job finished
        final_status = "completed" if failed == 0 else "completed_with_errors"
        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": final_status,
                "completed": completed,
                "failed": failed,
                "skipped": skipped,
                "error_log": error_log,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        logger.info(f"Blog generation job {job_id} finished: {completed} completed, {failed} failed, {skipped} skipped")

    except Exception as e:
        logger.error(f"Blog generation job {job_id} crashed: {e}")
        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "error_log": [str(e)],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
    finally:
        _running_jobs.pop(job_id, None)


# ==================== ENDPOINTS ====================

@router.get("/admin/blog/stats")
async def blog_stats(admin=Depends(get_current_admin)):
    """Return blog post counts and running job info."""
    total = await db.blog_posts.count_documents({})
    published = await db.blog_posts.count_documents({"status": "published"})
    draft = await db.blog_posts.count_documents({"status": "draft"})
    failed = await db.blog_posts.count_documents({"status": "failed"})
    running_jobs = await db.blog_jobs.count_documents({"status": "running"})

    return {
        "total": total,
        "published": published,
        "draft": draft,
        "failed": failed,
        "running_jobs": running_jobs,
        "available_cities": len(ALL_CITIES),
        "available_roles": len(ROLES),
        "page_types": PAGE_TYPES,
    }


@router.get("/admin/blog/posts")
async def list_blog_posts(
    request: Request,
    page: int = 1,
    limit: int = 20,
    q: Optional[str] = None,
    status: Optional[str] = None,
    page_type: Optional[str] = None,
    city: Optional[str] = None,
    role: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    """List blog posts with pagination, search, and filters."""
    query = {}

    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"slug": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
            {"role": {"$regex": q, "$options": "i"}},
        ]
    if status:
        query["status"] = status
    if page_type:
        query["page_type"] = page_type
    if city:
        query["city"] = city
    if role:
        query["role"] = role

    skip = (page - 1) * limit
    total = await db.blog_posts.count_documents(query)
    posts = await db.blog_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {
        "posts": posts,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
    }


@router.get("/admin/blog/posts/{post_id}")
async def get_blog_post(post_id: str, admin=Depends(get_current_admin)):
    """Get a single blog post by ID."""
    post = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return post


@router.put("/admin/blog/posts/{post_id}")
async def update_blog_post(post_id: str, request: Request, admin=Depends(get_current_admin)):
    """Update a blog post's editable fields."""
    post = await db.blog_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    body = await request.json()
    allowed_fields = {"title", "content", "slug", "status", "meta_title", "meta_description", "excerpt"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    if "content" in updates:
        updates["word_count"] = len(updates["content"].split())

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.blog_posts.update_one({"id": post_id}, {"$set": updates})
    updated = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    return updated


@router.delete("/admin/blog/posts/{post_id}")
async def delete_blog_post(post_id: str, admin=Depends(get_current_admin)):
    """Delete a blog post."""
    result = await db.blog_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {"deleted": True}


@router.post("/admin/blog/generate")
@limiter.limit("5/hour")
async def start_generation(request: Request, admin=Depends(get_current_admin)):
    """Start a batch blog post generation job."""
    body = await request.json()
    page_type = body.get("page_type")
    cities = body.get("cities", [])
    roles = body.get("roles", [])

    if not page_type or page_type not in PAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"page_type must be one of: {PAGE_TYPES}")
    if not cities:
        raise HTTPException(status_code=400, detail="At least one city is required")
    if not roles:
        raise HTTPException(status_code=400, detail="At least one role is required")

    # Validate cities and roles
    invalid_cities = [c for c in cities if c not in ALL_CITIES]
    if invalid_cities:
        raise HTTPException(status_code=400, detail=f"Invalid cities: {invalid_cities}")
    invalid_roles = [r for r in roles if r not in ROLES]
    if invalid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid roles: {invalid_roles}")

    total = len(cities) * len(roles)
    job_id = str(uuid.uuid4())

    job_doc = {
        "id": job_id,
        "page_type": page_type,
        "cities": cities,
        "roles": roles,
        "total": total,
        "completed": 0,
        "failed": 0,
        "skipped": 0,
        "status": "pending",
        "started_at": None,
        "completed_at": None,
        "error_log": [],
    }
    await db.blog_jobs.insert_one(job_doc)

    # Spawn background task
    asyncio.create_task(run_generation_job(job_id))

    return {"job_id": job_id, "total": total, "status": "pending"}


@router.get("/admin/blog/jobs")
async def list_generation_jobs(admin=Depends(get_current_admin)):
    """List all generation jobs, most recent first."""
    jobs = await db.blog_jobs.find({}, {"_id": 0}).sort("started_at", -1).to_list(length=100)
    return {"jobs": jobs}


@router.post("/admin/blog/jobs/{job_id}/cancel")
async def cancel_generation_job(job_id: str, admin=Depends(get_current_admin)):
    """Cancel a running generation job."""
    job = await db.blog_jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel job with status '{job['status']}'")

    # Signal the background task to stop
    _running_jobs[job_id] = False

    return {"cancelled": True, "job_id": job_id}


@router.post("/admin/blog/posts/{post_id}/publish")
async def publish_post(post_id: str, admin=Depends(get_current_admin)):
    """Publish a single blog post."""
    post = await db.blog_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.blog_posts.update_one(
        {"id": post_id},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}}
    )

    return {"published": True, "post_id": post_id, "published_at": now}


@router.post("/admin/blog/bulk-publish")
async def bulk_publish(request: Request, admin=Depends(get_current_admin)):
    """Publish multiple blog posts at once."""
    body = await request.json()
    post_ids = body.get("post_ids", [])

    if not post_ids:
        raise HTTPException(status_code=400, detail="post_ids is required and cannot be empty")

    now = datetime.now(timezone.utc).isoformat()
    result = await db.blog_posts.update_many(
        {"id": {"$in": post_ids}, "status": {"$ne": "published"}},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}}
    )

    return {"published_count": result.modified_count, "post_ids": post_ids}


# ==================== PUBLIC BLOG ENDPOINTS ====================

@router.get("/blog/posts")
@limiter.limit("30/minute")
async def public_list_posts(
    request: Request,
    page: int = 1,
    limit: int = 12,
    page_type: Optional[str] = None,
    city: Optional[str] = None,
    role: Optional[str] = None,
):
    """Public: list published blog posts with pagination and filters."""
    query = {"status": "published"}
    if page_type:
        query["page_type"] = page_type
    if city:
        query["city"] = city
    if role:
        query["role"] = role

    limit = min(limit, 50)  # Cap at 50 per page
    skip = (page - 1) * limit
    total = await db.blog_posts.count_documents(query)
    posts = await db.blog_posts.find(
        query,
        {"_id": 0, "content": 0, "generation_job_id": 0}  # Exclude full content from list
    ).sort("published_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {
        "posts": posts,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
    }


@router.get("/blog/posts/{slug}")
@limiter.limit("60/minute")
async def public_get_post(slug: str, request: Request):
    """Public: get a single published blog post by slug."""
    post = await db.blog_posts.find_one(
        {"slug": slug, "status": "published"},
        {"_id": 0, "generation_job_id": 0}
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Fetch related posts (same city or same role, max 3)
    related_query = {
        "status": "published",
        "slug": {"$ne": slug},
        "$or": [
            {"city": post.get("city"), "page_type": post.get("page_type")},
            {"role": post.get("role"), "page_type": post.get("page_type")},
        ]
    }
    related = await db.blog_posts.find(
        related_query,
        {"_id": 0, "content": 0, "generation_job_id": 0}
    ).limit(3).to_list(length=3)

    post["related_posts"] = related
    return post
