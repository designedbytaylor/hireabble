"""
Admin routes for Hireabble API.

Separate auth flow, user management, content moderation,
reports review, and platform analytics.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import random

from database import (
    db, logger,
    hash_password, verify_password, create_token, get_current_admin,
    AdminLogin, AdminCreate, ReportCreate, get_current_user,
)
from content_filter import check_text, BANNED_WORDS

router = APIRouter(tags=["Admin"])

# ==================== ADMIN AUTH (separate flow) ====================

@router.post("/admin/setup")
async def admin_setup(admin: AdminCreate):
    """One-time bootstrap: create the first admin. Only works when no admins exist."""
    count = await db.admin_users.count_documents({})
    if count > 0:
        raise HTTPException(status_code=403, detail="Admin already exists. Use /admin/login.")

    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "email": admin.email,
        "password": hash_password(admin.password),
        "name": admin.name,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_users.insert_one(admin_doc)
    token = create_token(admin_id, "admin")
    return {
        "message": "Admin account created",
        "token": token,
        "admin": {"id": admin_id, "email": admin.email, "name": admin.name, "role": "admin"},
    }

@router.post("/admin/login")
async def admin_login(credentials: AdminLogin):
    """Admin login — completely separate from user auth."""
    admin = await db.admin_users.find_one({"email": credentials.email})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not admin.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = create_token(admin["id"], "admin")
    return {
        "token": token,
        "admin": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["name"],
            "role": "admin",
        },
    }

@router.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    """Get current admin profile."""
    return admin

@router.post("/admin/change-password")
async def admin_change_password(payload: dict, admin: dict = Depends(get_current_admin)):
    """Change the current admin's password."""
    new_password = payload.get("new_password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await db.admin_users.update_one(
        {"id": admin["id"]},
        {"$set": {"password": hash_password(new_password)}}
    )
    return {"message": "Password updated successfully"}

# ==================== PLATFORM ANALYTICS ====================

@router.get("/admin/analytics")
async def get_analytics(admin: dict = Depends(get_current_admin)):
    """Platform-wide analytics for the admin dashboard."""
    total_users = await db.users.count_documents({})
    total_seekers = await db.users.count_documents({"role": "seeker"})
    total_recruiters = await db.users.count_documents({"role": "recruiter"})
    total_jobs = await db.jobs.count_documents({})
    active_jobs = await db.jobs.count_documents({"is_active": True})
    total_applications = await db.applications.count_documents({})
    total_matches = await db.matches.count_documents({})
    total_messages = await db.messages.count_documents({})
    banned_users = await db.users.count_documents({"status": "banned"})
    suspended_users = await db.users.count_documents({"status": "suspended"})
    pending_reports = await db.reports.count_documents({"status": "pending"})
    pending_moderation = await db.moderation_queue.count_documents({"status": "pending"})

    return {
        "users": {
            "total": total_users,
            "seekers": total_seekers,
            "recruiters": total_recruiters,
            "banned": banned_users,
            "suspended": suspended_users,
        },
        "jobs": {
            "total": total_jobs,
            "active": active_jobs,
        },
        "activity": {
            "applications": total_applications,
            "matches": total_matches,
            "messages": total_messages,
        },
        "moderation": {
            "pending_reports": pending_reports,
            "pending_moderation": pending_moderation,
        },
    }

# ==================== USER MANAGEMENT ====================

