"""
Admin routes for Hireabble API.

Separate auth flow, user management, content moderation,
reports review, and platform analytics.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import uuid

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
