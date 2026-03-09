"""
Admin routes for Hireabble API.

Separate auth flow, user management, content moderation,
reports review, and platform analytics.
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import random
import asyncio

from database import (
    db, logger, manager, create_notification,
    hash_password, verify_password, create_token, get_current_admin,
    AdminLogin, AdminCreate, ReportCreate, get_current_user, JobCreate,
)
from content_filter import check_text, BANNED_WORDS
from cache import invalidate_user

router = APIRouter(tags=["Admin"])

# ==================== ADMIN AUTH (separate flow) ====================

@router.post("/admin/temp-reset")
async def temp_reset():
    """TEMPORARY: one-time password reset. Remove after use."""
    result = await db.admin_users.update_one(
        {"email": "taylor@hireabble.com"},
        {"$set": {"password": hash_password("Taylor2024!")}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": "Password reset to Taylor2024!"}

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
    # Run all count queries in parallel for speed
    (
        total_users, total_seekers, total_recruiters,
        total_jobs, active_jobs,
        total_applications, total_matches, total_messages,
        banned_users, suspended_users,
        pending_reports, pending_moderation,
    ) = await asyncio.gather(
        db.users.count_documents({}),
        db.users.count_documents({"role": "seeker"}),
        db.users.count_documents({"role": "recruiter"}),
        db.jobs.count_documents({}),
        db.jobs.count_documents({"is_active": True}),
        db.applications.count_documents({}),
        db.matches.count_documents({}),
        db.messages.count_documents({}),
        db.users.count_documents({"status": "banned"}),
        db.users.count_documents({"status": "suspended"}),
        db.reports.count_documents({"status": "pending"}),
        db.moderation_queue.count_documents({"status": "pending"}),
    )

    # Growth data - all 14 days in parallel
    growth_tasks = []
    growth_days = []
    for i in range(13, -1, -1):
        day = datetime.now(timezone.utc) - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = (day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
        date_filter = {"$gte": day_start, "$lt": day_end}
        growth_days.append(day.strftime("%b %d"))
        growth_tasks.extend([
            db.users.count_documents({"created_at": date_filter}),
            db.applications.count_documents({"created_at": date_filter}),
            db.matches.count_documents({"created_at": date_filter}),
        ])

    growth_results = await asyncio.gather(*growth_tasks)
    growth_data = []
    for idx in range(14):
        base = idx * 3
        growth_data.append({
            "date": growth_days[idx],
            "users": growth_results[base],
            "applications": growth_results[base + 1],
            "matches": growth_results[base + 2],
        })

    # Top locations + job type distribution in parallel
    locations_pipeline = [
        {"$match": {"location": {"$ne": None, "$ne": ""}}},
        {"$group": {"_id": "$location", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]

    job_type_counts, top_locations_cursor = await asyncio.gather(
        asyncio.gather(
            db.jobs.count_documents({"job_type": "remote", "is_active": True}),
            db.jobs.count_documents({"job_type": "onsite", "is_active": True}),
            db.jobs.count_documents({"job_type": "hybrid", "is_active": True}),
        ),
        db.users.aggregate(locations_pipeline).to_list(8),
    )

    top_locations = [{"location": doc["_id"], "count": doc["count"]} for doc in top_locations_cursor]
    job_types = {"remote": job_type_counts[0], "onsite": job_type_counts[1], "hybrid": job_type_counts[2]}

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
        "growth": growth_data,
        "top_locations": top_locations,
        "job_types": job_types,
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

    # Get related stats in parallel
    app_count, match_count, job_count, report_count = await asyncio.gather(
        db.applications.count_documents({"seeker_id": user_id}),
        db.matches.count_documents({"$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]}),
        db.jobs.count_documents({"recruiter_id": user_id}),
        db.reports.count_documents({"reported_id": user_id}),
    )

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
        elif content_type == "media":
            # Remove the flagged media
            media = await db.media_uploads.find_one({"id": content_id})
            if media:
                await db.media_uploads.update_one(
                    {"id": content_id},
                    {"$set": {"status": "removed", "reviewed_by": admin["id"],
                              "reviewed_at": datetime.now(timezone.utc).isoformat()}}
                )
                # Clear from user profile
                user_id = media.get("user_id")
                category = media.get("category")
                url = media.get("url")
                if category == "profile_photo":
                    user = await db.users.find_one({"id": user_id})
                    if user and user.get("photo_url") == url:
                        await db.users.update_one({"id": user_id}, {"$set": {"photo_url": None}})
                elif category == "video_intro":
                    user = await db.users.find_one({"id": user_id})
                    if user and user.get("video_url") == url:
                        await db.users.update_one({"id": user_id}, {"$set": {"video_url": None}})
                # Notify user and issue strike
                await create_notification(
                    user_id=user_id, notif_type="moderation",
                    title="Content Removed",
                    message=f"Your uploaded {media.get('media_type', 'content')} was removed for violating community guidelines.",
                    data={"media_id": content_id}
                )
                await db.users.update_one({"id": user_id}, {"$inc": {"strikes": 1}})

    # If approved, unflag the content
    if action == "approve":
        content_type = item.get("content_type")
        content_id = item.get("content_id")
        if content_type == "job":
            await db.jobs.update_one({"id": content_id}, {"$set": {"is_flagged": False}})
        elif content_type == "user":
            await db.users.update_one({"id": content_id}, {"$set": {"is_flagged": False}})
        elif content_type == "media":
            await db.media_uploads.update_one(
                {"id": content_id},
                {"$set": {"status": "approved", "flagged": False, "reviewed_by": admin["id"],
                          "reviewed_at": datetime.now(timezone.utc).isoformat()}}
            )

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


@router.post("/admin/jobs")
async def admin_create_job(job: JobCreate, admin: dict = Depends(get_current_admin)):
    """Admin can post a job directly on behalf of the platform."""
    job_id = str(uuid.uuid4())

    backgrounds = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    ]

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
        "location_restriction": job.location_restriction,
        "recruiter_id": f"admin:{admin['id']}",
        "recruiter_name": admin["name"],
        "company_logo": f"https://api.dicebear.com/7.x/identicon/svg?seed={job.company}",
        "background_image": backgrounds[hash(job_id) % len(backgrounds)],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }

    await db.jobs.insert_one(job_doc)
    return {k: v for k, v in job_doc.items() if k != "_id"}


@router.get("/admin/jobs/{job_id}")
async def admin_get_job_detail(job_id: str, admin: dict = Depends(get_current_admin)):
    """Get full job details for admin review."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get poster info
    poster = None
    if job.get("recruiter_id"):
        poster = await db.users.find_one(
            {"id": job["recruiter_id"]},
            {"_id": 0, "password": 0}
        )

    # Get application count
    app_count = await db.applications.count_documents({"job_id": job_id})

    return {
        "job": job,
        "poster": poster,
        "application_count": app_count,
    }


