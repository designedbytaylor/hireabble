"""
Admin routes for Hireabble API.

Separate auth flow, user management, content moderation,
reports review, and platform analytics.
"""
from fastapi import APIRouter, HTTPException, Depends, Body, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import random
import asyncio
import re
import os
import platform
import psutil
import time

from database import (
    db, logger, manager, create_notification,
    hash_password, verify_password, create_token, get_current_admin,
    AdminLogin, AdminCreate, ReportCreate, get_current_user, JobCreate,
    send_email_notification, get_email_template, JWT_SECRET, JWT_ALGORITHM,
)
from content_filter import check_text, BANNED_WORDS
from cache import invalidate_user, invalidate_users_batch
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
import secrets
import hashlib
import secrets
import jwt as pyjwt

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Admin"])

# ==================== ADMIN AUTH (separate flow) ====================

@router.post("/admin/setup")
@limiter.limit("3/hour")
async def admin_setup(admin: AdminCreate, request: Request, setup_token: str = ""):
    """One-time bootstrap: create the first admin. Only works when no admins exist."""
    expected_token = os.environ.get("ADMIN_SETUP_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=403, detail="ADMIN_SETUP_TOKEN not configured. Set it as an environment variable.")
    if not secrets.compare_digest(setup_token, expected_token):
        raise HTTPException(status_code=403, detail="Invalid or missing setup token")

    count = await db.admin_users.count_documents({})
    if count > 0:
        raise HTTPException(status_code=403, detail="Admin already exists. Use /admin/login.")

    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "email": admin.email,
        "password": hash_password(admin.password),
        "name": admin.name,
        "role": "admin",
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
@limiter.limit("5/minute")
async def admin_login(credentials: AdminLogin, request: Request):
    """Admin login — completely separate from user auth."""
    admin = await db.admin_users.find_one({"email": credentials.email})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not admin.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Check if email 2FA is enabled globally
    tfa_setting = await db.site_settings.find_one({"key": "admin_email_2fa"})
    tfa_enabled = tfa_setting.get("value", {}).get("enabled", False) if tfa_setting else False

    if tfa_enabled:
        # Generate 6-digit code
        code = f"{secrets.randbelow(1000000):06d}"
        code_hash = hashlib.sha256(code.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Store hashed code in DB
        await db.admin_2fa_codes.delete_many({"admin_id": admin["id"]})
        await db.admin_2fa_codes.insert_one({
            "admin_id": admin["id"],
            "code_hash": code_hash,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        # Send code via email
        html = get_email_template(
            "Admin Login Verification",
            f"<p>Your admin login verification code is:</p>"
            f"<p style='font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;'>{code}</p>"
            f"<p style='color: #999;'>This code expires in 10 minutes. If you didn't attempt to log in, please secure your account immediately.</p>",
        )
        await send_email_notification(admin["email"], "Hireabble Admin - Login Verification Code", html)

        # Return a temporary 2FA-pending token (5 min expiry)
        pending_token = pyjwt.encode(
            {
                "user_id": admin["id"],
                "role": "__admin_2fa_pending",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            },
            JWT_SECRET,
            algorithm=JWT_ALGORITHM,
        )

        return {
            "requires_2fa": True,
            "temp_token": pending_token,
            "message": "Verification code sent to your email",
        }

    token = create_token(admin["id"], "admin")
    return {
        "token": token,
        "admin": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["name"],
            "role": admin.get("role", "admin"),
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
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    import re as _re
    if not _re.search(r'[A-Z]', new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not _re.search(r'[0-9]', new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not _re.search(r'[^A-Za-z0-9]', new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")
    await db.admin_users.update_one(
        {"id": admin["id"]},
        {"$set": {"password": hash_password(new_password)}}
    )
    return {"message": "Password updated successfully"}


# ==================== ADMIN EMAIL 2FA ====================

@router.post("/admin/2fa/verify")
@limiter.limit("10/minute")
async def admin_2fa_verify(payload: dict, request: Request):
    """Verify a 2FA code during admin login."""
    temp_token = payload.get("temp_token", "")
    code = payload.get("code", "").strip()

    if not temp_token or not code:
        raise HTTPException(status_code=400, detail="Token and code are required")

    # Decode the pending token
    try:
        token_data = pyjwt.decode(temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Verification expired. Please log in again.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if token_data.get("role") != "__admin_2fa_pending":
        raise HTTPException(status_code=401, detail="Invalid token type")

    admin_id = token_data["user_id"]

    # Look up the stored code
    stored = await db.admin_2fa_codes.find_one({"admin_id": admin_id})
    if not stored:
        raise HTTPException(status_code=401, detail="No verification code found. Please log in again.")

    # Check expiry
    if stored["expires_at"] < datetime.now(timezone.utc).isoformat():
        await db.admin_2fa_codes.delete_many({"admin_id": admin_id})
        raise HTTPException(status_code=401, detail="Verification code expired. Please log in again.")

    # Verify code (constant-time comparison to prevent timing attacks)
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    if not secrets.compare_digest(code_hash, stored["code_hash"]):
        raise HTTPException(status_code=401, detail="Invalid verification code")

    # Clean up used code
    await db.admin_2fa_codes.delete_many({"admin_id": admin_id})

    # Fetch admin and issue real token
    admin = await db.admin_users.find_one({"id": admin_id})
    if not admin or not admin.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account not found or deactivated")

    token = create_token(admin["id"], "admin")
    return {
        "token": token,
        "admin": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["name"],
            "role": admin.get("role", "admin"),
        },
    }


@router.get("/admin/2fa/settings")
async def get_admin_2fa_settings(admin: dict = Depends(get_current_admin)):
    """Get admin email 2FA setting."""
    doc = await db.site_settings.find_one({"key": "admin_email_2fa"})
    enabled = doc.get("value", {}).get("enabled", False) if doc else False
    return {"enabled": enabled}


@router.put("/admin/2fa/settings")
async def update_admin_2fa_settings(payload: dict, admin: dict = Depends(get_current_admin)):
    """Toggle admin email 2FA on/off (admin only)."""
    if admin.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change 2FA settings")

    enabled = bool(payload.get("enabled", False))
    await db.site_settings.update_one(
        {"key": "admin_email_2fa"},
        {"$set": {"key": "admin_email_2fa", "value": {"enabled": enabled}, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.info(f"Admin {admin['id']} {'enabled' if enabled else 'disabled'} email 2FA")
    return {"enabled": enabled, "message": f"Email 2FA {'enabled' if enabled else 'disabled'}"}


# ==================== STAFF MANAGEMENT ====================

@router.get("/admin/staff")
async def list_staff(admin: dict = Depends(get_current_admin)):
    """List all admin/support staff (admin only)."""
    if admin.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage staff")
    staff = await db.admin_users.find({}, {"_id": 0, "password": 0}).to_list(length=100)
    return {"staff": staff}


@router.post("/admin/staff")
async def create_staff(payload: dict, admin: dict = Depends(get_current_admin)):
    """Create a new support or admin staff account (admin only)."""
    if admin.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create staff")

    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    name = payload.get("name", "").strip()
    role = payload.get("role", "support")  # 'admin' or 'support'

    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="Email, password, and name are required")
    if role not in ("admin", "support"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'support'")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await db.admin_users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    staff_id = str(uuid.uuid4())
    staff_doc = {
        "id": staff_id,
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_users.insert_one(staff_doc)

    return {
        "message": f"{role.capitalize()} account created",
        "staff": {"id": staff_id, "email": email, "name": name, "role": role},
    }


@router.put("/admin/staff/{staff_id}")
async def update_staff(staff_id: str, payload: dict, admin: dict = Depends(get_current_admin)):
    """Update staff role or active status (admin only)."""
    if admin.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage staff")

    if staff_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")

    staff = await db.admin_users.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    changes = {}
    if "role" in payload and payload["role"] in ("admin", "support"):
        changes["role"] = payload["role"]
    if "is_active" in payload and isinstance(payload["is_active"], bool):
        changes["is_active"] = payload["is_active"]

    if not changes:
        raise HTTPException(status_code=400, detail="No valid changes provided")

    await db.admin_users.update_one({"id": staff_id}, {"$set": changes})
    return {"message": "Staff updated", "changes": changes}


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


# ==================== COMPREHENSIVE STATS ====================

@router.get("/admin/stats/comprehensive")
async def get_comprehensive_stats(admin: dict = Depends(get_current_admin)):
    """Detailed demographic and platform statistics for marketing planning."""
    now = datetime.now(timezone.utc)

    # --- Overview counts ---
    total_users, seekers, recruiters, onboarding_complete, email_verified, marketing_opt_in = await asyncio.gather(
        db.users.count_documents({}),
        db.users.count_documents({"role": "seeker"}),
        db.users.count_documents({"role": "recruiter"}),
        db.users.count_documents({"onboarding_complete": True}),
        db.users.count_documents({"email_verified": True}),
        db.users.count_documents({"marketing_emails_opt_in": True}),
    )

    # --- Age distribution (from date_of_birth) ---
    age_pipeline = [
        {"$match": {"date_of_birth": {"$ne": None, "$exists": True}}},
        {"$addFields": {
            "dob_date": {"$dateFromString": {"dateString": "$date_of_birth", "onError": None}},
        }},
        {"$match": {"dob_date": {"$ne": None}}},
        {"$addFields": {
            "age": {"$dateDiff": {"startDate": "$dob_date", "endDate": now, "unit": "year"}},
        }},
        {"$bucket": {
            "groupBy": "$age",
            "boundaries": [0, 21, 26, 31, 36, 41, 51, 200],
            "default": "other",
            "output": {"count": {"$sum": 1}},
        }},
    ]
    age_results = await db.users.aggregate(age_pipeline).to_list(None)
    no_dob = await db.users.count_documents({"$or": [{"date_of_birth": None}, {"date_of_birth": {"$exists": False}}]})

    age_labels = {0: "16-20", 21: "21-25", 26: "26-30", 31: "31-35", 36: "36-40", 41: "41-50", 51: "51+"}
    age_distribution = [{"range": age_labels.get(b["_id"], "Other"), "count": b["count"]} for b in age_results if b["_id"] != "other"]
    if no_dob > 0:
        age_distribution.append({"range": "Unknown", "count": no_dob})

    # --- Top locations ---
    loc_pipeline = [
        {"$match": {"location": {"$ne": None, "$nin": ["", None]}}},
        {"$group": {"_id": "$location", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    top_locations = [{"location": r["_id"], "count": r["count"]} async for r in db.users.aggregate(loc_pipeline)]

    # --- Subscription breakdown ---
    free_count = await db.users.count_documents({"$or": [
        {"subscription": {"$exists": False}},
        {"subscription": None},
        {"subscription.status": {"$ne": "active"}},
    ]})
    plus_pro = await db.users.count_documents({"subscription.status": "active", "subscription.tier_id": {"$in": ["seeker_plus", "recruiter_pro"]}})
    premium_ent = await db.users.count_documents({"subscription.status": "active", "subscription.tier_id": {"$in": ["seeker_premium", "recruiter_enterprise"]}})

    # --- Growth: weekly (12 weeks) and monthly (12 months) ---
    weekly_growth = []
    for w in range(11, -1, -1):
        week_start = now - timedelta(weeks=w+1)
        week_end = now - timedelta(weeks=w)
        count = await db.users.count_documents({"created_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}})
        weekly_growth.append({"week": week_start.strftime("%Y-W%V"), "signups": count})

    monthly_growth = []
    for m in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30*m)).replace(day=1)
        if m > 0:
            month_end = (now.replace(day=1) - timedelta(days=30*(m-1))).replace(day=1)
        else:
            month_end = now
        count = await db.users.count_documents({"created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}})
        monthly_growth.append({"month": month_start.strftime("%Y-%m"), "signups": count})

    # --- Seeker stats ---
    skills_pipeline = [
        {"$match": {"role": "seeker", "skills": {"$ne": []}}},
        {"$unwind": "$skills"},
        {"$group": {"_id": "$skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    top_skills = [{"skill": r["_id"], "count": r["count"]} async for r in db.users.aggregate(skills_pipeline)]

    jtp_pipeline = [
        {"$match": {"role": "seeker", "job_type_preference": {"$ne": []}}},
        {"$unwind": "$job_type_preference"},
        {"$group": {"_id": "$job_type_preference", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    job_type_prefs = [{"type": r["_id"], "count": r["count"]} async for r in db.users.aggregate(jtp_pipeline)]

    wp_pipeline = [
        {"$match": {"role": "seeker", "work_preference": {"$ne": None}}},
        {"$group": {"_id": "$work_preference", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    work_prefs = [{"type": r["_id"], "count": r["count"]} async for r in db.users.aggregate(wp_pipeline)]

    degree_pipeline = [
        {"$match": {"role": "seeker", "degree": {"$ne": None}}},
        {"$group": {"_id": "$degree", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    degrees = [{"degree": r["_id"], "count": r["count"]} async for r in db.users.aggregate(degree_pipeline)]

    exp_pipeline = [
        {"$match": {"role": "seeker", "experience_years": {"$ne": None}}},
        {"$bucket": {
            "groupBy": "$experience_years",
            "boundaries": [0, 2, 4, 6, 11, 100],
            "default": "other",
            "output": {"count": {"$sum": 1}},
        }},
    ]
    exp_results = await db.users.aggregate(exp_pipeline).to_list(None)
    no_exp = await db.users.count_documents({"role": "seeker", "$or": [{"experience_years": None}, {"experience_years": {"$exists": False}}]})
    exp_labels = {0: "0-1", 2: "2-3", 4: "4-5", 6: "6-10", 11: "10+"}
    exp_distribution = [{"range": exp_labels.get(b["_id"], "Other"), "count": b["count"]} for b in exp_results if b["_id"] != "other"]
    if no_exp > 0:
        exp_distribution.append({"range": "Unknown", "count": no_exp})

    salary_pipeline = [
        {"$match": {"role": "seeker", "desired_salary": {"$ne": None, "$gt": 0}}},
        {"$bucket": {
            "groupBy": "$desired_salary",
            "boundaries": [0, 40000, 60000, 80000, 100000, 150000, 10000000],
            "default": "other",
            "output": {"count": {"$sum": 1}},
        }},
    ]
    salary_results = await db.users.aggregate(salary_pipeline).to_list(None)
    no_salary = await db.users.count_documents({"role": "seeker", "$or": [{"desired_salary": None}, {"desired_salary": {"$exists": False}}, {"desired_salary": 0}]})
    salary_labels = {0: "< $40k", 40000: "$40k-60k", 60000: "$60k-80k", 80000: "$80k-100k", 100000: "$100k-150k", 150000: "$150k+"}
    salary_ranges = [{"range": salary_labels.get(b["_id"], "Other"), "count": b["count"]} for b in salary_results if b["_id"] != "other"]
    if no_salary > 0:
        salary_ranges.append({"range": "Not specified", "count": no_salary})

    # --- Recruiter stats ---
    company_pipeline = [
        {"$match": {"role": "recruiter", "company": {"$ne": None, "$nin": ["", None]}}},
        {"$group": {"_id": "$company", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    top_companies = [{"company": r["_id"], "count": r["count"]} async for r in db.users.aggregate(company_pipeline)]

    active_posters_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$recruiter_id"}},
        {"$count": "total"},
    ]
    active_posters_result = await db.jobs.aggregate(active_posters_pipeline).to_list(1)
    active_job_posters = active_posters_result[0]["total"] if active_posters_result else 0

    return {
        "overview": {
            "total_users": total_users,
            "seekers": seekers,
            "recruiters": recruiters,
            "onboarding_complete_rate": round((onboarding_complete / total_users * 100) if total_users else 0, 1),
            "email_verified_rate": round((email_verified / total_users * 100) if total_users else 0, 1),
            "marketing_opt_in_count": marketing_opt_in,
        },
        "age_distribution": age_distribution,
        "top_locations": top_locations,
        "subscription_breakdown": [
            {"tier": "Free", "count": free_count},
            {"tier": "Plus / Pro", "count": plus_pro},
            {"tier": "Premium / Enterprise", "count": premium_ent},
        ],
        "growth": {"weekly": weekly_growth, "monthly": monthly_growth},
        "seeker_stats": {
            "top_skills": top_skills,
            "job_type_preferences": job_type_prefs,
            "work_preferences": work_prefs,
            "degree_breakdown": degrees,
            "experience_distribution": exp_distribution,
            "salary_ranges": salary_ranges,
        },
        "recruiter_stats": {
            "top_companies": top_companies,
            "active_job_posters": active_job_posters,
        },
    }


@router.get("/admin/export/users")
async def export_users(
    role: str = "all",
    admin: dict = Depends(get_current_admin),
):
    """Export user data for CSV download. Returns JSON array; frontend converts to CSV."""
    query = {}
    if role in ("seeker", "recruiter"):
        query["role"] = role

    projection = {
        "_id": 0, "password": 0, "push_subscription": 0, "blocked_users": 0,
    }
    users = await db.users.find(query, projection).sort("created_at", -1).to_list(None)

    # Flatten for CSV compatibility
    export = []
    for u in users:
        sub = u.get("subscription") or {}
        export.append({
            "id": u.get("id"),
            "email": u.get("email"),
            "name": u.get("name"),
            "role": u.get("role"),
            "company": u.get("company", ""),
            "title": u.get("title", ""),
            "location": u.get("location", ""),
            "date_of_birth": u.get("date_of_birth", ""),
            "skills": ", ".join(u.get("skills", [])),
            "experience_years": u.get("experience_years", ""),
            "degree": u.get("degree", ""),
            "work_preference": u.get("work_preference", ""),
            "desired_salary": u.get("desired_salary", ""),
            "job_type_preference": ", ".join(u.get("job_type_preference", [])),
            "subscription_tier": sub.get("tier_id", "free"),
            "subscription_status": sub.get("status", "none"),
            "onboarding_complete": u.get("onboarding_complete", False),
            "email_verified": u.get("email_verified", False),
            "marketing_emails_opt_in": u.get("marketing_emails_opt_in", False),
            "created_at": u.get("created_at", ""),
        })
    return export


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
        escaped = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"company": {"$regex": escaped, "$options": "i"}},
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


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: dict = Depends(get_current_admin),
):
    """Permanently delete a user and all associated data. No ban, no notification."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = user.get("role", "seeker")

    # Delete all user data across collections
    await db.users.delete_one({"id": user_id})
    await db.support_tickets.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.password_reset_tokens.delete_many({"user_id": user_id})
    await db.moderation_queue.delete_many({"user_id": user_id})
    await db.profile_views.delete_many({"$or": [{"viewer_id": user_id}, {"viewed_id": user_id}]})

    if user_role == "seeker":
        await db.applications.delete_many({"seeker_id": user_id})
        await db.swipes.delete_many({"seeker_id": user_id})
    else:
        jobs = await db.jobs.find({"recruiter_id": user_id}, {"id": 1}).to_list(None)
        job_ids = [j["id"] for j in jobs]
        if job_ids:
            await db.applications.delete_many({"job_id": {"$in": job_ids}})
        await db.jobs.delete_many({"recruiter_id": user_id})
        await db.swipes.delete_many({"recruiter_id": user_id})

    # Delete matches and messages
    matches = await db.matches.find(
        {"$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]},
        {"id": 1}
    ).to_list(None)
    match_ids = [m["id"] for m in matches]
    if match_ids:
        await db.messages.delete_many({"match_id": {"$in": match_ids}})
    await db.matches.delete_many({"$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]})

    # Delete interviews
    await db.interviews.delete_many({"$or": [{"requester_id": user_id}, {"recipient_id": user_id}]})

    invalidate_user(user_id)

    logger.info(f"Admin {admin['id']} permanently deleted user {user_id} ({user.get('email')})")
    return {"message": f"User {user.get('name', user_id)} permanently deleted"}


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


@router.get("/admin/reports/{report_id}/context")
async def get_report_context(report_id: str, admin: dict = Depends(get_current_admin)):
    """Get context for a report — message content and surrounding conversation for message reports."""
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    reported_type = report.get("reported_type")
    reported_id = report.get("reported_id")
    context = {"report_id": report_id, "reported_type": reported_type}

    if reported_type == "message":
        # Find the reported message
        message = await db.messages.find_one({"id": reported_id}, {"_id": 0})
        if not message:
            context["error"] = "Message not found (may have been deleted)"
            return context

        context["reported_message"] = message

        # Get sender and receiver info
        sender = await db.users.find_one({"id": message.get("sender_id")}, {"_id": 0, "id": 1, "name": 1, "photo_url": 1})
        receiver = await db.users.find_one({"id": message.get("receiver_id")}, {"_id": 0, "id": 1, "name": 1, "photo_url": 1})
        context["sender"] = sender
        context["receiver"] = receiver

        # Get surrounding conversation (20 messages around the reported one)
        match_id = message.get("match_id")
        if match_id:
            all_messages = await db.messages.find(
                {"match_id": match_id}, {"_id": 0}
            ).sort("created_at", 1).to_list(500)

            # Find index of reported message and get surrounding context
            idx = next((i for i, m in enumerate(all_messages) if m["id"] == reported_id), -1)
            if idx >= 0:
                start = max(0, idx - 10)
                end = min(len(all_messages), idx + 11)
                context["conversation"] = all_messages[start:end]
                context["reported_message_index"] = idx - start
            else:
                context["conversation"] = all_messages[-20:]

    elif reported_type == "user":
        user = await db.users.find_one({"id": reported_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "photo_url": 1, "bio": 1, "title": 1, "strikes": 1, "status": 1})
        context["reported_user"] = user

    elif reported_type == "job":
        job = await db.jobs.find_one({"id": reported_id}, {"_id": 0, "id": 1, "title": 1, "company": 1, "description": 1, "is_active": 1})
        context["reported_job"] = job

    return context


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
        escaped = re.escape(search)
        query["$or"] = [
            {"title": {"$regex": escaped, "$options": "i"}},
            {"company": {"$regex": escaped, "$options": "i"}},
            {"description": {"$regex": escaped, "$options": "i"}},
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


@router.delete("/admin/jobs/{job_id}/quiet")
async def admin_quiet_delete_job(
    job_id: str,
    admin: dict = Depends(get_current_admin),
):
    """Delete a job without issuing a strike or notifying the poster."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await db.jobs.delete_one({"id": job_id})
    await db.applications.delete_many({"job_id": job_id})

    logger.info(f"Admin {admin['id']} quietly deleted job {job_id} ({job.get('title')})")
    return {"message": f"Job \"{job.get('title', job_id)}\" deleted"}


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
    else:
        # Default "All" view excludes removed items; use status=removed to see them
        query["status"] = {"$ne": "removed"}
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
    silent = body.get("silent", False)

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

    # Check if user still exists
    user_exists = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1}) if user_id else None

    if user_exists:
        if category == "profile_photo":
            user = await db.users.find_one({"id": user_id})
            if user and user.get("photo_url") == url:
                await db.users.update_one({"id": user_id}, {"$set": {"photo_url": None}})
        elif category == "video_intro":
            user = await db.users.find_one({"id": user_id})
            if user and user.get("video_url") == url:
                await db.users.update_one({"id": user_id}, {"$set": {"video_url": None}})

        if not silent:
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

    logger.info(f"Admin {admin['id']} removed media {media_id} from user {user_id}: {reason} (silent={silent})")
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
        raise HTTPException(status_code=404, detail="User not found — they may have been deleted during a reseed")

    # Clear any stale auth cache so the impersonated session gets fresh data
    invalidate_user(user_id)

    token = create_token(user["id"], user["role"])
    logger.info(f"Admin {admin['id']} impersonating user {user_id} ({user['email']})")
    return {"token": token, "user": user}


# ==================== PROMO CODES ====================

@router.post("/admin/promo-codes")
async def create_promo_code(
    code: str = Body(...),
    tier_id: str = Body(...),
    duration_days: int = Body(90),
    max_uses: Optional[int] = Body(None),
    per_user_limit: int = Body(1),
    role_restriction: Optional[str] = Body(None),
    expires_at: Optional[str] = Body(None),
    admin: dict = Depends(get_current_admin),
):
    """Create a new promo code."""
    code = code.strip().upper()

    # Validate tier exists
    from routers.payments import SUBSCRIPTION_TIERS
    if tier_id not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {tier_id}")

    if role_restriction and role_restriction not in ("seeker", "recruiter"):
        raise HTTPException(status_code=400, detail="role_restriction must be 'seeker' or 'recruiter'")

    # Check uniqueness
    existing = await db.promo_codes.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Promo code '{code}' already exists.")

    promo = {
        "id": str(uuid.uuid4()),
        "code": code,
        "tier_id": tier_id,
        "duration_days": duration_days,
        "max_uses": max_uses,
        "uses": 0,
        "per_user_limit": per_user_limit,
        "role_restriction": role_restriction,
        "expires_at": expires_at,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"],
    }
    await db.promo_codes.insert_one(promo)
    promo.pop("_id", None)
    logger.info(f"Promo code created: {code} by admin {admin['id']}")
    return promo


@router.get("/admin/promo-codes")
async def list_promo_codes(admin: dict = Depends(get_current_admin)):
    """List all promo codes with usage stats."""
    codes = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(None)
    return codes


@router.patch("/admin/promo-codes/{code_id}")
async def update_promo_code(
    code_id: str,
    admin: dict = Depends(get_current_admin),
    active: Optional[bool] = Body(None),
    max_uses: Optional[int] = Body(None),
    expires_at: Optional[str] = Body(None),
):
    """Update a promo code (toggle active, change max_uses, etc.)."""
    updates = {}
    if active is not None:
        updates["active"] = active
    if max_uses is not None:
        updates["max_uses"] = max_uses
    if expires_at is not None:
        updates["expires_at"] = expires_at

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    result = await db.promo_codes.update_one({"id": code_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found.")

    logger.info(f"Promo code {code_id} updated by admin {admin['id']}: {updates}")
    return {"success": True}


@router.delete("/admin/promo-codes/{code_id}")
async def delete_promo_code(code_id: str, admin: dict = Depends(get_current_admin)):
    """Deactivate a promo code."""
    result = await db.promo_codes.update_one({"id": code_id}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found.")

    logger.info(f"Promo code {code_id} deactivated by admin {admin['id']}")
    return {"success": True}


# ==================== TEST DATA SEEDING ====================

_MALE_NAMES = [
    "Marcus", "David", "Liam", "Noah", "Ethan", "Lucas", "Oliver", "Aiden", "James", "Leo",
    "Henry", "Owen", "Jack", "Ryan", "Caleb", "Max", "Dylan", "Asher", "Wyatt", "Carter",
    "Jaxon", "Daniel", "Nathan", "Tyler", "Brandon", "Sebastian", "Gabriel", "Samuel", "Julian",
    "Elijah", "Adrian", "Miles", "Theo", "Finn", "Ezra", "Kai", "Rowan", "Jasper", "Felix",
    "Hugo", "Oscar", "Silas", "Atlas", "Xavier", "Roman", "Beckett", "Sawyer", "Cole", "Dean",
    "Grant",
]
_FEMALE_NAMES = [
    "Priya", "Maya", "Emily", "Sofia", "Rachel", "Ava", "Mia", "Zoe", "Chloe", "Harper",
    "Ella", "Aria", "Luna", "Isla", "Nora", "Lily", "Grace", "Stella", "Violet", "Layla",
    "Willow", "Aurora", "Hazel", "Ivy", "Riley", "Camila", "Penelope", "Naomi", "Eliana",
    "Scarlett", "Hannah", "Jade", "Savannah", "Clara", "Emilia", "Quinn", "Sage", "Freya",
    "Wren", "Piper", "Vera", "Margot", "Eloise", "Leah", "Serena", "Thea", "Alina", "Daphne",
    "Iris", "Sienna",
]
_FIRST_NAMES = _MALE_NAMES + _FEMALE_NAMES
_LAST_NAMES = [
    "Chen", "Patel", "Williams", "Rodriguez", "Johnson", "Zhang", "Thompson", "Garcia", "Kim", "O'Brien",
    "Nakamura", "Santos", "Murphy", "Nguyen", "Cohen", "Park", "Singh", "Larsen", "Okafor", "Rivera",
    "Foster", "Tanaka", "Bell", "Ahmad", "Cruz", "Hayes", "Ito", "Morgan", "Das", "Campbell",
    "Reyes", "Barnes", "Cho", "Ellis", "Fernandez", "Grant", "Huang", "Jensen", "Kang", "Lopez",
    "Martin", "Nelson", "Ortiz", "Phillips", "Quinn", "Ross", "Shaw", "Torres", "Ueda", "Vargas",
    "Adler", "Becker", "Chang", "Delgado", "Erikson", "Flynn", "Gutierrez", "Harper", "Ibrahim", "Joshi",
    "Kaur", "Li", "Mendez", "Novak", "Osman", "Petrov", "Ramirez", "Sato", "Tran", "Walsh",
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
    {"title": "Cloud Architect", "bio": "Designing resilient, scalable cloud architectures for enterprise workloads. Multi-cloud certified.", "skills": ["AWS", "Azure", "GCP", "Terraform", "Kubernetes", "Python"], "experience_years": 10, "school": "MIT", "degree": "masters", "current_employer": "Google Cloud"},
    {"title": "iOS Developer", "bio": "Crafting pixel-perfect iOS experiences with Swift and SwiftUI. App Store featured developer.", "skills": ["Swift", "SwiftUI", "UIKit", "Core Data", "Combine", "Xcode"], "experience_years": 6, "school": "UCLA", "degree": "bachelors", "current_employer": "Apple"},
    {"title": "Platform Engineer", "bio": "Building developer platforms and internal tools that make engineering teams 10x more productive.", "skills": ["Go", "Kubernetes", "Backstage", "Terraform", "ArgoCD", "PostgreSQL"], "experience_years": 5, "school": "Carnegie Mellon", "degree": "masters", "current_employer": "Spotify"},
    {"title": "QA Automation Engineer", "bio": "Quality advocate building robust test frameworks. Shift-left testing enthusiast.", "skills": ["Cypress", "Playwright", "Jest", "Python", "Selenium", "CI/CD"], "experience_years": 4, "school": "Purdue", "degree": "bachelors", "current_employer": "Netflix"},
    {"title": "Blockchain Developer", "bio": "Building decentralized applications and smart contracts on Ethereum and Solana.", "skills": ["Solidity", "Rust", "Web3.js", "React", "Node.js", "TypeScript"], "experience_years": 3, "school": "Waterloo", "degree": "bachelors", "current_employer": "Coinbase"},
    {"title": "Technical Writer", "bio": "Translating complex technical concepts into clear, developer-friendly documentation.", "skills": ["Technical Writing", "API Documentation", "Markdown", "Git", "Python", "JavaScript"], "experience_years": 5, "school": "Columbia", "degree": "masters", "current_employer": "Twilio"},
    {"title": "Site Reliability Engineer", "bio": "Keeping systems running at 99.99% uptime. On-call warrior and incident response expert.", "skills": ["Linux", "Prometheus", "Grafana", "Python", "Kubernetes", "Terraform"], "experience_years": 6, "school": "UIUC", "degree": "bachelors", "current_employer": "Datadog"},
    {"title": "Product Designer", "bio": "End-to-end product designer turning user research into delightful digital experiences.", "skills": ["Figma", "User Research", "Prototyping", "Design Systems", "HTML/CSS", "Accessibility"], "experience_years": 7, "school": "RISD", "degree": "bachelors", "current_employer": "Notion"},
    {"title": "AI Research Engineer", "bio": "Bridging the gap between research papers and production AI systems. LLM specialist.", "skills": ["Python", "PyTorch", "Transformers", "CUDA", "Hugging Face", "LangChain"], "experience_years": 3, "school": "Stanford University", "degree": "phd", "current_employer": "Anthropic"},
    {"title": "Android Developer", "bio": "Building modern Android apps with Kotlin and Jetpack Compose. Material Design expert.", "skills": ["Kotlin", "Jetpack Compose", "Android SDK", "Room", "Retrofit", "Coroutines"], "experience_years": 5, "school": "Georgia Tech", "degree": "bachelors", "current_employer": "Google"},
]
_LOCATIONS = ["San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX", "Denver, CO", "Chicago, IL", "Los Angeles, CA", "Portland, OR", "Remote", "Boston, MA", "Miami, FL", "Atlanta, GA"]

_LOCATION_COORDS = {
    "San Francisco, CA": (37.7749, -122.4194),
    "New York, NY": (40.7128, -74.0060),
    "Seattle, WA": (47.6062, -122.3321),
    "Austin, TX": (30.2672, -97.7431),
    "Denver, CO": (39.7392, -104.9903),
    "Chicago, IL": (41.8781, -87.6298),
    "Los Angeles, CA": (34.0522, -118.2437),
    "Portland, OR": (45.5152, -122.6784),
    "Boston, MA": (42.3601, -71.0589),
    "Miami, FL": (25.7617, -80.1918),
    "Atlanta, GA": (33.7490, -84.3880),
}
_COMPANY_NAMES = [
    "TechVision", "CloudScale", "GreenStack", "FinFlow", "HealthBridge",
    "DataPulse", "NovaSoft", "Quantum", "SkyLabs", "CodeForge",
    "ByteWave", "NexGen", "Synapse", "Arclight", "VeloCity",
]
_COMPANY_SUFFIXES = ["Labs", "Inc", "AI", "Tech", "Systems", "Digital", "Solutions", "HQ", "Co", "Studio"]
_BRAND_COLORS = [
    "0D47A1", "1B5E20", "4A148C", "BF360C", "01579B",
    "004D40", "311B92", "E65100", "1A237E", "006064",
    "880E4F", "33691E", "4E342E", "263238", "F57F17",
]
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

_JOB_BACKGROUNDS = [
    # Modern office interiors
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1600508774634-4e11e34d6e47?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1572025442646-866d16c84a54?w=800&h=400&fit=crop",
    # Corporate / glass buildings
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1577760258779-e787a1733016?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1448630360428-65456659c3f9?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1464938050520-ef2571e0e6e6?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=400&fit=crop",
    # Tech workspace / laptops
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1537498425277-c283d32ef9db?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1550439062-609e1531270e?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=400&fit=crop",
    # Team collaboration
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&h=400&fit=crop",
    # City skylines / downtown
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1470723710355-95304d8aece4?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1507090960745-b32f65d3113a?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1496568816025-2a527549dee0?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&h=400&fit=crop",
    # Conference / presentation
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1558403194-611308249627?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1560523159-6b681a1e1852?w=800&h=400&fit=crop",
    # Startup / creative spaces
    "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1542744173-8e7e91415657?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1497366754770-3a14252cca30?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=800&h=400&fit=crop",
    # Abstract / professional patterns
    "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1557682260-96773eb01377?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=800&h=400&fit=crop",
    # Data / servers / tech infrastructure
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=400&fit=crop",
    # Modern architecture / interiors
    "https://images.unsplash.com/photo-1431540015159-0f9673772e47?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1503387837-b154d5074bd2?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1504297050568-910d24c426d3?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&h=400&fit=crop",
    # Business / finance
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1460472178825-e5240623afd5?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&h=400&fit=crop",
    # Coworking / open plan
    "https://images.unsplash.com/photo-1556740758-90de940da79c?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1577412647305-991150c7d163?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1570126618953-d437176e8c79?w=800&h=400&fit=crop",
    # Night city / urban
    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1444084316824-dc26d6657664?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=400&fit=crop",
    # Innovation / labs
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=800&h=400&fit=crop",
    # Reception / lobby
    "https://images.unsplash.com/photo-1497366754770-f9e0845c5860?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1562664348-2043a2b1dfc5?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1574958269340-fa927503f3dd?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=800&h=400&fit=crop",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=400&fit=crop",
]

_SEEKER_HEADSHOTS = [
    # Young professional men
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1463453091185-61582044d556?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1548142813-c348350df52b?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1542178243-bc20704bd5fc?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?w=500&h=500&fit=crop&crop=faces",
    # Young professional women
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1502767089025-6572583495f0?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1584999734482-0361aecad844?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1544168190-e12bbc0d6cbf?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1485893226355-9a1c32a0c81e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1558203728-00f45181dd84?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=500&h=500&fit=crop&crop=faces",
]

# Professional headshots for recruiter profiles — ALL unique, no overlap with seeker list
_RECRUITER_HEADSHOTS = [
    # Professional men
    "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1480429370612-2f63b4f4f6e6?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1599566150163-29194dcabd9c?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1615109398623-88346a601842?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1605462863863-10d9e47e15ee?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1560298803-1d998f6b5249?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1607990281513-2c110a25e8c3?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1596075780750-81249df16d19?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1506956191951-7fdebe3d0d60?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1528892952291-009c663ce843?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1614587185092-af80bcf67669?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1578176603894-57973e38890f?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1583864697784-a0efc8379f70?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1590086782957-93c06ef21604?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1600878459138-e1123b37cb30?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1611432579699-484f7990b127?w=500&h=500&fit=crop&crop=faces",
    # Professional women
    "https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1586297135537-94bc9ba060aa?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1601455763557-db1bea4a40a5?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1548142542-c53707f8e73d?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1611432579402-7037e3e2c1e4?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1593104547489-5cfb3839a3b5?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1558898479-33c0057a5d12?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1597223557154-721c1cecc4b0?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1587677698308-deda2ec8d28f?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1610276198568-eb6d0ff53e48?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1557555187-23d685287bc3?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1596215143922-aaeda3a2d69e?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1546961342-ea5f71b193f3?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1603775020644-eb8decd79994?w=500&h=500&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1592621385612-4d7129426394?w=500&h=500&fit=crop&crop=faces",
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


def _generate_unique_name(used_names: set, gender: str = None) -> tuple:
    """Generate a random unique first+last name combination. Returns (name, gender)."""
    if gender is None:
        gender = random.choice(["male", "female"])
    name_pool = _MALE_NAMES if gender == "male" else _FEMALE_NAMES
    for _ in range(200):
        name = f"{random.choice(name_pool)} {random.choice(_LAST_NAMES)}"
        if name not in used_names:
            used_names.add(name)
            return name, gender
    # Fallback: add random digits
    name = f"{random.choice(name_pool)} {random.choice(_LAST_NAMES)}{random.randint(10, 99)}"
    used_names.add(name)
    return name, gender


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
    num_seekers = body.get("seekers", 50)
    num_recruiters = body.get("recruiters", 50)
    jobs_per_recruiter = body.get("jobs_per_recruiter", 2)
    apps_per_seeker = body.get("applications_per_seeker", 0)

    created_seekers = []
    created_recruiters = []
    created_jobs = []
    created_applications = []
    created_matches = []
    # Run bcrypt off the event loop to avoid blocking
    password = await asyncio.to_thread(hash_password, "testpass123")
    used_names = set()
    used_companies = set()

    # Always clear old test data first so we get fresh accounts every time
    old_test_users = await db.users.find(
        {"email": {"$regex": r"@test\.hireabble\.com$"}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    old_ids = [u["id"] for u in old_test_users]
    if old_ids:
        await asyncio.gather(
            db.users.delete_many({"id": {"$in": old_ids}}),
            db.applications.delete_many({"$or": [{"seeker_id": {"$in": old_ids}}, {"recruiter_id": {"$in": old_ids}}]}),
            db.jobs.delete_many({"recruiter_id": {"$in": old_ids}}),
            db.matches.delete_many({"$or": [{"seeker_id": {"$in": old_ids}}, {"recruiter_id": {"$in": old_ids}}]}),
            db.messages.delete_many({"$or": [{"sender_id": {"$in": old_ids}}, {"receiver_id": {"$in": old_ids}}]}),
            db.notifications.delete_many({"user_id": {"$in": old_ids}}),
            db.recruiter_swipes.delete_many({"$or": [{"recruiter_id": {"$in": old_ids}}, {"seeker_id": {"$in": old_ids}}]}),
            db.interviews.delete_many({"$or": [{"seeker_id": {"$in": old_ids}}, {"recruiter_id": {"$in": old_ids}}]}),
        )
        invalidate_users_batch(old_ids)

    # Build all documents in memory first, then batch-insert for speed
    # Shuffle headshots so no two users share the same photo
    shuffled_headshots = list(_SEEKER_HEADSHOTS)
    random.shuffle(shuffled_headshots)
    while len(shuffled_headshots) < num_seekers:
        extra = list(_SEEKER_HEADSHOTS)
        random.shuffle(extra)
        shuffled_headshots.extend(extra)

    shuffled_rec_headshots = list(_RECRUITER_HEADSHOTS)
    random.shuffle(shuffled_rec_headshots)
    while len(shuffled_rec_headshots) < num_recruiters:
        extra = list(_RECRUITER_HEADSHOTS)
        random.shuffle(extra)
        shuffled_rec_headshots.extend(extra)

    seeker_docs = []
    for i in range(num_seekers):
        profile = _SEEKER_PROFILES[i % len(_SEEKER_PROFILES)]
        name, gender = _generate_unique_name(used_names)
        user_id = str(uuid.uuid4())
        email = f"seeker{i+1}@test.hireabble.com"

        photo_url = shuffled_headshots[i]
        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={user_id}"
        seeker_location = random.choice(_LOCATIONS)
        seeker_coords = _LOCATION_COORDS.get(seeker_location)
        user_doc = {
            "id": user_id, "email": email, "password": password,
            "name": name, "role": "seeker", "company": None,
            "avatar": avatar, "photo_url": photo_url, "video_url": None,
            "title": profile["title"], "bio": profile["bio"], "skills": profile["skills"],
            "experience_years": profile["experience_years"], "location": seeker_location,
            "current_employer": profile.get("current_employer"),
            "previous_employers": [], "school": profile.get("school"),
            "degree": profile.get("degree"), "certifications": [],
            "work_preference": random.choice(["remote", "hybrid", "onsite"]),
            "desired_salary": random.randint(80, 200) * 1000,
            "available_immediately": random.choice([True, False]),
            "onboarding_complete": True, "push_subscription": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat(),
        }
        if seeker_coords:
            user_doc["location_lat"] = seeker_coords[0]
            user_doc["location_lng"] = seeker_coords[1]
        seeker_docs.append(user_doc)

    recruiter_docs = []
    for i in range(num_recruiters):
        company = _generate_unique_company(used_companies)
        recruiter_name, rec_gender = _generate_unique_name(used_names)
        user_id = str(uuid.uuid4())
        email = f"recruiter{i+1}@test.hireabble.com"

        brand_color = _BRAND_COLORS[i % len(_BRAND_COLORS)]
        rec_photo = shuffled_rec_headshots[i]
        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={user_id}"
        rec_location = random.choice(["San Francisco, CA", "New York, NY", "Remote"])
        rec_coords = _LOCATION_COORDS.get(rec_location)
        user_doc = {
            "id": user_id, "email": email, "password": password,
            "name": recruiter_name, "role": "recruiter",
            "company": company["name"], "avatar": avatar,
            "photo_url": rec_photo, "video_url": None, "title": "Talent Acquisition",
            "bio": company["description"], "skills": [], "experience_years": None,
            "location": rec_location,
            "current_employer": None, "previous_employers": [],
            "school": None, "degree": None, "certifications": [],
            "work_preference": None, "desired_salary": None,
            "available_immediately": True, "onboarding_complete": True,
            "push_subscription": None,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 90))).isoformat(),
        }
        if rec_coords:
            user_doc["location_lat"] = rec_coords[0]
            user_doc["location_lng"] = rec_coords[1]
        user_doc["_brand_color"] = brand_color  # in-memory only, for job logo generation
        recruiter_docs.append(user_doc)

    # Batch-insert seekers and recruiters in parallel
    # Strip in-memory-only fields before DB insert
    all_user_docs = [{k: v for k, v in doc.items() if k != "_brand_color"} for doc in seeker_docs + recruiter_docs]
    if all_user_docs:
        await db.users.insert_many(all_user_docs)
    created_seekers = seeker_docs
    created_recruiters = recruiter_docs

    # Build job documents and batch-insert
    # Shuffle backgrounds so no two jobs share the same image
    total_jobs_estimate = num_recruiters * jobs_per_recruiter
    shuffled_bgs = list(_JOB_BACKGROUNDS)
    random.shuffle(shuffled_bgs)
    # If we need more than available, extend with reshuffled copies
    while len(shuffled_bgs) < total_jobs_estimate:
        extra = list(_JOB_BACKGROUNDS)
        random.shuffle(extra)
        shuffled_bgs.extend(extra)

    job_docs = []
    for recruiter in created_recruiters:
        available_jobs = list(SAMPLE_JOBS)
        random.shuffle(available_jobs)
        for j in range(min(jobs_per_recruiter, len(available_jobs))):
            job_data = available_jobs[j]
            job_id = str(uuid.uuid4())
            company_name = recruiter.get('company', 'Co').replace(" ", "+")
            brand_clr = recruiter.get('_brand_color', '0D47A1')
            logo = f"https://ui-avatars.com/api/?name={company_name}&size=200&background={brand_clr}&color=fff&bold=true&format=png"
            bg = shuffled_bgs[len(job_docs)]
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
            job_coords = _LOCATION_COORDS.get(job_data.get("location", ""))
            if job_coords:
                job_doc["location_lat"] = job_coords[0]
                job_doc["location_lng"] = job_coords[1]
            job_docs.append(job_doc)
    if job_docs:
        await db.jobs.insert_many(job_docs)
    created_jobs = job_docs

    # Only create applications/matches if explicitly requested (default: fresh accounts at 0)
    if apps_per_seeker > 0 and body.get("create_applications", False):
        app_docs = []
        for seeker in created_seekers:
            available_jobs = list(created_jobs)
            random.shuffle(available_jobs)
            for j in range(min(apps_per_seeker, len(available_jobs))):
                job = available_jobs[j]
                app_id = str(uuid.uuid4())
                action = random.choices(["like", "superlike"], weights=[0.7, 0.3])[0]
                app_docs.append({
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
                })
        if app_docs:
            await db.applications.insert_many(app_docs)
        created_applications = app_docs

        # Create some matches — use in-memory lookups instead of per-app DB queries
        jobs_by_id = {j["id"]: j for j in created_jobs}
        recruiters_by_id = {r["id"]: r for r in created_recruiters}
        apps_to_match = random.sample(
            created_applications,
            min(len(created_applications) // 3, len(created_applications))
        )
        match_docs = []
        match_app_ids = []
        for app in apps_to_match:
            job = jobs_by_id.get(app["job_id"])
            if not job:
                continue
            match_app_ids.append(app["id"])
            recruiter_doc = recruiters_by_id.get(job["recruiter_id"], {})
            match_docs.append({
                "id": str(uuid.uuid4()),
                "job_id": app["job_id"],
                "job_title": job.get("title", ""),
                "company": job.get("company", ""),
                "seeker_id": app["seeker_id"],
                "seeker_name": app["seeker_name"],
                "seeker_avatar": app.get("seeker_avatar"),
                "seeker_photo": app.get("seeker_photo"),
                "recruiter_id": job["recruiter_id"],
                "recruiter_name": job.get("recruiter_name", ""),
                "recruiter_avatar": recruiter_doc.get("avatar"),
                "recruiter_photo": recruiter_doc.get("photo_url"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        if match_app_ids:
            await asyncio.gather(
                db.applications.update_many(
                    {"id": {"$in": match_app_ids}},
                    {"$set": {"is_matched": True, "recruiter_action": "accept"}}
                ),
                db.matches.insert_many(match_docs) if match_docs else asyncio.sleep(0),
            )
        created_matches = match_docs

    # Invalidate caches for all seeded users so dashboard returns fresh data
    invalidate_users_batch([u["id"] for u in created_seekers + created_recruiters])

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

    # Delete all related data in parallel (independent collections)
    (apps_del, matches_del, jobs_del, interviews_del, messages_del,
     notif_del, swipes_del, users_del) = await asyncio.gather(
        db.applications.delete_many({"$or": [
            {"seeker_id": {"$in": test_user_ids}},
            {"recruiter_id": {"$in": test_user_ids}},
        ]}),
        db.matches.delete_many({"$or": [
            {"seeker_id": {"$in": test_user_ids}},
            {"recruiter_id": {"$in": test_user_ids}},
        ]}),
        db.jobs.delete_many({"recruiter_id": {"$in": test_user_ids}}),
        db.interviews.delete_many({"$or": [
            {"seeker_id": {"$in": test_user_ids}},
            {"recruiter_id": {"$in": test_user_ids}},
        ]}),
        db.messages.delete_many({"$or": [
            {"sender_id": {"$in": test_user_ids}},
            {"receiver_id": {"$in": test_user_ids}},
        ]}),
        db.notifications.delete_many({"user_id": {"$in": test_user_ids}}),
        db.recruiter_swipes.delete_many({"$or": [
            {"recruiter_id": {"$in": test_user_ids}},
            {"seeker_id": {"$in": test_user_ids}},
        ]}),
        db.users.delete_many({"id": {"$in": test_user_ids}}),
    )

    # Invalidate caches for all deleted users in one batch
    invalidate_users_batch(test_user_ids)

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


# ==================== THEME MANAGEMENT ====================

AVAILABLE_THEMES = {
    "default": {
        "id": "default",
        "name": "Neon Noir",
        "description": "Electric, vibrant dark theme with neon glows and bold gradients. Fun, youthful energy.",
        "preview": {
            "background": "#09090b",
            "primary": "#6366f1",
            "secondary": "#d946ef",
            "accent": "#27272a",
            "text": "#fafafa",
        },
    },
    "professional": {
        "id": "professional",
        "name": "Executive",
        "description": "Clean, business-appropriate dark theme with refined teal accents. Modern and trustworthy.",
        "preview": {
            "background": "#0d1520",
            "primary": "#2ba893",
            "secondary": "#3f5973",
            "accent": "#1a2636",
            "text": "#e8edf2",
        },
    },
}


@router.get("/theme")
async def get_active_theme():
    """Public endpoint — returns the currently active theme."""
    settings = await db.site_settings.find_one({"key": "active_theme"})
    theme_id = settings["value"] if settings else "default"
    return {"theme": theme_id, "themes": AVAILABLE_THEMES}


@router.get("/admin/themes")
async def list_themes(admin=Depends(get_current_admin)):
    """List all available themes with the currently active one."""
    settings = await db.site_settings.find_one({"key": "active_theme"})
    active = settings["value"] if settings else "default"
    return {"active": active, "themes": AVAILABLE_THEMES}


@router.post("/admin/themes")
async def set_active_theme(
    body: dict = Body(...),
    admin=Depends(get_current_admin),
):
    """Set the active theme for the entire platform."""
    theme_id = body.get("theme")
    if theme_id not in AVAILABLE_THEMES:
        raise HTTPException(status_code=400, detail=f"Unknown theme: {theme_id}")

    await db.site_settings.update_one(
        {"key": "active_theme"},
        {"$set": {"key": "active_theme", "value": theme_id, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    return {"message": f"Theme set to {AVAILABLE_THEMES[theme_id]['name']}", "theme": theme_id}


# ==================== REVENUE ANALYTICS ====================

@router.get("/admin/revenue")
async def admin_revenue(admin=Depends(get_current_admin)):
    """Revenue analytics: monthly revenue, subscriptions, cancellations, churn."""
    now = datetime.now(timezone.utc)
    from routers.payments import SUBSCRIPTION_TIERS

    # Get all existing user IDs to exclude transactions from deleted users
    existing_user_ids = [u["id"] async for u in db.users.find({}, {"_id": 0, "id": 1})]
    active_user_filter = {"user_id": {"$in": existing_user_ids}}

    # --- Monthly revenue (last 12 months) ---
    monthly_revenue = []
    for i in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            next_month = (month_start + timedelta(days=32)).replace(day=1)
        else:
            next_month = now
        month_label = month_start.strftime("%b %Y")

        pipeline = [
            {"$match": {
                "status": "completed",
                "created_at": {"$gte": month_start.isoformat(), "$lt": next_month.isoformat()},
                **active_user_filter,
            }},
            {"$group": {
                "_id": None,
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }},
        ]
        result = await db.transactions.aggregate(pipeline).to_list(1)
        row = result[0] if result else {"total": 0, "count": 0}
        monthly_revenue.append({
            "month": month_label,
            "revenue": row["total"],  # in cents
            "transactions": row["count"],
        })

    # --- Revenue by product type ---
    product_pipeline = [
        {"$match": {"status": "completed", **active_user_filter}},
        {"$group": {
            "_id": "$product_id",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    product_results = await db.transactions.aggregate(product_pipeline).to_list(None)
    revenue_by_product = []
    for r in product_results:
        pid = r["_id"] or "unknown"
        tier = SUBSCRIPTION_TIERS.get(pid)
        name = tier["name"] if tier else pid.replace("_", " ").title()
        category = "subscription" if pid in SUBSCRIPTION_TIERS else "boost" if "boost" in pid else "purchase"
        revenue_by_product.append({
            "product_id": pid,
            "name": name,
            "category": category,
            "total": r["total"],
            "count": r["count"],
        })

    # --- Revenue by source (stripe vs apple) ---
    source_pipeline = [
        {"$match": {"status": "completed", **active_user_filter}},
        {"$group": {"_id": "$source", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    source_results = await db.transactions.aggregate(source_pipeline).to_list(None)
    revenue_by_source = [{"source": r["_id"] or "unknown", "total": r["total"], "count": r["count"]} for r in source_results]

    # --- Active subscriptions breakdown ---
    sub_pipeline = [
        {"$match": {"subscription.status": "active"}},
        {"$group": {
            "_id": "$subscription.tier_id",
            "count": {"$sum": 1},
            "total_revenue": {"$sum": "$subscription.price_paid"},
        }},
        {"$sort": {"count": -1}},
    ]
    active_subs = []
    async for r in db.users.aggregate(sub_pipeline):
        tier_id = r["_id"]
        tier = SUBSCRIPTION_TIERS.get(tier_id, {})
        active_subs.append({
            "tier_id": tier_id,
            "name": tier.get("name", tier_id),
            "role": tier.get("role", "unknown"),
            "count": r["count"],
            "total_revenue": r["total_revenue"] or 0,
        })

    # --- Expired/cancelled subscriptions (had subscription but it's not active) ---
    expired_pipeline = [
        {"$match": {
            "subscription": {"$exists": True, "$ne": None},
            "$or": [
                {"subscription.status": {"$ne": "active"}},
                {"subscription.period_end": {"$lt": now.isoformat()}},
            ],
        }},
        {"$group": {
            "_id": "$subscription.tier_id",
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
    ]
    expired_subs = []
    async for r in db.users.aggregate(expired_pipeline):
        tier_id = r["_id"]
        tier = SUBSCRIPTION_TIERS.get(tier_id, {})
        expired_subs.append({
            "tier_id": tier_id,
            "name": tier.get("name", tier_id),
            "count": r["count"],
        })

    # --- Subscription by duration (weekly/monthly/6month) ---
    duration_pipeline = [
        {"$match": {"subscription.status": "active"}},
        {"$group": {"_id": "$subscription.duration", "count": {"$sum": 1}}},
    ]
    duration_breakdown = [{"duration": r["_id"] or "unknown", "count": r["count"]} async for r in db.users.aggregate(duration_pipeline)]

    # --- Churn tracking: subscriptions that expired per month (last 6 months) ---
    churn_data = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            next_month = (month_start + timedelta(days=32)).replace(day=1)
        else:
            next_month = now

        expired_in_month = await db.users.count_documents({
            "subscription": {"$exists": True, "$ne": None},
            "subscription.period_end": {"$gte": month_start.isoformat(), "$lt": next_month.isoformat()},
            "$or": [
                {"subscription.status": {"$ne": "active"}},
                {"subscription.period_end": {"$lt": now.isoformat()}},
            ],
        })

        new_subs_in_month = await db.transactions.count_documents({
            "status": "completed",
            "product_id": {"$in": list(SUBSCRIPTION_TIERS.keys())},
            "created_at": {"$gte": month_start.isoformat(), "$lt": next_month.isoformat()},
            **active_user_filter,
        })

        churn_data.append({
            "month": month_start.strftime("%b %Y"),
            "expired": expired_in_month,
            "new_subscriptions": new_subs_in_month,
            "net": new_subs_in_month - expired_in_month,
        })

    # --- Summary stats ---
    total_revenue = await db.transactions.aggregate([
        {"$match": {"status": "completed", **active_user_filter}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    total_rev = total_revenue[0] if total_revenue else {"total": 0, "count": 0}

    total_active = await db.users.count_documents({"subscription.status": "active"})
    total_expired = await db.users.count_documents({
        "subscription": {"$exists": True, "$ne": None},
        "$or": [
            {"subscription.status": {"$ne": "active"}},
            {"subscription.period_end": {"$lt": now.isoformat()}},
        ],
    })
    total_users = await db.users.count_documents({})

    # Recent transactions (last 20, excluding deleted users)
    recent_txns = []
    async for t in db.transactions.find({"status": "completed", **active_user_filter}, {"_id": 0}).sort("created_at", -1).limit(20):
        user = await db.users.find_one({"id": t["user_id"]}, {"_id": 0, "name": 1, "email": 1, "role": 1})
        recent_txns.append({
            **t,
            "user_name": user.get("name", "Unknown") if user else "Unknown",
            "user_email": user.get("email", "") if user else "",
            "user_role": user.get("role", "") if user else "",
        })

    return {
        "summary": {
            "total_revenue": total_rev["total"],
            "total_transactions": total_rev["count"],
            "active_subscriptions": total_active,
            "expired_subscriptions": total_expired,
            "total_users": total_users,
            "conversion_rate": round(total_active / total_users * 100, 1) if total_users > 0 else 0,
        },
        "monthly_revenue": monthly_revenue,
        "revenue_by_product": revenue_by_product,
        "revenue_by_source": revenue_by_source,
        "active_subscriptions": active_subs,
        "expired_subscriptions": expired_subs,
        "duration_breakdown": duration_breakdown,
        "churn_data": churn_data,
        "recent_transactions": recent_txns,
    }


# ==================== APP STORE SETTINGS ====================

APP_STORE_SETTINGS_KEY = "app_store_settings"

APP_STORE_SETTINGS_FIELDS = [
    "apple_team_id",
    "apple_shared_secret",
    "android_sha256_fingerprint",
    "app_store_url",
    "play_store_url",
]


@router.get("/admin/app-store-settings")
async def get_app_store_settings(admin=Depends(get_current_admin)):
    """Get app store configuration settings."""
    doc = await db.site_settings.find_one({"key": APP_STORE_SETTINGS_KEY})
    settings = doc.get("value", {}) if doc else {}
    # Mask the shared secret for display
    if settings.get("apple_shared_secret"):
        secret = settings["apple_shared_secret"]
        settings["apple_shared_secret_masked"] = secret[:4] + "*" * (len(secret) - 8) + secret[-4:] if len(secret) > 8 else "****"
    return {field: settings.get(field, "") for field in APP_STORE_SETTINGS_FIELDS}


@router.put("/admin/app-store-settings")
async def update_app_store_settings(
    body: dict = Body(...),
    admin=Depends(get_current_admin),
):
    """Update app store configuration settings."""
    # Only allow known fields
    updates = {k: v for k, v in body.items() if k in APP_STORE_SETTINGS_FIELDS and v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid settings provided")

    # Merge with existing settings (don't overwrite fields not in the request)
    doc = await db.site_settings.find_one({"key": APP_STORE_SETTINGS_KEY})
    current = doc.get("value", {}) if doc else {}
    current.update(updates)

    await db.site_settings.update_one(
        {"key": APP_STORE_SETTINGS_KEY},
        {"$set": {"key": APP_STORE_SETTINGS_KEY, "value": current, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    # If apple_shared_secret was updated, also update the env-like config for payments
    if "apple_shared_secret" in updates:
        os.environ["APPLE_SHARED_SECRET"] = updates["apple_shared_secret"]

    return {"message": "App store settings updated", "settings": {k: current.get(k, "") for k in APP_STORE_SETTINGS_FIELDS}}


# ==================== PRICING MANAGEMENT ====================

PRICING_OVERRIDES_KEY = "pricing_overrides"

# Supported countries for pricing (country_code → display name, currency symbol)
PRICING_COUNTRIES = {
    "CA": {"name": "Canada", "currency": "CAD", "symbol": "CA$"},
    "US": {"name": "United States", "currency": "USD", "symbol": "$"},
    "GB": {"name": "United Kingdom", "currency": "GBP", "symbol": "£"},
    "AU": {"name": "Australia", "currency": "AUD", "symbol": "A$"},
    "IN": {"name": "India", "currency": "INR", "symbol": "₹"},
    "DE": {"name": "Germany", "currency": "EUR", "symbol": "€"},
    "FR": {"name": "France", "currency": "EUR", "symbol": "€"},
    "BR": {"name": "Brazil", "currency": "BRL", "symbol": "R$"},
    "MX": {"name": "Mexico", "currency": "MXN", "symbol": "MX$"},
    "JP": {"name": "Japan", "currency": "JPY", "symbol": "¥"},
    "KR": {"name": "South Korea", "currency": "KRW", "symbol": "₩"},
    "NG": {"name": "Nigeria", "currency": "NGN", "symbol": "₦"},
    "PH": {"name": "Philippines", "currency": "PHP", "symbol": "₱"},
    "SG": {"name": "Singapore", "currency": "SGD", "symbol": "S$"},
    "AE": {"name": "UAE", "currency": "AED", "symbol": "د.إ"},
}

def _pricing_key(country: str = ""):
    """Get the DB key for a country's pricing overrides."""
    if not country or country == "CA":
        return PRICING_OVERRIDES_KEY
    return f"{PRICING_OVERRIDES_KEY}_{country}"


@router.get("/admin/pricing/countries")
async def get_pricing_countries(admin=Depends(get_current_admin)):
    """Get list of supported pricing countries."""
    return {"countries": PRICING_COUNTRIES, "default": "CA"}


@router.get("/admin/pricing")
async def get_pricing(country: str = "", admin=Depends(get_current_admin)):
    """Get all pricing: default definitions + any admin overrides for a country."""
    from routers.payments import SUBSCRIPTION_TIERS, PRODUCTS

    key = _pricing_key(country)
    doc = await db.site_settings.find_one({"key": key})
    overrides = doc.get("value", {}) if doc else {}

    # Build tiers response with effective prices
    tiers = {}
    for tier_id, tier in SUBSCRIPTION_TIERS.items():
        tier_overrides = overrides.get("tiers", {}).get(tier_id, {})
        effective_prices = {**tier["prices"]}
        for dur in ("weekly", "monthly", "6month"):
            if dur in (tier_overrides.get("prices") or {}):
                effective_prices[dur] = tier_overrides["prices"][dur]
        tiers[tier_id] = {
            "name": tier["name"],
            "role": tier["role"],
            "tier_level": tier["tier_level"],
            "default_prices": tier["prices"],
            "prices": effective_prices,
            "apple_product_ids": tier.get("apple_product_ids", {}),
            "google_product_ids": tier.get("google_product_ids", {}),
        }

    # Build products response with effective prices
    products = {}
    for prod_id, prod in PRODUCTS.items():
        prod_overrides = overrides.get("products", {}).get(prod_id, {})
        products[prod_id] = {
            "name": prod["name"],
            "default_price": prod["price"],
            "price": prod_overrides.get("price", prod["price"]),
            "apple_product_id": prod.get("apple_product_id", ""),
            "google_product_id": prod.get("google_product_id", ""),
        }

    return {"tiers": tiers, "products": products}


@router.put("/admin/pricing")
async def update_pricing(
    body: dict = Body(...),
    country: str = "",
    admin=Depends(get_current_admin),
):
    """Update pricing overrides for a country. Body: {tiers: {tier_id: {prices: {weekly, monthly, 6month}}}, products: {prod_id: {price}}}."""
    key = _pricing_key(country)
    doc = await db.site_settings.find_one({"key": key})
    current = doc.get("value", {}) if doc else {}

    # Merge tier overrides
    if "tiers" in body and isinstance(body["tiers"], dict):
        if "tiers" not in current:
            current["tiers"] = {}
        for tier_id, tier_data in body["tiers"].items():
            if tier_id not in current["tiers"]:
                current["tiers"][tier_id] = {}
            if "prices" in tier_data and isinstance(tier_data["prices"], dict):
                if "prices" not in current["tiers"][tier_id]:
                    current["tiers"][tier_id]["prices"] = {}
                for dur, price in tier_data["prices"].items():
                    if dur in ("weekly", "monthly", "6month") and isinstance(price, (int, float)):
                        current["tiers"][tier_id]["prices"][dur] = int(price)

    # Merge product overrides
    if "products" in body and isinstance(body["products"], dict):
        if "products" not in current:
            current["products"] = {}
        for prod_id, prod_data in body["products"].items():
            if prod_id not in current["products"]:
                current["products"][prod_id] = {}
            if "price" in prod_data and isinstance(prod_data["price"], (int, float)):
                current["products"][prod_id]["price"] = int(prod_data["price"])

    await db.site_settings.update_one(
        {"key": key},
        {"$set": {"key": key, "value": current, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    label = PRICING_COUNTRIES.get(country, {}).get("name", "default") if country else "default"
    logger.info(f"Admin {admin['id']} updated pricing overrides for {label}")
    return {"message": f"Pricing updated for {label}"}


@router.delete("/admin/pricing/reset")
async def reset_pricing(country: str = "", admin=Depends(get_current_admin)):
    """Reset pricing back to defaults for a country (removes overrides)."""
    key = _pricing_key(country)
    await db.site_settings.delete_one({"key": key})
    label = PRICING_COUNTRIES.get(country, {}).get("name", "default") if country else "default"
    logger.info(f"Admin {admin['id']} reset pricing to defaults for {label}")
    return {"message": f"Pricing reset to defaults for {label}"}


# ==================== MARKETING DASHBOARD ====================

MARKETING_SETTINGS_KEY = "marketing_dashboard"


@router.get("/admin/marketing")
async def get_marketing_data(admin=Depends(get_current_admin)):
    """Get marketing dashboard data (checklist, emails, notes, metrics, contacts)."""
    doc = await db.site_settings.find_one({"key": MARKETING_SETTINGS_KEY})
    data = doc.get("value", {}) if doc else {}
    return {
        "checklist": data.get("checklist"),
        "emails": data.get("emails"),
        "notes": data.get("notes", ""),
        "metrics": data.get("metrics", {"employers": 0, "seekers": 0, "matches": 0, "emailsSent": 0}),
        "contacts": data.get("contacts", []),
    }


@router.put("/admin/marketing")
async def update_marketing_data(
    body: dict = Body(...),
    admin=Depends(get_current_admin),
):
    """Update marketing dashboard data. Accepts any subset of: checklist, emails, notes, metrics, contacts."""
    allowed_keys = {"checklist", "emails", "notes", "metrics", "contacts"}
    updates = {k: v for k, v in body.items() if k in allowed_keys}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields provided")

    # Merge with existing data
    doc = await db.site_settings.find_one({"key": MARKETING_SETTINGS_KEY})
    current = doc.get("value", {}) if doc else {}
    current.update(updates)

    await db.site_settings.update_one(
        {"key": MARKETING_SETTINGS_KEY},
        {"$set": {"key": MARKETING_SETTINGS_KEY, "value": current, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    return {"message": "Marketing data saved"}


@router.post("/admin/marketing/ai-generate")
async def ai_generate_text(
    body: dict = Body(...),
    admin=Depends(get_current_admin),
):
    """Proxy AI text generation for marketing dashboard (first lines, email drafts)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    system_prompt = body.get("system", "")
    user_message = body.get("message", "")
    max_tokens = min(body.get("max_tokens", 600), 2000)

    if not user_message:
        raise HTTPException(status_code=400, detail="message is required")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        # Try models in order of preference
        for model_id in ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"]:
            try:
                response = client.messages.create(
                    model=model_id,
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                )
                text = "".join(b.text for b in response.content if hasattr(b, "text"))
                return {"text": text, "model": model_id}
            except anthropic.NotFoundError:
                continue
            except anthropic.BadRequestError:
                continue
        raise HTTPException(status_code=500, detail="No available AI model")
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed")
    except Exception as e:
        logger.error(f"Admin AI operation failed: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


# ==================== LAUNCH CHECKLIST ====================

LAUNCH_CHECKLIST_KEY = "launch_checklist"


@router.get("/admin/launch-checklist")
async def get_launch_checklist(admin=Depends(get_current_admin)):
    """Get launch checklist data (checklist items and notes)."""
    doc = await db.site_settings.find_one({"key": LAUNCH_CHECKLIST_KEY})
    data = doc.get("value", {}) if doc else {}
    return {
        "checklist": data.get("checklist", []),
        "notes": data.get("notes", ""),
    }


@router.put("/admin/launch-checklist")
async def update_launch_checklist(
    body: dict = Body(...),
    admin=Depends(get_current_admin),
):
    """Update launch checklist data. Accepts any subset of: checklist, notes."""
    allowed_keys = {"checklist", "notes"}
    updates = {k: v for k, v in body.items() if k in allowed_keys}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields provided")

    doc = await db.site_settings.find_one({"key": LAUNCH_CHECKLIST_KEY})
    current = doc.get("value", {}) if doc else {}
    current.update(updates)

    await db.site_settings.update_one(
        {"key": LAUNCH_CHECKLIST_KEY},
        {"$set": {"key": LAUNCH_CHECKLIST_KEY, "value": current, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    return {"message": "Launch checklist saved"}


@router.post("/admin/launch-checklist/upload")
async def upload_checklist_attachment(
    file: UploadFile = File(...),
    item_id: str = Form(...),
    admin=Depends(get_current_admin),
):
    """Upload a file attachment for a launch checklist item."""
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    # Sanitize filename
    from pathlib import Path as _Path
    original_name = file.filename or "attachment"
    safe_name = re.sub(r'[^\w\-.]', '_', original_name)
    ext = _Path(safe_name).suffix or ""
    stored_name = f"checklist_{item_id[:12]}_{uuid.uuid4().hex[:8]}{ext}"

    uploads_dir = _Path(os.environ.get("UPLOADS_PATH", "uploads")) / "checklist"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    (uploads_dir / stored_name).write_bytes(contents)

    attachment = {
        "id": uuid.uuid4().hex[:12],
        "filename": original_name,
        "url": f"/uploads/checklist/{stored_name}",
        "size": len(contents),
        "content_type": file.content_type or "application/octet-stream",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    # Add attachment to the checklist item
    doc = await db.site_settings.find_one({"key": LAUNCH_CHECKLIST_KEY})
    if doc:
        current = doc.get("value", {})
        items = current.get("checklist", [])
        for item in items:
            if item.get("id") == item_id:
                if "attachments" not in item:
                    item["attachments"] = []
                item["attachments"].append(attachment)
                break
        current["checklist"] = items
        await db.site_settings.update_one(
            {"key": LAUNCH_CHECKLIST_KEY},
            {"$set": {"value": current, "updated_at": datetime.now(timezone.utc)}},
        )

    return attachment


@router.delete("/admin/launch-checklist/attachment")
async def delete_checklist_attachment(
    body: dict = Body(...),
    admin=Depends(get_current_admin),
):
    """Delete a file attachment from a launch checklist item."""
    item_id = body.get("item_id")
    attachment_id = body.get("attachment_id")
    if not item_id or not attachment_id:
        raise HTTPException(status_code=400, detail="item_id and attachment_id required")

    doc = await db.site_settings.find_one({"key": LAUNCH_CHECKLIST_KEY})
    if not doc:
        raise HTTPException(status_code=404, detail="Checklist not found")

    current = doc.get("value", {})
    items = current.get("checklist", [])
    deleted_url = None
    for item in items:
        if item.get("id") == item_id:
            attachments = item.get("attachments", [])
            for att in attachments:
                if att.get("id") == attachment_id:
                    deleted_url = att.get("url")
                    break
            item["attachments"] = [a for a in attachments if a.get("id") != attachment_id]
            break

    current["checklist"] = items
    await db.site_settings.update_one(
        {"key": LAUNCH_CHECKLIST_KEY},
        {"$set": {"value": current, "updated_at": datetime.now(timezone.utc)}},
    )

    # Delete file from disk
    if deleted_url:
        from pathlib import Path as _Path
        file_path = _Path(os.environ.get("UPLOADS_PATH", "uploads")) / deleted_url.lstrip("/uploads/")
        if file_path.exists():
            file_path.unlink(missing_ok=True)

    return {"message": "Attachment deleted"}


# ==================== APP HEALTH MONITORING ====================

# Server start time for uptime tracking
_server_start_time = time.time()

# Default infrastructure config
_DEFAULT_INFRA_CONFIG = {
    "railway": {
        "plan": "hobby",
        "max_ram_gb": 8,
        "max_vcpu": 8,
        "max_replicas": 1,
        "cost_mo": 5,
    },
    "mongodb": {
        "tier": "M0",
        "max_storage_mb": 512,
        "max_connections": 100,
        "cost_mo": 0,
    },
    "vercel": {
        "plan": "hobby",
        "max_bandwidth_gb": 100,
        "cost_mo": 0,
    },
}

# Tier specs for upgrade recommendations
_TIER_SPECS = {
    "railway": {
        "hobby": {"max_ram_gb": 8, "max_vcpu": 8, "max_replicas": 1, "cost_mo": 5},
        "pro": {"max_ram_gb": 32, "max_vcpu": 32, "max_replicas": 50, "cost_mo": 20},
    },
    "mongodb": {
        "M0": {"max_storage_mb": 512, "max_connections": 100, "cost_mo": 0},
        "M10": {"max_storage_mb": 10240, "max_connections": 1500, "cost_mo": 57},
        "M20": {"max_storage_mb": 20480, "max_connections": 1500, "cost_mo": 140},
        "M30": {"max_storage_mb": 40960, "max_connections": 3000, "cost_mo": 200},
    },
    "vercel": {
        "hobby": {"max_bandwidth_gb": 100, "cost_mo": 0},
        "pro": {"max_bandwidth_gb": 1000, "cost_mo": 20},
    },
}


def _generate_recommendations(server, database, infra):
    """Generate upgrade recommendations based on current usage vs tier limits."""
    recs = []

    # Memory check
    mem_pct = server.get("memory", {}).get("percent", 0)
    if mem_pct > 85:
        recs.append({"severity": "critical", "service": "railway", "message": f"Server memory at {mem_pct:.0f}%. Risk of OOM crashes. Upgrade Railway plan or optimize memory usage."})
    elif mem_pct > 70:
        recs.append({"severity": "warning", "service": "railway", "message": f"Server memory at {mem_pct:.0f}%. Consider upgrading to Railway Pro ($20/mo) for up to 32GB RAM."})

    # CPU check
    cpu_pct = server.get("cpu", {}).get("percent", 0)
    if cpu_pct > 85:
        recs.append({"severity": "critical", "service": "railway", "message": f"CPU at {cpu_pct:.0f}%. Requests may be slow or timing out. Upgrade to Railway Pro with multiple replicas."})
    elif cpu_pct > 70:
        recs.append({"severity": "warning", "service": "railway", "message": f"CPU at {cpu_pct:.0f}%. Consider upgrading Railway plan for more headroom."})

    # DB storage check
    db_storage = database.get("storage", {})
    used_mb = db_storage.get("used_mb", 0)
    max_mb = infra.get("mongodb", {}).get("max_storage_mb", 512)
    if max_mb > 0:
        storage_pct = (used_mb / max_mb) * 100
        if storage_pct > 80:
            next_tier = _get_next_tier("mongodb", infra.get("mongodb", {}).get("tier", "M0"))
            msg = f"Database storage at {storage_pct:.0f}% ({used_mb:.0f}MB / {max_mb}MB)."
            if next_tier:
                msg += f" Upgrade to {next_tier['name']} (${next_tier['cost_mo']}/mo) for {next_tier['max_storage_mb'] / 1024:.0f}GB storage."
            recs.append({"severity": "critical", "service": "mongodb", "message": msg})
        elif storage_pct > 60:
            recs.append({"severity": "warning", "service": "mongodb", "message": f"Database storage at {storage_pct:.0f}%. Plan ahead for growth."})

    # DB connections check
    db_conns = database.get("connections", {})
    current_conns = db_conns.get("current", 0)
    max_conns = infra.get("mongodb", {}).get("max_connections", 100)
    if max_conns > 0:
        conn_pct = (current_conns / max_conns) * 100
        if conn_pct > 80:
            recs.append({"severity": "critical", "service": "mongodb", "message": f"Database connections at {conn_pct:.0f}% ({current_conns}/{max_conns}). Risk of connection failures."})
        elif conn_pct > 60:
            recs.append({"severity": "warning", "service": "mongodb", "message": f"Database connections at {conn_pct:.0f}%. Monitor closely."})

    # Vercel commercial use warning
    vercel_plan = infra.get("vercel", {}).get("plan", "hobby")
    if vercel_plan == "hobby":
        recs.append({"severity": "critical", "service": "vercel", "message": "Vercel Hobby plan is for non-commercial use only. A production app with payments requires Vercel Pro ($20/mo)."})

    return recs


def _get_next_tier(service, current_tier):
    """Get the next tier up for a service."""
    tiers = list(_TIER_SPECS.get(service, {}).keys())
    if current_tier in tiers:
        idx = tiers.index(current_tier)
        if idx + 1 < len(tiers):
            next_name = tiers[idx + 1]
            return {"name": next_name, **_TIER_SPECS[service][next_name]}
    return None


def _generate_scale_readiness(infra):
    """Assess readiness for 100K users."""
    bottlenecks = []
    can_handle = True

    # MongoDB assessment
    mongo_tier = infra.get("mongodb", {}).get("tier", "M0")
    if mongo_tier in ("M0", "M10", "M20"):
        can_handle = False
        bottlenecks.append({
            "service": "MongoDB Atlas",
            "issue": f"{mongo_tier} has limited connections and shared/burstable CPU",
            "recommendation": "Upgrade to M30+ ($200+/mo) for 3,000 connections and dedicated vCPUs",
            "status": "fail",
        })
    else:
        bottlenecks.append({
            "service": "MongoDB Atlas",
            "issue": f"{mongo_tier} provides dedicated resources",
            "recommendation": "Monitor connection count and consider sharding for 100K+ concurrent users",
            "status": "pass",
        })

    # Railway assessment
    railway_plan = infra.get("railway", {}).get("plan", "hobby")
    max_replicas = infra.get("railway", {}).get("max_replicas", 1)
    if railway_plan == "hobby" or max_replicas < 3:
        can_handle = False
        bottlenecks.append({
            "service": "Railway (Backend)",
            "issue": f"{railway_plan.title()} plan with {max_replicas} replica(s) — insufficient for 100K users",
            "recommendation": "Upgrade to Pro ($20/mo) with 3-5 replicas for load distribution",
            "status": "fail",
        })
    else:
        bottlenecks.append({
            "service": "Railway (Backend)",
            "issue": f"Pro plan with {max_replicas} replicas available",
            "recommendation": "Scale to 3-5 active replicas during peak traffic",
            "status": "pass",
        })

    # Vercel assessment
    vercel_plan = infra.get("vercel", {}).get("plan", "hobby")
    if vercel_plan == "hobby":
        can_handle = False
        bottlenecks.append({
            "service": "Vercel (Frontend)",
            "issue": "Hobby plan: 100GB bandwidth, non-commercial use only",
            "recommendation": "Upgrade to Pro ($20/mo) for 1TB bandwidth and commercial license",
            "status": "fail",
        })
    else:
        bottlenecks.append({
            "service": "Vercel (Frontend)",
            "issue": "Pro plan with 1TB bandwidth",
            "recommendation": "Should handle 100K users. Monitor bandwidth usage.",
            "status": "pass",
        })

    # Estimate cost
    estimated_cost = "$277+/mo"
    if not can_handle:
        estimated_cost = "Minimum ~$277/mo (MongoDB M30 $200 + Railway Pro $20+usage ~$57 + Vercel Pro $20)"

    return {
        "can_handle_100k": can_handle,
        "bottlenecks": bottlenecks,
        "estimated_monthly_cost": estimated_cost,
    }


# Scale projection definitions for higher user counts
_SCALE_PROJECTIONS = [
    {
        "target_users": 250_000,
        "label": "250K Users",
        "estimated_cost": "$490 – $665/mo",
        "infrastructure": {
            "mongodb": {
                "tier": "M30 or M40",
                "cost": "$200 – $455/mo",
                "notes": "M30 minimum for dedicated vCPUs and 3K connections. M40 recommended for headroom with connection pooling across multiple backend replicas.",
            },
            "railway": {
                "plan": "Pro — 5 to 8 replicas",
                "cost": "$100 – $160/mo",
                "notes": "Each replica handles ~30K–50K registered users. Use Railway's autoscaling to add replicas during peak hours.",
            },
            "vercel": {
                "plan": "Pro",
                "cost": "$20/mo",
                "notes": "1TB bandwidth handles 250K users comfortably. Enable Vercel Edge caching for static assets.",
            },
        },
        "additional_services": [
            {
                "service": "Redis (Caching)",
                "required": True,
                "cost": "$15 – $30/mo",
                "reason": "In-memory cache won't scale across replicas. Add Redis (Railway Redis or Upstash) for shared session/rate-limit/stats caching.",
            },
        ],
        "architecture_changes": [
            "Add Redis for distributed caching across replicas",
            "Enable MongoDB connection pooling (maxPoolSize 50–100 per replica)",
            "Set up proper health-check-based autoscaling on Railway",
            "Add database indexes on frequently queried fields (last_active, is_active, created_at)",
        ],
    },
    {
        "target_users": 500_000,
        "label": "500K Users",
        "estimated_cost": "$835 – $1,215/mo",
        "infrastructure": {
            "mongodb": {
                "tier": "M40 or M50",
                "cost": "$455 – $700/mo",
                "notes": "M40 minimum. M50 provides dedicated cluster with higher IOPS and 5K+ connection limit. Consider read replicas for analytics queries.",
            },
            "railway": {
                "plan": "Pro — 10 to 15 replicas",
                "cost": "$200 – $300/mo",
                "notes": "10+ replicas with load balancing. Consider separating API and WebSocket servers into distinct Railway services.",
            },
            "vercel": {
                "plan": "Pro or Enterprise",
                "cost": "$20 – $150/mo",
                "notes": "Pro may suffice if you optimize with aggressive CDN caching. Enterprise needed if bandwidth exceeds 1TB/mo.",
            },
        },
        "additional_services": [
            {
                "service": "Redis (Caching)",
                "required": True,
                "cost": "$30 – $60/mo",
                "reason": "Dedicated Redis instance with 1GB+ memory for sessions, rate limiting, real-time features, and job queue.",
            },
            {
                "service": "CDN / Asset Storage",
                "required": True,
                "cost": "$10 – $30/mo",
                "reason": "Offload resume PDFs, profile images, and static assets to a CDN (CloudFront or Cloudflare R2) to reduce backend load.",
            },
            {
                "service": "Background Job Queue",
                "required": False,
                "cost": "$0 (BullMQ + Redis)",
                "reason": "Move email notifications, match processing, and analytics aggregation to background workers to keep API response times fast.",
            },
        ],
        "architecture_changes": [
            "Separate WebSocket service from API service on Railway",
            "Add MongoDB read replicas for dashboard/analytics queries",
            "Implement background job processing (BullMQ or Celery) for emails and notifications",
            "Add CDN for file storage (resumes, images) — serve via CDN instead of direct Railway volume",
            "Implement database query optimization and add compound indexes",
            "Set up APM monitoring (Datadog or New Relic) for performance tracking",
        ],
    },
    {
        "target_users": 750_000,
        "label": "750K Users",
        "estimated_cost": "$1,310 – $1,850/mo",
        "infrastructure": {
            "mongodb": {
                "tier": "M50 or M60",
                "cost": "$700 – $1,000/mo",
                "notes": "M50 minimum with read replicas. M60 for write-heavy workloads. Begin planning for sharding if write throughput exceeds single-node capacity.",
            },
            "railway": {
                "plan": "Pro — 15 to 20 replicas",
                "cost": "$300 – $400/mo",
                "notes": "Dedicated API replicas (12–15) plus separate WebSocket replicas (3–5). Use Railway's private networking between services.",
            },
            "vercel": {
                "plan": "Enterprise",
                "cost": "$150/mo",
                "notes": "Enterprise plan for higher bandwidth limits, SLA guarantees, and advanced caching rules.",
            },
        },
        "additional_services": [
            {
                "service": "Redis Cluster",
                "required": True,
                "cost": "$60 – $100/mo",
                "reason": "Redis cluster with 2GB+ memory and replication for high availability. Handles sessions, caching, pub/sub for WebSockets, and job queues.",
            },
            {
                "service": "CDN (CloudFront/Cloudflare)",
                "required": True,
                "cost": "$20 – $50/mo",
                "reason": "Essential for offloading static assets and API responses for public endpoints.",
            },
            {
                "service": "Search Engine (Elasticsearch/Meilisearch)",
                "required": False,
                "cost": "$50 – $100/mo",
                "reason": "MongoDB text search becomes slow at this scale. Dedicated search engine for job search, user search, and skill matching.",
            },
            {
                "service": "APM / Monitoring",
                "required": True,
                "cost": "$30 – $50/mo",
                "reason": "Datadog, New Relic, or Grafana Cloud for distributed tracing, error tracking, and performance monitoring across replicas.",
            },
        ],
        "architecture_changes": [
            "Implement MongoDB sharding strategy (shard key: user region or user_id hash)",
            "Add dedicated search service (Meilisearch or Elasticsearch) for job/user search",
            "Implement Redis pub/sub for cross-replica WebSocket message broadcasting",
            "Add rate limiting per user tier (free vs premium) at the load balancer level",
            "Set up multi-region deployment consideration for latency optimization",
            "Implement database connection pooling service (e.g., MongoDB Atlas connection pooling or PgBouncer equivalent)",
            "Add structured logging with centralized log aggregation",
        ],
    },
    {
        "target_users": 1_000_000,
        "label": "1M Users",
        "estimated_cost": "$1,950 – $3,000/mo",
        "infrastructure": {
            "mongodb": {
                "tier": "M60+ (Sharded Cluster)",
                "cost": "$1,000 – $1,500/mo",
                "notes": "Sharded M60 cluster with 2–3 shards. Separate collections for hot data (matches, swipes, messages) and cold data (old applications, archived jobs). Use Atlas Data Lake for analytics.",
            },
            "railway": {
                "plan": "Pro — 20 to 30 replicas (or dedicated infrastructure)",
                "cost": "$400 – $600/mo",
                "notes": "At 1M users, evaluate migrating to AWS ECS/EKS or GCP Cloud Run for finer autoscaling control and cost optimization. Railway Pro still works but dedicated infra offers better price-performance at this scale.",
            },
            "vercel": {
                "plan": "Enterprise",
                "cost": "$150 – $300/mo",
                "notes": "Enterprise with custom bandwidth allocation. Consider self-hosting frontend on CDN (CloudFront + S3) for cost savings at this scale.",
            },
        },
        "additional_services": [
            {
                "service": "Redis Cluster (HA)",
                "required": True,
                "cost": "$100 – $200/mo",
                "reason": "High-availability Redis cluster with 4GB+ memory, automatic failover, and read replicas. Powers caching, sessions, real-time features, and message queues.",
            },
            {
                "service": "CDN (Multi-region)",
                "required": True,
                "cost": "$50 – $100/mo",
                "reason": "Multi-region CDN with edge caching for global user base. Serves all static assets, images, and cacheable API responses.",
            },
            {
                "service": "Search Engine (Dedicated)",
                "required": True,
                "cost": "$100 – $200/mo",
                "reason": "Dedicated Elasticsearch or Meilisearch cluster for sub-100ms job search, autocomplete, and recommendation engine queries.",
            },
            {
                "service": "Message Queue (SQS/RabbitMQ)",
                "required": True,
                "cost": "$20 – $50/mo",
                "reason": "Dedicated message queue for decoupling services: email delivery, push notifications, match processing, analytics events.",
            },
            {
                "service": "APM + Log Aggregation",
                "required": True,
                "cost": "$80 – $150/mo",
                "reason": "Full observability stack: distributed tracing, custom metrics, alerting, and centralized logging across all services.",
            },
        ],
        "architecture_changes": [
            "Implement MongoDB sharding across 2–3 shards with zone-based or hash-based sharding",
            "Evaluate migration from Railway to AWS ECS/EKS or GCP Cloud Run for cost efficiency",
            "Implement microservice architecture: separate Auth, Matching, Messaging, and Notification services",
            "Add dedicated message queue (SQS, RabbitMQ, or Kafka) for async event processing",
            "Implement read/write splitting — route reads to MongoDB secondaries",
            "Add global CDN with edge functions for personalized caching",
            "Set up multi-region deployment for disaster recovery and latency optimization",
            "Implement database archival strategy — move data older than 12 months to cold storage",
            "Add load testing infrastructure (k6 or Locust) for ongoing capacity planning",
            "Consider implementing a data warehouse (BigQuery/Redshift) for analytics separate from production DB",
        ],
    },
]


def _generate_scale_projections(infra):
    """Generate scale readiness projections for 250K to 1M users."""
    mongo_tier = infra.get("mongodb", {}).get("tier", "M0")
    railway_plan = infra.get("railway", {}).get("plan", "hobby")
    max_replicas = infra.get("railway", {}).get("max_replicas", 1)
    vercel_plan = infra.get("vercel", {}).get("plan", "hobby")

    # Ordered tier levels for comparison
    mongo_levels = {"M0": 0, "M10": 1, "M20": 2, "M30": 3, "M40": 4, "M50": 5, "M60": 6}
    current_mongo_level = mongo_levels.get(mongo_tier, 0)

    projections = []
    for proj in _SCALE_PROJECTIONS:
        target = proj["target_users"]
        items = []

        # MongoDB readiness
        if target <= 250_000:
            req_level = 3  # M30
        elif target <= 500_000:
            req_level = 4  # M40
        elif target <= 750_000:
            req_level = 5  # M50
        else:
            req_level = 6  # M60

        mongo_ready = current_mongo_level >= req_level
        items.append({
            "service": "MongoDB Atlas",
            "required": proj["infrastructure"]["mongodb"]["tier"],
            "cost": proj["infrastructure"]["mongodb"]["cost"],
            "notes": proj["infrastructure"]["mongodb"]["notes"],
            "status": "pass" if mongo_ready else "fail",
        })

        # Railway readiness
        if target <= 250_000:
            req_replicas = 5
        elif target <= 500_000:
            req_replicas = 10
        elif target <= 750_000:
            req_replicas = 15
        else:
            req_replicas = 20

        railway_ready = railway_plan == "pro" and max_replicas >= req_replicas
        items.append({
            "service": "Railway (Backend)",
            "required": proj["infrastructure"]["railway"]["plan"],
            "cost": proj["infrastructure"]["railway"]["cost"],
            "notes": proj["infrastructure"]["railway"]["notes"],
            "status": "pass" if railway_ready else "fail",
        })

        # Vercel readiness
        if target <= 500_000:
            vercel_ready = vercel_plan == "pro"
        else:
            vercel_ready = False  # Enterprise needed, not configurable currently
        items.append({
            "service": "Vercel (Frontend)",
            "required": proj["infrastructure"]["vercel"]["plan"],
            "cost": proj["infrastructure"]["vercel"]["cost"],
            "notes": proj["infrastructure"]["vercel"]["notes"],
            "status": "pass" if vercel_ready else "fail",
        })

        can_handle = all(item["status"] == "pass" for item in items)

        projections.append({
            "target_users": target,
            "label": proj["label"],
            "can_handle": can_handle,
            "estimated_cost": proj["estimated_cost"],
            "items": items,
            "additional_services": proj["additional_services"],
            "architecture_changes": proj["architecture_changes"],
        })

    return projections


@router.get("/admin/health")
async def admin_health(admin: dict = Depends(get_current_admin)):
    """Comprehensive app health check with infrastructure metrics."""
    # --- Server metrics ---
    process = psutil.Process()
    with process.oneshot():
        mem_info = process.memory_info()
        cpu_pct = process.cpu_percent(interval=0.1)

    sys_mem = psutil.virtual_memory()
    uptime = time.time() - _server_start_time

    server = {
        "status": "healthy",
        "uptime_seconds": int(uptime),
        "memory": {
            "used_mb": round(mem_info.rss / 1024 / 1024, 1),
            "total_mb": round(sys_mem.total / 1024 / 1024, 1),
            "percent": round(mem_info.rss / sys_mem.total * 100, 1),
        },
        "cpu": {
            "percent": round(cpu_pct, 1),
            "system_percent": round(psutil.cpu_percent(interval=0.1), 1),
        },
        "workers": 4,
        "websocket_connections": sum(len(conns) for conns in manager.active_connections.values()),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
    }

    # --- Database metrics ---
    database = {"status": "unknown", "storage": {}, "connections": {}, "ops": {}, "collections": 0, "documents": 0}
    try:
        db_stats = await db.command("dbStats")
        database["storage"] = {
            "used_mb": round(db_stats.get("storageSize", 0) / 1024 / 1024, 1),
            "data_mb": round(db_stats.get("dataSize", 0) / 1024 / 1024, 1),
            "index_mb": round(db_stats.get("indexSize", 0) / 1024 / 1024, 1),
        }
        database["collections"] = db_stats.get("collections", 0)
        database["documents"] = db_stats.get("objects", 0)
        database["status"] = "healthy"
    except Exception as e:
        logger.warning(f"Could not get dbStats: {e}")
        database["status"] = "error"

    try:
        server_status = await db.command("serverStatus")
        conns = server_status.get("connections", {})
        database["connections"] = {
            "current": conns.get("current", 0),
            "available": conns.get("available", 0),
            "total_created": conns.get("totalCreated", 0),
        }
        ops = server_status.get("opcounters", {})
        database["ops"] = {
            "insert": ops.get("insert", 0),
            "query": ops.get("query", 0),
            "update": ops.get("update", 0),
            "delete": ops.get("delete", 0),
            "command": ops.get("command", 0),
        }
    except Exception as e:
        logger.warning(f"Could not get serverStatus (may be restricted on M0): {e}")

    # --- App metrics ---
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    total_users, active_users, total_jobs, active_jobs, total_matches, total_applications = await asyncio.gather(
        db.users.count_documents({}),
        db.users.count_documents({"last_active": {"$gte": thirty_days_ago.isoformat()}}),
        db.jobs.count_documents({}),
        db.jobs.count_documents({"is_active": True}),
        db.matches.count_documents({}),
        db.applications.count_documents({}),
    )

    app_metrics = {
        "total_users": total_users,
        "active_users_30d": active_users,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "total_matches": total_matches,
        "total_applications": total_applications,
    }

    # --- Infrastructure config ---
    config = await db.health_config.find_one({"_id": "infra"})
    if config:
        infra = {k: config[k] for k in ("railway", "mongodb", "vercel") if k in config}
    else:
        infra = _DEFAULT_INFRA_CONFIG

    # --- Recommendations ---
    recommendations = _generate_recommendations(server, database, infra)

    # --- Scale readiness ---
    scale_readiness = _generate_scale_readiness(infra)

    # --- Scale projections (250K–1M) ---
    scale_projections = _generate_scale_projections(infra)

    return {
        "server": server,
        "database": database,
        "app": app_metrics,
        "infrastructure": infra,
        "recommendations": recommendations,
        "scale_readiness": scale_readiness,
        "scale_projections": scale_projections,
    }


@router.put("/admin/health/config")
async def update_health_config(body: dict = Body(...), admin: dict = Depends(get_current_admin)):
    """Update infrastructure tier configuration."""
    allowed_fields = {"railway", "mongodb", "vercel"}
    update = {}

    for field in allowed_fields:
        if field in body:
            data = body[field]
            if field == "railway":
                plan = data.get("plan", "hobby")
                specs = _TIER_SPECS["railway"].get(plan, _TIER_SPECS["railway"]["hobby"])
                update["railway"] = {"plan": plan, **specs}
            elif field == "mongodb":
                tier = data.get("tier", "M0")
                specs = _TIER_SPECS["mongodb"].get(tier, _TIER_SPECS["mongodb"]["M0"])
                update["mongodb"] = {"tier": tier, **specs}
            elif field == "vercel":
                plan = data.get("plan", "hobby")
                specs = _TIER_SPECS["vercel"].get(plan, _TIER_SPECS["vercel"]["hobby"])
                update["vercel"] = {"plan": plan, **specs}

    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    await db.health_config.update_one(
        {"_id": "infra"},
        {"$set": update},
        upsert=True,
    )

    return {"status": "updated", "config": update}


# ==================== VERIFICATION REQUESTS ====================

@router.get("/admin/verification-requests")
async def list_verification_requests(
    status: str = "pending",
    page: int = 1,
    limit: int = 20,
    admin: dict = Depends(get_current_admin),
):
    """List verification requests (default: pending)."""
    query = {}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    total = await db.verification_requests.count_documents(query)
    items = await db.verification_requests.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"items": items, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.put("/admin/verification-requests/{request_id}")
async def review_verification_request(
    request_id: str,
    body: dict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    """Approve or reject a verification request."""
    action = body.get("action")  # "approve" or "reject"
    reason = body.get("reason", "")

    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    req = await db.verification_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Verification request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req['status']}")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if action == "approve" else "rejected"

    await db.verification_requests.update_one(
        {"id": request_id},
        {"$set": {"status": new_status, "reviewed_by": admin.get("email", ""), "reason": reason, "updated_at": now}},
    )

    user_id = req["user_id"]
    if action == "approve":
        await db.users.update_one({"id": user_id}, {"$set": {"verified": True, "verification_status": "approved", "verified_at": now}})
        await create_notification(user_id, "verification", "Profile Verified!", "Your profile has been verified. You now have a verified badge!")
    else:
        await db.users.update_one({"id": user_id}, {"$set": {"verification_status": "rejected"}})
        msg = f"Your verification request was not approved."
        if reason:
            msg += f" Reason: {reason}"
        await create_notification(user_id, "verification", "Verification Update", msg)

    return {"status": new_status, "user_id": user_id}


@router.put("/admin/users/{user_id}/revoke-verification")
async def revoke_user_verification(
    user_id: str,
    body: dict = Body(default={}),
    admin: dict = Depends(get_current_admin),
):
    """Remove verified status from a user."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "verified": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reason = body.get("reason", "")
    now = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"verified": False, "verification_status": "revoked", "verified_at": None}},
    )

    # Update the verification request record too if one exists
    await db.verification_requests.update_many(
        {"user_id": user_id, "status": "approved"},
        {"$set": {"status": "revoked", "revoked_by": admin.get("email", ""), "revoke_reason": reason, "updated_at": now}},
    )

    msg = "Your profile verification has been removed."
    if reason:
        msg += f" Reason: {reason}"
    await create_notification(user_id, "verification", "Verification Removed", msg)
    invalidate_user(user_id)

    return {"status": "revoked", "user_id": user_id}