@router.get("/admin/users")
async def list_users(
    admin: dict = Depends(get_current_admin),
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    """List all platform users with search/filter/pagination."""
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
        ]

    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    users = await db.users.find(
        query, {"_id": 0, "password": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }

@router.get("/admin/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(get_current_admin)):
    """Get full detail of a specific user."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get related stats
    app_count = await db.applications.count_documents({"seeker_id": user_id})
    match_count = await db.matches.count_documents({
        "$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]
    })
    job_count = await db.jobs.count_documents({"recruiter_id": user_id})
    report_count = await db.reports.count_documents({"reported_id": user_id})

    return {
        **user,
        "stats": {
            "applications": app_count,
            "matches": match_count,
            "jobs_posted": job_count,
            "reports_against": report_count,
        },
    }

@router.put("/admin/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    body: dict,
    admin: dict = Depends(get_current_admin),
):
    """Ban, suspend, or reactivate a user."""
    new_status = body.get("status")
    reason = body.get("reason", "")
    if new_status not in ("active", "suspended", "banned"):
        raise HTTPException(status_code=400, detail="Status must be active, suspended, or banned")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "status": new_status,
            "status_reason": reason,
            "status_updated_at": datetime.now(timezone.utc).isoformat(),
            "status_updated_by": admin["id"],
        }},
    )

    logger.info(f"Admin {admin['id']} set user {user_id} status to {new_status}")
    return {"message": f"User status updated to {new_status}"}

# ==================== MODERATION QUEUE ====================

@router.get("/admin/moderation")
async def list_moderation_queue(
    admin: dict = Depends(get_current_admin),
    status: Optional[str] = "pending",
    page: int = 1,
    limit: int = 20,
):
    """List items in the moderation queue."""
    query = {}
    if status:
        query["status"] = status

    total = await db.moderation_queue.count_documents(query)
    skip = (page - 1) * limit
    items = await db.moderation_queue.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }

@router.put("/admin/moderation/{item_id}")
async def review_moderation_item(
    item_id: str,
    body: dict,
    admin: dict = Depends(get_current_admin),
):
    """Approve or reject a moderation queue item."""
    action = body.get("action")  # 'approve' or 'reject'
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be approve or reject")

    item = await db.moderation_queue.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Moderation item not found")

    await db.moderation_queue.update_one(
        {"id": item_id},
        {"$set": {
            "status": "approved" if action == "approve" else "rejected",
            "reviewed_by": admin["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # If rejected, take action on the content
    if action == "reject":
        content_type = item.get("content_type")
        content_id = item.get("content_id")
        if content_type == "job":
            await db.jobs.update_one({"id": content_id}, {"$set": {"is_active": False}})
        elif content_type == "user":
            await db.users.update_one({"id": content_id}, {"$set": {"status": "suspended"}})

    # If approved, unflag the content
    if action == "approve":
        content_type = item.get("content_type")
        content_id = item.get("content_id")
        if content_type == "job":
            await db.jobs.update_one({"id": content_id}, {"$set": {"is_flagged": False}})
        elif content_type == "user":
            await db.users.update_one({"id": content_id}, {"$set": {"is_flagged": False}})

    return {"message": f"Item {action}d"}

# ==================== REPORTS ====================

@router.post("/reports")
async def create_report(report: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Submit a report (available to all authenticated users)."""
    if report.reported_type not in ("user", "job", "message"):
        raise HTTPException(status_code=400, detail="reported_type must be user, job, or message")

    report_doc = {
        "id": str(uuid.uuid4()),
        "reporter_id": current_user["id"],
        "reporter_name": current_user["name"],
        "reported_type": report.reported_type,
        "reported_id": report.reported_id,
        "reason": report.reason,
        "details": report.details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reports.insert_one(report_doc)
    return {"message": "Report submitted", "id": report_doc["id"]}

@router.get("/admin/reports")
async def list_reports(
    admin: dict = Depends(get_current_admin),
    status: Optional[str] = "pending",
    reported_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    """List user-submitted reports."""
    query = {}
    if status:
        query["status"] = status
    if reported_type:
        query["reported_type"] = reported_type

    total = await db.reports.count_documents(query)
    skip = (page - 1) * limit
    reports = await db.reports.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "reports": reports,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }

@router.put("/admin/reports/{report_id}")
async def review_report(
    report_id: str,
    body: dict,
    admin: dict = Depends(get_current_admin),
):
    """Review and resolve a report."""
    action = body.get("action")  # 'dismiss', 'warn', 'suspend', 'ban'
    if action not in ("dismiss", "warn", "suspend", "ban"):
        raise HTTPException(status_code=400, detail="Action must be dismiss, warn, suspend, or ban")

    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.reports.update_one(
        {"id": report_id},
        {"$set": {
            "status": "resolved",
            "resolution": action,
            "resolved_by": admin["id"],
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Take action on the reported content/user
    if action in ("suspend", "ban"):
        reported_id = report.get("reported_id")
        reported_type = report.get("reported_type")
        if reported_type == "user":
            new_status = "suspended" if action == "suspend" else "banned"
            await db.users.update_one(
                {"id": reported_id},
                {"$set": {"status": new_status, "status_reason": f"Report: {report.get('reason', '')}"}},
            )
        elif reported_type == "job":
            await db.jobs.update_one({"id": reported_id}, {"$set": {"is_active": False}})

    return {"message": f"Report resolved with action: {action}"}

# ==================== CONTENT SETTINGS ====================

@router.get("/admin/banned-words")
async def get_banned_words(admin: dict = Depends(get_current_admin)):
    """Get the current banned words list by category."""
    # Return the built-in list plus any custom words from DB
    custom = await db.custom_banned_words.find({}, {"_id": 0}).to_list(1000)
    custom_by_category = {}
    for item in custom:
        cat = item.get("category", "custom")
        if cat not in custom_by_category:
            custom_by_category[cat] = []
        custom_by_category[cat].append(item["word"])

    result = {}
    for category, words in BANNED_WORDS.items():
        result[category] = list(words)
        if category in custom_by_category:
            result[category].extend(custom_by_category[category])

    if "custom" in custom_by_category:
        result["custom"] = custom_by_category["custom"]

    return result

@router.post("/admin/banned-words")
async def add_banned_word(body: dict, admin: dict = Depends(get_current_admin)):
    """Add a custom banned word."""
    word = body.get("word", "").strip().lower()
    category = body.get("category", "custom")
    if not word:
        raise HTTPException(status_code=400, detail="Word is required")

    existing = await db.custom_banned_words.find_one({"word": word})
    if existing:
        raise HTTPException(status_code=400, detail="Word already exists")

    await db.custom_banned_words.insert_one({
        "word": word,
        "category": category,
        "added_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": f"Added '{word}' to banned words"}

@router.delete("/admin/banned-words/{word}")
async def remove_banned_word(word: str, admin: dict = Depends(get_current_admin)):
    """Remove a custom banned word."""
    result = await db.custom_banned_words.delete_one({"word": word.lower()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom word not found")
    return {"message": f"Removed '{word}' from banned words"}

# ==================== ADMIN JOB MANAGEMENT ====================

@router.get("/admin/jobs")
async def list_all_jobs(
    admin: dict = Depends(get_current_admin),
    search: Optional[str] = None,
    is_flagged: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
):
    """List all jobs on the platform."""
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if is_flagged is not None:
        query["is_flagged"] = is_flagged

    total = await db.jobs.count_documents(query)
    skip = (page - 1) * limit
    jobs = await db.jobs.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "jobs": jobs,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }

@router.put("/admin/jobs/{job_id}/status")
async def admin_toggle_job(
    job_id: str,
    body: dict,
    admin: dict = Depends(get_current_admin),
):
    """Activate or deactivate a job listing."""
    is_active = body.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active is required")

    result = await db.jobs.update_one({"id": job_id}, {"$set": {"is_active": is_active}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")

    status_text = "activated" if is_active else "deactivated"
    return {"message": f"Job {status_text}"}


# ==================== IMPERSONATION ====================

@router.post("/admin/impersonate/{user_id}")
async def impersonate_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Generate a login token for any user (admin impersonation)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_token(user["id"], user["role"])
    logger.info(f"Admin {admin['id']} impersonating user {user_id} ({user['email']})")
    return {"token": token, "user": user}


# ==================== TEST DATA SEEDING ====================

SAMPLE_SEEKERS = [
    {"name": "Alex Chen", "title": "Senior Frontend Engineer", "bio": "Passionate about building beautiful, performant UIs. React enthusiast with a love for design systems.", "skills": ["React", "TypeScript", "Next.js", "Tailwind CSS", "GraphQL"], "experience_years": 6, "location": "San Francisco, CA", "school": "Stanford University", "degree": "bachelors", "current_employer": "Meta"},
    {"name": "Priya Patel", "title": "Full Stack Developer", "bio": "Building scalable web apps from database to deployment. Node.js and Python polyglot.", "skills": ["Node.js", "Python", "PostgreSQL", "AWS", "Docker", "React"], "experience_years": 4, "location": "New York, NY", "school": "NYU", "degree": "masters", "current_employer": "Stripe"},
    {"name": "Jordan Williams", "title": "Backend Engineer", "bio": "Distributed systems engineer focused on high-throughput data pipelines and microservices.", "skills": ["Go", "Kubernetes", "gRPC", "Redis", "Kafka", "PostgreSQL"], "experience_years": 7, "location": "Seattle, WA", "school": "University of Washington", "degree": "bachelors", "current_employer": "Amazon"},
    {"name": "Maya Rodriguez", "title": "Mobile Developer", "bio": "Cross-platform mobile dev with a focus on native performance and delightful UX.", "skills": ["React Native", "Swift", "Kotlin", "Firebase", "TypeScript"], "experience_years": 5, "location": "Austin, TX", "school": "UT Austin", "degree": "bachelors", "current_employer": "Shopify"},
    {"name": "Sam Johnson", "title": "DevOps Engineer", "bio": "Infrastructure as code advocate. Automating all the things with Terraform and CI/CD pipelines.", "skills": ["Terraform", "AWS", "Docker", "GitHub Actions", "Python", "Linux"], "experience_years": 8, "location": "Denver, CO", "school": "Colorado School of Mines", "degree": "bachelors", "current_employer": "HashiCorp"},
    {"name": "Emily Zhang", "title": "Data Engineer", "bio": "Turning raw data into actionable insights. Spark, Airflow, and modern data stack enthusiast.", "skills": ["Python", "Spark", "Airflow", "dbt", "SQL", "Snowflake"], "experience_years": 5, "location": "Chicago, IL", "school": "Northwestern", "degree": "masters", "current_employer": "Databricks"},
    {"name": "Marcus Thompson", "title": "ML Engineer", "bio": "Applied ML engineer shipping production models. Focus on NLP and recommendation systems.", "skills": ["Python", "PyTorch", "TensorFlow", "MLflow", "FastAPI", "SQL"], "experience_years": 4, "location": "San Francisco, CA", "school": "UC Berkeley", "degree": "masters", "current_employer": "OpenAI"},
    {"name": "Sofia Garcia", "title": "UI/UX Designer & Developer", "bio": "Design-engineer hybrid. I code what I design and design what I code.", "skills": ["Figma", "React", "CSS", "Framer Motion", "Storybook", "A/B Testing"], "experience_years": 6, "location": "Los Angeles, CA", "school": "ArtCenter", "degree": "bachelors", "current_employer": "Airbnb"},
    {"name": "David Kim", "title": "Security Engineer", "bio": "AppSec and infrastructure security. Pen tester turned defensive security builder.", "skills": ["Python", "AWS Security", "OWASP", "Kubernetes", "Go", "Burp Suite"], "experience_years": 7, "location": "Remote", "school": "Georgia Tech", "degree": "masters", "current_employer": "CrowdStrike"},
    {"name": "Rachel O'Brien", "title": "Junior Full Stack Developer", "bio": "Bootcamp grad eager to learn and grow. Built 5 full stack projects. Ready for the next challenge!", "skills": ["JavaScript", "React", "Node.js", "MongoDB", "HTML/CSS"], "experience_years": 1, "location": "Portland, OR", "school": "Hack Reactor", "degree": "certificate", "current_employer": "Freelance"},
]

SAMPLE_COMPANIES = [
    {"name": "TechVision Labs", "description": "AI-first startup building the future of computer vision for autonomous vehicles."},
    {"name": "CloudScale Inc", "description": "Enterprise cloud infrastructure platform serving Fortune 500 companies."},
    {"name": "GreenStack", "description": "Climate tech company using software to accelerate the clean energy transition."},
    {"name": "FinFlow", "description": "Next-gen fintech making payment processing seamless for global businesses."},
    {"name": "HealthBridge", "description": "Digital health platform connecting patients with personalized care."},
]

SAMPLE_JOBS = [
    {"title": "Senior React Developer", "description": "Join our frontend team building a next-gen dashboard used by millions. You'll architect component systems, optimize performance, and mentor junior devs.", "requirements": ["React", "TypeScript", "5+ years experience", "Design systems"], "salary_min": 150000, "salary_max": 200000, "location": "San Francisco, CA", "job_type": "hybrid", "experience_level": "senior"},
    {"title": "Backend Engineer (Go)", "description": "Build high-throughput microservices for our real-time data platform. You'll work with distributed systems at scale.", "requirements": ["Go", "Kubernetes", "PostgreSQL", "3+ years experience"], "salary_min": 140000, "salary_max": 190000, "location": "Remote", "job_type": "remote", "experience_level": "mid"},
    {"title": "Full Stack Developer", "description": "Own features end-to-end, from database schema to pixel-perfect UI. Fast-paced startup environment with lots of autonomy.", "requirements": ["React", "Node.js", "PostgreSQL", "AWS"], "salary_min": 120000, "salary_max": 170000, "location": "New York, NY", "job_type": "onsite", "experience_level": "mid"},
    {"title": "Mobile Engineer (React Native)", "description": "Build our flagship mobile app used by 500K+ users. Focus on native performance, offline support, and smooth animations.", "requirements": ["React Native", "TypeScript", "iOS/Android", "4+ years"], "salary_min": 140000, "salary_max": 185000, "location": "Austin, TX", "job_type": "hybrid", "experience_level": "senior"},
    {"title": "DevOps / SRE Engineer", "description": "Design and maintain our infrastructure on AWS. Implement CI/CD, monitoring, and incident response for 99.99% uptime.", "requirements": ["AWS", "Terraform", "Docker", "Kubernetes", "5+ years"], "salary_min": 155000, "salary_max": 210000, "location": "Seattle, WA", "job_type": "remote", "experience_level": "senior"},
    {"title": "Data Engineer", "description": "Build data pipelines that process terabytes daily. Work with our analytics and ML teams to power data-driven decisions.", "requirements": ["Python", "Spark", "Airflow", "SQL", "3+ years"], "salary_min": 130000, "salary_max": 180000, "location": "Chicago, IL", "job_type": "hybrid", "experience_level": "mid"},
    {"title": "ML Engineer", "description": "Ship production ML models for our recommendation engine. Collaborate with research to bring cutting-edge papers to production.", "requirements": ["Python", "PyTorch", "MLOps", "SQL", "4+ years"], "salary_min": 160000, "salary_max": 220000, "location": "San Francisco, CA", "job_type": "hybrid", "experience_level": "senior"},
    {"title": "Junior Software Engineer", "description": "Great opportunity for early-career engineers! Supportive team, strong mentorship, and real-world projects from day one.", "requirements": ["JavaScript or Python", "CS fundamentals", "Eagerness to learn"], "salary_min": 80000, "salary_max": 110000, "location": "Denver, CO", "job_type": "onsite", "experience_level": "entry"},
    {"title": "Engineering Manager", "description": "Lead a team of 6-8 engineers building our core platform. Balance technical leadership with people development.", "requirements": ["5+ years engineering", "2+ years management", "System design"], "salary_min": 180000, "salary_max": 250000, "location": "Remote", "job_type": "remote", "experience_level": "lead"},
    {"title": "Security Engineer", "description": "Own application security for our fintech platform. Conduct security reviews, build tooling, and drive security culture.", "requirements": ["AppSec", "Python or Go", "OWASP", "Cloud security", "5+ years"], "salary_min": 160000, "salary_max": 215000, "location": "New York, NY", "job_type": "hybrid", "experience_level": "senior"},
]


@router.post("/admin/seed-test-data")
async def seed_test_data(body: dict = {}, admin: dict = Depends(get_current_admin)):
    """
    Seed the platform with realistic test data.
    Optional body: { "seekers": 10, "recruiters": 5, "jobs_per_recruiter": 2, "applications_per_seeker": 3 }
    """
    num_seekers = body.get("seekers", 10)
    num_recruiters = body.get("recruiters", 5)
    jobs_per_recruiter = body.get("jobs_per_recruiter", 2)
    apps_per_seeker = body.get("applications_per_seeker", 3)

    created_seekers = []
    created_recruiters = []
    created_jobs = []
    created_applications = []
    created_matches = []
    password = hash_password("testpass123")

    # Create seekers
    for i in range(min(num_seekers, len(SAMPLE_SEEKERS))):
        s = SAMPLE_SEEKERS[i]
        user_id = str(uuid.uuid4())
        email = f"seeker{i+1}@test.hireabble.com"

        existing = await db.users.find_one({"email": email})
        if existing:
            created_seekers.append(existing)
            continue

        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}"
        user_doc = {
            "id": user_id, "email": email, "password": password,
            "name": s["name"], "role": "seeker", "company": None,
            "avatar": avatar, "photo_url": None, "video_url": None,
            "title": s["title"], "bio": s["bio"], "skills": s["skills"],
            "experience_years": s["experience_years"], "location": s["location"],
            "current_employer": s.get("current_employer"),
            "previous_employers": [], "school": s.get("school"),
            "degree": s.get("degree"), "certifications": [],
            "work_preference": random.choice(["remote", "hybrid", "onsite"]),
            "desired_salary": random.randint(80, 200) * 1000,
            "available_immediately": random.choice([True, False]),
            "onboarding_complete": True, "push_subscription": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat(),
        }
        await db.users.insert_one(user_doc)
        created_seekers.append(user_doc)

    # Create recruiters
    for i in range(num_recruiters):
        company = SAMPLE_COMPANIES[i % len(SAMPLE_COMPANIES)]
        user_id = str(uuid.uuid4())
        email = f"recruiter{i+1}@test.hireabble.com"

        existing = await db.users.find_one({"email": email})
        if existing:
            created_recruiters.append(existing)
            continue

        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}"
        user_doc = {
            "id": user_id, "email": email, "password": password,
            "name": f"{company['name']} Recruiting", "role": "recruiter",
            "company": company["name"], "avatar": avatar,
            "photo_url": None, "video_url": None, "title": "Talent Acquisition",
            "bio": company["description"], "skills": [], "experience_years": None,
            "location": random.choice(["San Francisco, CA", "New York, NY", "Remote"]),
            "current_employer": None, "previous_employers": [],
            "school": None, "degree": None, "certifications": [],
            "work_preference": None, "desired_salary": None,
            "available_immediately": True, "onboarding_complete": True,
            "push_subscription": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 90))).isoformat(),
        }
        await db.users.insert_one(user_doc)
        created_recruiters.append(user_doc)

    # Create jobs
    for recruiter in created_recruiters:
        available_jobs = list(SAMPLE_JOBS)
        random.shuffle(available_jobs)
        for j in range(min(jobs_per_recruiter, len(available_jobs))):
            job_data = available_jobs[j]
            job_id = str(uuid.uuid4())
            logo = f"https://api.dicebear.com/7.x/shapes/svg?seed={recruiter.get('company', 'co')}{j}"
            bg = f"https://picsum.photos/seed/{job_id}/800/400"
            job_doc = {
                "id": job_id,
                "recruiter_id": recruiter["id"],
                "recruiter_name": recruiter["name"],
                **job_data,
                "company": recruiter.get("company", "Test Company"),
                "company_logo": logo,
                "background_image": bg,
                "is_active": True,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))).isoformat(),
            }
            await db.jobs.insert_one(job_doc)
            created_jobs.append(job_doc)

    # Create applications (seekers applying to jobs)
    for seeker in created_seekers:
        available_jobs = list(created_jobs)
        random.shuffle(available_jobs)
        for j in range(min(apps_per_seeker, len(available_jobs))):
            job = available_jobs[j]
            # Check for existing application
            existing_app = await db.applications.find_one({
                "seeker_id": seeker["id"], "job_id": job["id"]
            })
            if existing_app:
                continue

            app_id = str(uuid.uuid4())
            action = random.choices(["like", "superlike"], weights=[0.7, 0.3])[0]
            app_doc = {
                "id": app_id,
                "job_id": job["id"],
                "recruiter_id": job["recruiter_id"],
                "seeker_id": seeker["id"],
                "seeker_name": seeker["name"],
                "seeker_title": seeker.get("title"),
                "seeker_skills": seeker.get("skills", []),
                "seeker_avatar": seeker.get("avatar"),
                "seeker_photo": seeker.get("photo_url"),
                "seeker_video": seeker.get("video_url"),
                "seeker_experience": seeker.get("experience_years"),
                "seeker_school": seeker.get("school"),
                "seeker_degree": seeker.get("degree"),
                "seeker_location": seeker.get("location"),
                "seeker_current_employer": seeker.get("current_employer"),
                "action": action,
                "is_matched": False,
                "recruiter_action": None,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 14))).isoformat(),
            }
            await db.applications.insert_one(app_doc)
            created_applications.append(app_doc)

    # Create some matches (randomly accept some applications)
    apps_to_match = random.sample(
        created_applications,
        min(len(created_applications) // 3, len(created_applications))
    )
    for app in apps_to_match:
        job = await db.jobs.find_one({"id": app["job_id"]}, {"_id": 0})
        if not job:
            continue

        await db.applications.update_one(
            {"id": app["id"]},
            {"$set": {"is_matched": True, "recruiter_action": "accept"}}
        )

        match_id = str(uuid.uuid4())
        match_doc = {
            "id": match_id,
            "job_id": app["job_id"],
            "job_title": job.get("title", ""),
            "company": job.get("company", ""),
            "seeker_id": app["seeker_id"],
            "seeker_name": app["seeker_name"],
            "seeker_avatar": app.get("seeker_avatar"),
            "recruiter_id": job["recruiter_id"],
            "recruiter_name": job.get("recruiter_name", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.matches.insert_one(match_doc)
        created_matches.append(match_doc)

    return {
        "message": "Test data seeded successfully!",
        "summary": {
            "seekers_created": len(created_seekers),
            "recruiters_created": len(created_recruiters),
            "jobs_created": len(created_jobs),
            "applications_created": len(created_applications),
            "matches_created": len(created_matches),
        },
        "test_credentials": {
            "password": "testpass123",
            "seeker_emails": [f"seeker{i+1}@test.hireabble.com" for i in range(min(num_seekers, len(SAMPLE_SEEKERS)))],
            "recruiter_emails": [f"recruiter{i+1}@test.hireabble.com" for i in range(num_recruiters)],
        }
    }


@router.delete("/admin/clear-test-data")
async def clear_test_data(admin: dict = Depends(get_current_admin)):
    """Remove all test data (users with @test.hireabble.com emails and their related data)."""
    # Find test users
    test_users = await db.users.find(
        {"email": {"$regex": r"@test\.hireabble\.com$"}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    test_user_ids = [u["id"] for u in test_users]

    if not test_user_ids:
        return {"message": "No test data found", "deleted": {}}

    # Delete related data
    apps_del = await db.applications.delete_many({"$or": [
        {"seeker_id": {"$in": test_user_ids}},
        {"recruiter_id": {"$in": test_user_ids}},
    ]})
    matches_del = await db.matches.delete_many({"$or": [
        {"seeker_id": {"$in": test_user_ids}},
        {"recruiter_id": {"$in": test_user_ids}},
    ]})
    jobs_del = await db.jobs.delete_many({"recruiter_id": {"$in": test_user_ids}})
    interviews_del = await db.interviews.delete_many({"$or": [
        {"seeker_id": {"$in": test_user_ids}},
        {"recruiter_id": {"$in": test_user_ids}},
    ]})
    messages_del = await db.messages.delete_many({"sender_id": {"$in": test_user_ids}})
    notif_del = await db.notifications.delete_many({"user_id": {"$in": test_user_ids}})
    users_del = await db.users.delete_many({"id": {"$in": test_user_ids}})

    return {
        "message": "Test data cleared",
        "deleted": {
            "users": users_del.deleted_count,
            "jobs": jobs_del.deleted_count,
            "applications": apps_del.deleted_count,
            "matches": matches_del.deleted_count,
            "interviews": interviews_del.deleted_count,
            "messages": messages_del.deleted_count,
            "notifications": notif_del.deleted_count,
        }
    }