@router.delete("/admin/jobs/{job_id}")
async def admin_delete_job(
    job_id: str,
    admin: dict = Depends(get_current_admin),
    body: dict = Body(default=None),
):
    """Remove a job for policy violation, issue a strike, and notify the poster."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    reason = (body or {}).get("reason", "Community guideline violation")

    # Delete the job
    await db.jobs.delete_one({"id": job_id})

    # Issue a strike to the poster
    recruiter_id = job.get("recruiter_id")
    if recruiter_id:
        # Increment strike count
        await db.users.update_one(
            {"id": recruiter_id},
            {"$inc": {"strikes": 1}},
        )

        # Fetch updated user to check strike count
        user = await db.users.find_one({"id": recruiter_id}, {"_id": 0})
        strike_count = user.get("strikes", 1) if user else 1

        # Notify the poster
        await create_notification(
            user_id=recruiter_id,
            notif_type="warning",
            title="Job Post Removed",
            message=f"Your job post \"{job.get('title', 'Untitled')}\" was removed due to community guideline violations. Reason: {reason}. You have {strike_count}/3 strike(s).",
            data={"job_id": job_id, "strikes": strike_count}
        )

        # Send real-time notification via WebSocket
        await manager.send_to_user(recruiter_id, {
            "type": "job_removed",
            "job_title": job.get("title"),
            "reason": reason,
            "strikes": strike_count,
        })

        # Auto-ban at 3 strikes
        if strike_count >= 3:
            await db.users.update_one(
                {"id": recruiter_id},
                {"$set": {
                    "status": "banned",
                    "status_reason": "Banned after 3 community guideline violations",
                    "status_updated_at": datetime.now(timezone.utc).isoformat(),
                    "status_updated_by": admin["id"],
                }},
            )
            await create_notification(
                user_id=recruiter_id,
                notif_type="warning",
                title="Account Banned",
                message="Your account has been banned after 3 community guideline violations.",
                data={"strikes": strike_count}
            )
            return {"message": "Job removed. User has been banned (3 strikes).", "strikes": strike_count, "banned": True}

    return {"message": "Job removed and poster notified.", "strikes": strike_count if recruiter_id else 0, "banned": False}


# ==================== MEDIA MODERATION ====================

@router.get("/admin/media")
async def list_media_uploads(
    admin: dict = Depends(get_current_admin),
    status: Optional[str] = None,
    media_type: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    page: int = 1,
    limit: int = 30,
):
    """Browse all uploaded media (images and videos) in the system."""
    query = {}
    if status:
        query["status"] = status
    if media_type:
        query["media_type"] = media_type
    if category:
        query["category"] = category
    if user_id:
        query["user_id"] = user_id

    total = await db.media_uploads.count_documents(query)
    skip = (page - 1) * limit
    items = await db.media_uploads.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/admin/media/stats")
async def media_stats(admin: dict = Depends(get_current_admin)):
    """Get media upload statistics."""
    total = await db.media_uploads.count_documents({})
    flagged = await db.media_uploads.count_documents({"status": "flagged"})
    approved = await db.media_uploads.count_documents({"status": "approved"})
    removed = await db.media_uploads.count_documents({"status": "removed"})
    images = await db.media_uploads.count_documents({"media_type": "image"})
    videos = await db.media_uploads.count_documents({"media_type": "video"})

    return {
        "total": total,
        "flagged": flagged,
        "approved": approved,
        "removed": removed,
        "images": images,
        "videos": videos,
    }


@router.put("/admin/media/{media_id}/remove")
async def remove_media(media_id: str, body: dict = {}, admin: dict = Depends(get_current_admin)):
    """Remove an uploaded media item (set status to removed, clear from user profile)."""
    media = await db.media_uploads.find_one({"id": media_id})
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    reason = body.get("reason", "Removed by admin")

    # Mark as removed in media_uploads
    await db.media_uploads.update_one(
        {"id": media_id},
        {"$set": {
            "status": "removed",
            "reviewed_by": admin["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "removal_reason": reason,
        }}
    )

    # Clear the URL from the user's profile
    user_id = media.get("user_id")
    category = media.get("category")
    url = media.get("url")

    if category == "profile_photo":
        # Only clear if this is still the current photo
        user = await db.users.find_one({"id": user_id})
        if user and user.get("photo_url") == url:
            await db.users.update_one({"id": user_id}, {"$set": {"photo_url": None}})
    elif category == "video_intro":
        user = await db.users.find_one({"id": user_id})
        if user and user.get("video_url") == url:
            await db.users.update_one({"id": user_id}, {"$set": {"video_url": None}})

    # Notify the user
    await create_notification(
        user_id=user_id,
        notif_type="moderation",
        title="Content Removed",
        message=f"Your uploaded {media.get('media_type', 'content')} was removed for: {reason}",
        data={"media_id": media_id}
    )

    # Issue a strike
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"strikes": 1}}
    )

    logger.info(f"Admin {admin['id']} removed media {media_id} from user {user_id}: {reason}")
    return {"message": "Media removed", "media_id": media_id}


@router.put("/admin/media/{media_id}/approve")
async def approve_media(media_id: str, admin: dict = Depends(get_current_admin)):
    """Approve a flagged media item."""
    result = await db.media_uploads.update_one(
        {"id": media_id},
        {"$set": {
            "status": "approved",
            "flagged": False,
            "reviewed_by": admin["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Media not found")

    # Also approve any related moderation queue items
    media = await db.media_uploads.find_one({"id": media_id}, {"_id": 0})
    if media:
        await db.moderation_queue.update_many(
            {"content_id": media_id, "content_type": "media"},
            {"$set": {"status": "approved", "reviewed_by": admin["id"],
                      "reviewed_at": datetime.now(timezone.utc).isoformat()}}
        )

    return {"message": "Media approved"}


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

_FIRST_NAMES = [
    "Alex", "Priya", "Jordan", "Maya", "Sam", "Emily", "Marcus", "Sofia", "David", "Rachel",
    "Liam", "Ava", "Noah", "Mia", "Ethan", "Zoe", "Lucas", "Chloe", "Oliver", "Harper",
    "Aiden", "Ella", "James", "Aria", "Leo", "Luna", "Henry", "Isla", "Owen", "Riley",
    "Kai", "Nora", "Jack", "Lily", "Ryan", "Grace", "Caleb", "Stella", "Max", "Violet",
    "Dylan", "Layla", "Asher", "Willow", "Wyatt", "Aurora", "Carter", "Hazel", "Jaxon", "Ivy",
]
_LAST_NAMES = [
    "Chen", "Patel", "Williams", "Rodriguez", "Johnson", "Zhang", "Thompson", "Garcia", "Kim", "O'Brien",
    "Nakamura", "Santos", "Murphy", "Nguyen", "Cohen", "Park", "Singh", "Larsen", "Okafor", "Rivera",
    "Foster", "Tanaka", "Bell", "Ahmad", "Cruz", "Hayes", "Ito", "Morgan", "Das", "Campbell",
    "Reyes", "Barnes", "Cho", "Ellis", "Fernandez", "Grant", "Huang", "Jensen", "Kang", "Lopez",
    "Martin", "Nelson", "Ortiz", "Phillips", "Quinn", "Ross", "Shaw", "Torres", "Ueda", "Vargas",
]
_SEEKER_PROFILES = [
    {"title": "Senior Frontend Engineer", "bio": "Passionate about building beautiful, performant UIs. React enthusiast with a love for design systems.", "skills": ["React", "TypeScript", "Next.js", "Tailwind CSS", "GraphQL"], "experience_years": 6, "school": "Stanford University", "degree": "bachelors", "current_employer": "Meta"},
    {"title": "Full Stack Developer", "bio": "Building scalable web apps from database to deployment. Node.js and Python polyglot.", "skills": ["Node.js", "Python", "PostgreSQL", "AWS", "Docker", "React"], "experience_years": 4, "school": "NYU", "degree": "masters", "current_employer": "Stripe"},
    {"title": "Backend Engineer", "bio": "Distributed systems engineer focused on high-throughput data pipelines and microservices.", "skills": ["Go", "Kubernetes", "gRPC", "Redis", "Kafka", "PostgreSQL"], "experience_years": 7, "school": "University of Washington", "degree": "bachelors", "current_employer": "Amazon"},
    {"title": "Mobile Developer", "bio": "Cross-platform mobile dev with a focus on native performance and delightful UX.", "skills": ["React Native", "Swift", "Kotlin", "Firebase", "TypeScript"], "experience_years": 5, "school": "UT Austin", "degree": "bachelors", "current_employer": "Shopify"},
    {"title": "DevOps Engineer", "bio": "Infrastructure as code advocate. Automating all the things with Terraform and CI/CD pipelines.", "skills": ["Terraform", "AWS", "Docker", "GitHub Actions", "Python", "Linux"], "experience_years": 8, "school": "Colorado School of Mines", "degree": "bachelors", "current_employer": "HashiCorp"},
    {"title": "Data Engineer", "bio": "Turning raw data into actionable insights. Spark, Airflow, and modern data stack enthusiast.", "skills": ["Python", "Spark", "Airflow", "dbt", "SQL", "Snowflake"], "experience_years": 5, "school": "Northwestern", "degree": "masters", "current_employer": "Databricks"},
    {"title": "ML Engineer", "bio": "Applied ML engineer shipping production models. Focus on NLP and recommendation systems.", "skills": ["Python", "PyTorch", "TensorFlow", "MLflow", "FastAPI", "SQL"], "experience_years": 4, "school": "UC Berkeley", "degree": "masters", "current_employer": "OpenAI"},
    {"title": "UI/UX Designer & Developer", "bio": "Design-engineer hybrid. I code what I design and design what I code.", "skills": ["Figma", "React", "CSS", "Framer Motion", "Storybook", "A/B Testing"], "experience_years": 6, "school": "ArtCenter", "degree": "bachelors", "current_employer": "Airbnb"},
    {"title": "Security Engineer", "bio": "AppSec and infrastructure security. Pen tester turned defensive security builder.", "skills": ["Python", "AWS Security", "OWASP", "Kubernetes", "Go", "Burp Suite"], "experience_years": 7, "school": "Georgia Tech", "degree": "masters", "current_employer": "CrowdStrike"},
    {"title": "Junior Full Stack Developer", "bio": "Bootcamp grad eager to learn and grow. Built 5 full stack projects. Ready for the next challenge!", "skills": ["JavaScript", "React", "Node.js", "MongoDB", "HTML/CSS"], "experience_years": 1, "school": "Hack Reactor", "degree": "certificate", "current_employer": "Freelance"},
]
_LOCATIONS = ["San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX", "Denver, CO", "Chicago, IL", "Los Angeles, CA", "Portland, OR", "Remote", "Boston, MA", "Miami, FL", "Atlanta, GA"]
_COMPANY_NAMES = [
    "TechVision", "CloudScale", "GreenStack", "FinFlow", "HealthBridge",
    "DataPulse", "NovaSoft", "Quantum", "SkyLabs", "CodeForge",
    "ByteWave", "NexGen", "Synapse", "Arclight", "VeloCity",
]
_COMPANY_SUFFIXES = ["Labs", "Inc", "AI", "Tech", "Systems", "Digital", "Solutions", "HQ", "Co", "Studio"]
_COMPANY_DESCRIPTIONS = [
    "AI-first startup building the future of computer vision for autonomous vehicles.",
    "Enterprise cloud infrastructure platform serving Fortune 500 companies.",
    "Climate tech company using software to accelerate the clean energy transition.",
    "Next-gen fintech making payment processing seamless for global businesses.",
    "Digital health platform connecting patients with personalized care.",
    "Data analytics company helping businesses unlock insights from real-time data.",
    "Developer tools company making engineering teams more productive.",
    "Cybersecurity platform protecting modern cloud-native applications.",
    "EdTech startup reimagining how people learn technical skills.",
    "Marketplace platform connecting creators with global audiences.",
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


def _generate_unique_name(used_names: set) -> str:
    """Generate a random unique first+last name combination."""
    for _ in range(200):
        name = f"{random.choice(_FIRST_NAMES)} {random.choice(_LAST_NAMES)}"
        if name not in used_names:
            used_names.add(name)
            return name
    # Fallback: add random digits
    name = f"{random.choice(_FIRST_NAMES)} {random.choice(_LAST_NAMES)}{random.randint(10, 99)}"
    used_names.add(name)
    return name


def _generate_unique_company(used_companies: set) -> dict:
    """Generate a random unique company name and description."""
    for _ in range(200):
        name = f"{random.choice(_COMPANY_NAMES)} {random.choice(_COMPANY_SUFFIXES)}"
        if name not in used_companies:
            used_companies.add(name)
            return {"name": name, "description": random.choice(_COMPANY_DESCRIPTIONS)}
    name = f"{random.choice(_COMPANY_NAMES)}{random.randint(10, 99)} {random.choice(_COMPANY_SUFFIXES)}"
    used_companies.add(name)
    return {"name": name, "description": random.choice(_COMPANY_DESCRIPTIONS)}


@router.post("/admin/seed-test-data")
async def seed_test_data(body: dict = {}, admin: dict = Depends(get_current_admin)):
    """
    Seed the platform with realistic test data.
    Optional body: { "seekers": 10, "recruiters": 5, "jobs_per_recruiter": 2 }
    Pass "create_applications": true to also generate sample applications (default: fresh accounts with 0 applied).
    """
    num_seekers = body.get("seekers", 10)
    num_recruiters = body.get("recruiters", 5)
    jobs_per_recruiter = body.get("jobs_per_recruiter", 2)
    apps_per_seeker = body.get("applications_per_seeker", 0)

    created_seekers = []
    created_recruiters = []
    created_jobs = []
    created_applications = []
    created_matches = []
    password = hash_password("testpass123")
    used_names = set()
    used_companies = set()

    # Always clear old test data first so we get fresh accounts every time
    old_test_users = await db.users.find(
        {"email": {"$regex": r"@test\.hireabble\.com$"}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    old_ids = [u["id"] for u in old_test_users]
    if old_ids:
        await db.users.delete_many({"id": {"$in": old_ids}})
        await db.applications.delete_many({"$or": [{"seeker_id": {"$in": old_ids}}, {"recruiter_id": {"$in": old_ids}}]})
        await db.jobs.delete_many({"recruiter_id": {"$in": old_ids}})
        await db.matches.delete_many({"$or": [{"seeker_id": {"$in": old_ids}}, {"recruiter_id": {"$in": old_ids}}]})
        await db.messages.delete_many({"$or": [{"sender_id": {"$in": old_ids}}, {"receiver_id": {"$in": old_ids}}]})
        await db.notifications.delete_many({"user_id": {"$in": old_ids}})
        await db.recruiter_swipes.delete_many({"$or": [{"recruiter_id": {"$in": old_ids}}, {"seeker_id": {"$in": old_ids}}]})
        await db.interviews.delete_many({"$or": [{"seeker_id": {"$in": old_ids}}, {"recruiter_id": {"$in": old_ids}}]})
        for uid in old_ids:
            invalidate_user(uid)

    # Create seekers with random unique names
    for i in range(num_seekers):
        profile = _SEEKER_PROFILES[i % len(_SEEKER_PROFILES)]
        name = _generate_unique_name(used_names)
        user_id = str(uuid.uuid4())
        email = f"seeker{i+1}@test.hireabble.com"

        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}"
        user_doc = {
            "id": user_id, "email": email, "password": password,
            "name": name, "role": "seeker", "company": None,
            "avatar": avatar, "photo_url": None, "video_url": None,
            "title": profile["title"], "bio": profile["bio"], "skills": profile["skills"],
            "experience_years": profile["experience_years"], "location": random.choice(_LOCATIONS),
            "current_employer": profile.get("current_employer"),
            "previous_employers": [], "school": profile.get("school"),
            "degree": profile.get("degree"), "certifications": [],
            "work_preference": random.choice(["remote", "hybrid", "onsite"]),
            "desired_salary": random.randint(80, 200) * 1000,
            "available_immediately": random.choice([True, False]),
            "onboarding_complete": True, "push_subscription": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat(),
        }
        await db.users.insert_one(user_doc)
        created_seekers.append(user_doc)

    # Create recruiters with random unique company names
    for i in range(num_recruiters):
        company = _generate_unique_company(used_companies)
        recruiter_name = _generate_unique_name(used_names)
        user_id = str(uuid.uuid4())
        email = f"recruiter{i+1}@test.hireabble.com"

        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}"
        user_doc = {
            "id": user_id, "email": email, "password": password,
            "name": recruiter_name, "role": "recruiter",
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

    # Only create applications/matches if explicitly requested (default: fresh accounts at 0)
    if apps_per_seeker > 0 and body.get("create_applications", False):
        for seeker in created_seekers:
            available_jobs = list(created_jobs)
            random.shuffle(available_jobs)
            for j in range(min(apps_per_seeker, len(available_jobs))):
                job = available_jobs[j]
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

    # Invalidate caches for all seeded users so dashboard returns fresh data
    for u in created_seekers + created_recruiters:
        invalidate_user(u["id"])

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
            "seeker_emails": [f"seeker{i+1}@test.hireabble.com" for i in range(num_seekers)],
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
    messages_del = await db.messages.delete_many({"$or": [
        {"sender_id": {"$in": test_user_ids}},
        {"receiver_id": {"$in": test_user_ids}},
    ]})
    notif_del = await db.notifications.delete_many({"user_id": {"$in": test_user_ids}})
    swipes_del = await db.recruiter_swipes.delete_many({"$or": [
        {"recruiter_id": {"$in": test_user_ids}},
        {"seeker_id": {"$in": test_user_ids}},
    ]})
    users_del = await db.users.delete_many({"id": {"$in": test_user_ids}})

    # Invalidate caches for all deleted users
    for uid in test_user_ids:
        invalidate_user(uid)

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
            "recruiter_swipes": swipes_del.deleted_count,
        }
    }
