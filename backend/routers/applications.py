"""
Applications/Swipe routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import logging
from datetime import datetime, timezone, timedelta
import uuid
import asyncio

from database import (
    db, get_current_user, manager, send_email_notification, create_notification,
    send_system_message,
    SwipeAction, ApplicationResponse, RecruiterAction, MatchResponse
)
from cache import invalidate_user, invalidate, stats_cache, cache_key

router = APIRouter(tags=["Applications"])

DAILY_SUPERLIKE_LIMIT = 3

def _get_seeker_daily_superlike_limit(user: dict) -> int:
    """Return the daily super like limit based on seeker subscription tier."""
    sub = user.get("subscription", {})
    now = datetime.now(timezone.utc).isoformat()
    if sub.get("status") == "active" and sub.get("period_end", "") >= now:
        tier = sub.get("tier_id", "")
        if tier == "seeker_premium":
            return 999  # effectively unlimited
        elif tier == "seeker_plus":
            return 10
    return DAILY_SUPERLIKE_LIMIT

# ==================== EMAIL TEMPLATES ====================

def get_match_email_html(job_title: str, company: str, other_name: str, is_seeker: bool = True):
    """Generate match notification email HTML"""
    if is_seeker:
        message = f"Great news! {company} is interested in your application for the {job_title} position."
        cta_text = "View Match"
    else:
        message = f"{other_name} has applied to your {job_title} position at {company}."
        cta_text = "View Applicant"
    
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">Hireabble</h1>
        </div>
        <div style="background: linear-gradient(135deg, #6366f1 0%, #d946ef 100%); padding: 30px; border-radius: 16px; text-align: center;">
            <h2 style="color: white; margin: 0 0 10px 0;">It's a Match!</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px;">{job_title}</p>
            <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0;">{company}</p>
        </div>
        <div style="padding: 30px 20px; text-align: center;">
            <p style="color: #333; font-size: 16px; margin-bottom: 25px;">{message}</p>
            <a href="{os.environ.get('FRONTEND_URL', 'https://hireabble.com')}/matches" style="display: inline-block; background: #6366f1; color: white; padding: 14px 40px; border-radius: 25px; text-decoration: none; font-weight: bold;">{cta_text}</a>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>Hireabble - Your career starts with a swipe</p>
        </div>
    </div>
    """

# ==================== SUPER LIKES ====================

@router.get("/superlikes/remaining")
async def get_remaining_superlikes(current_user: dict = Depends(get_current_user)):
    """Get remaining super likes for today (free daily + purchased)"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can access this")

    # Get today's date range
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Count super likes used today
    superlikes_today = await db.applications.count_documents({
        "seeker_id": current_user["id"],
        "action": "superlike",
        "created_at": {
            "$gte": today_start.isoformat(),
            "$lt": today_end.isoformat()
        }
    })

    # Get purchased super likes balance and subscription
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "seeker_purchased_superlikes": 1, "subscription": 1})
    purchased = (user or {}).get("seeker_purchased_superlikes", 0)
    daily_limit = _get_seeker_daily_superlike_limit(user or {})

    free_remaining = max(0, daily_limit - superlikes_today)

    return {
        "remaining": free_remaining + purchased,
        "free_remaining": free_remaining,
        "purchased_remaining": purchased,
        "used_today": superlikes_today,
        "daily_limit": daily_limit,
    }

# ==================== RECRUITER CANDIDATE DISCOVERY ====================

DAILY_RECRUITER_SUPERSWIPE_LIMIT = 3

@router.get("/candidates")
async def browse_candidates(
    current_user: dict = Depends(get_current_user),
    location: str = None,
    experience_level: str = None,
    skill: str = None,
):
    """Browse seekers for recruiters to discover potential candidates"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can browse candidates")

    # Get seekers the recruiter has already swiped on
    already_swiped = await db.recruiter_swipes.find(
        {"recruiter_id": current_user["id"]},
        {"seeker_id": 1}
    ).to_list(1000)
    swiped_ids = [s["seeker_id"] for s in already_swiped]

    # Also exclude seekers who already applied to this recruiter's jobs (they appear in applicants)
    existing_apps = await db.applications.find(
        {"recruiter_id": current_user["id"], "action": {"$in": ["like", "superlike"]}},
        {"seeker_id": 1}
    ).to_list(1000)
    applicant_ids = [a["seeker_id"] for a in existing_apps]

    exclude_ids = list(set(swiped_ids + applicant_ids + [current_user["id"]]))

    query = {
        "role": "seeker",
        "id": {"$nin": exclude_ids},
        "onboarding_complete": True,
        # Exclude incognito mode users
        "incognito_mode": {"$ne": True},
        # Only show seekers who have uploaded a photo
        "photo_url": {"$ne": None, "$exists": True},
    }

    # Apply filters
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if experience_level:
        level_map = {"entry": (0, 2), "mid": (2, 5), "senior": (5, 10), "lead": (8, 99)}
        low, high = level_map.get(experience_level, (0, 99))
        query["experience_years"] = {"$gte": low, "$lte": high}
    if skill:
        query["skills"] = {"$regex": skill, "$options": "i"}

    # Exclude banned/suspended users
    query["$or"] = [
        {"status": {"$exists": False}},
        {"status": "active"},
        {"status": None},
    ]

    seekers = await db.users.find(
        query, {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(50)

    # Get recruiter's jobs for match scoring
    recruiter_jobs = await db.jobs.find(
        {"recruiter_id": current_user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(50)

    # Calculate best match score across all recruiter jobs
    from routers.jobs import calculate_job_match_score
    now = datetime.now(timezone.utc).isoformat()
    for seeker in seekers:
        best_score = 0
        best_job = None
        for job in recruiter_jobs:
            score = calculate_job_match_score(seeker, job)
            if score > best_score:
                best_score = score
                best_job = job
        seeker["match_score"] = best_score
        seeker["best_match_job"] = best_job.get("title") if best_job else None
        seeker["best_match_job_id"] = best_job.get("id") if best_job else None

        # Featured profile boost for premium seekers
        sub = seeker.get("subscription") or {}
        if (sub.get("status") == "active" and sub.get("period_end", "") >= now
                and sub.get("tier_id") == "seeker_premium"):
            seeker["is_featured"] = True
            seeker["match_score"] = min(100, best_score + 15)

        # Profile boost (active 30-min boost from subscription perk)
        boost_until = seeker.get("profile_boost_until", "")
        if boost_until and boost_until >= now:
            seeker["is_boosted"] = True
            seeker["match_score"] = min(100, seeker["match_score"] + 20)

    # Sort: boosted first, then featured, then by match score
    seekers.sort(key=lambda s: (
        2 if s.get("is_boosted") else (1 if s.get("is_featured") else 0),
        s.get("match_score", 0)
    ), reverse=True)

    return seekers


@router.get("/candidates/superswipes/remaining")
async def get_remaining_superswipes(current_user: dict = Depends(get_current_user)):
    """Get remaining super swipes for recruiter today"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    swipes_today = await db.recruiter_swipes.count_documents({
        "recruiter_id": current_user["id"],
        "action": "superlike",
        "created_at": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}
    })

    user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_super_swipes": 1, "subscription": 1})
    purchased = (user_data or {}).get("recruiter_super_swipes", 0)

    # Check subscription for higher limit
    sub = (user_data or {}).get("subscription", {})
    now = datetime.now(timezone.utc).isoformat()
    daily_limit = DAILY_RECRUITER_SUPERSWIPE_LIMIT
    if sub.get("status") == "active" and sub.get("period_end", "") >= now:
        tier = sub.get("tier_id", "")
        if tier == "recruiter_enterprise":
            daily_limit = 999  # unlimited
        elif tier == "recruiter_pro":
            daily_limit = 10

    free_remaining = max(0, daily_limit - swipes_today)
    return {
        "remaining": free_remaining + purchased,
        "free_remaining": free_remaining,
        "purchased_remaining": purchased,
        "used_today": swipes_today,
        "daily_limit": daily_limit,
    }


async def _recruiter_swipe_post_process(
    swipe_id: str,
    seeker_id: str,
    action: str,
    recruiter_snapshot: dict,
):
    """Background task for recruiter swipe: match checking + notifications."""
    try:
        rid = recruiter_snapshot["id"]
        invalidate_user(rid)

        if action not in ("like", "superlike"):
            return

        # Check if seeker applied to any of this recruiter's jobs
        seeker_app = await db.applications.find_one({
            "seeker_id": seeker_id,
            "recruiter_id": rid,
            "action": {"$in": ["like", "superlike"]},
            "is_matched": False,
        })

        if seeker_app:
            # Guard: check if a match already exists (race with seeker swipe)
            existing_match = await db.matches.find_one({
                "seeker_id": seeker_id,
                "job_id": seeker_app["job_id"],
            })
            if existing_match:
                return  # match already created by seeker swipe path

            # Mutual interest → auto-match
            seeker, job = await asyncio.gather(
                db.users.find_one({"id": seeker_id}, {"_id": 0, "name": 1, "avatar": 1}),
                db.jobs.find_one({"id": seeker_app["job_id"]}, {"_id": 0, "title": 1, "company": 1}),
            )
            match_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            match_doc = {
                "id": match_id,
                "application_id": seeker_app["id"],
                "job_id": seeker_app["job_id"],
                "job_title": job["title"] if job else "Unknown",
                "company": job["company"] if job else recruiter_snapshot.get("company", "Unknown"),
                "seeker_id": seeker_id,
                "seeker_name": seeker.get("name", "") if seeker else "",
                "seeker_avatar": seeker.get("avatar") if seeker else None,
                "recruiter_id": rid,
                "recruiter_name": recruiter_snapshot["name"],
                "created_at": now,
            }

            try:
                await asyncio.gather(
                    db.matches.insert_one(match_doc),
                    db.applications.update_one(
                        {"id": seeker_app["id"]},
                        {"$set": {"recruiter_action": "accept", "is_matched": True}}
                    ),
                )
            except Exception as insert_err:
                if "duplicate key" in str(insert_err).lower() or "E11000" in str(insert_err):
                    return  # match created by concurrent seeker swipe
                raise

            match_payload = {k: v for k, v in match_doc.items() if k != "_id"}
            await asyncio.gather(
                create_notification(
                    user_id=seeker_id,
                    notif_type="match",
                    title="It's a Match!",
                    message=f"{recruiter_snapshot.get('company', 'A company')} is interested in you for the {job['title'] if job else 'a'} position!",
                    data={"match_id": match_id}
                ),
                manager.send_to_user(seeker_id, {"type": "new_match", "match": match_payload}),
                manager.send_to_user(rid, {"type": "new_match", "match": match_payload}),
            )
        else:
            # No existing application — notify seeker of recruiter interest
            await create_notification(
                user_id=seeker_id,
                notif_type="recruiter_interest",
                title="A recruiter is interested!",
                message=f"{recruiter_snapshot.get('company', 'A company')} thinks you'd be a great fit. Check out their job listings!",
                data={"recruiter_id": rid}
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Recruiter swipe post-process error: {e}")


@router.post("/candidates/swipe")
async def recruiter_swipe_candidate(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Recruiter swipes on a candidate (like, pass, superlike).

    Optimized: parallel validation, immediate insert, async post-processing."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can swipe on candidates")

    seeker_id = body.get("seeker_id")
    action = body.get("action", "like")
    job_id = body.get("job_id")

    if not seeker_id:
        raise HTTPException(status_code=400, detail="seeker_id is required")
    if action not in ("like", "pass", "superlike"):
        raise HTTPException(status_code=400, detail="Action must be like, pass, or superlike")

    rid = current_user["id"]
    is_superlike = action == "superlike"

    # ── Phase 1: Parallel pre-validation ──────────────────────────────
    queries = []
    if is_superlike:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        queries.append(
            db.recruiter_swipes.count_documents({
                "recruiter_id": rid, "action": "superlike",
                "created_at": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}
            })
        )  # 0: swipes_today
        queries.append(
            db.users.find_one({"id": rid}, {"_id": 0, "recruiter_super_swipes": 1, "subscription": 1})
        )  # 1: user_data

    if queries:
        results = await asyncio.gather(*queries)
    else:
        results = []

    # Superlike limit check
    if is_superlike:
        swipes_today = results[0]
        user_data = results[1]
        purchased = (user_data or {}).get("recruiter_super_swipes", 0)

        sub = (user_data or {}).get("subscription", {})
        now = datetime.now(timezone.utc).isoformat()
        daily_limit = DAILY_RECRUITER_SUPERSWIPE_LIMIT
        if sub.get("status") == "active" and sub.get("period_end", "") >= now:
            tier = sub.get("tier_id", "")
            if tier == "recruiter_enterprise":
                daily_limit = 999
            elif tier == "recruiter_pro":
                daily_limit = 10

        free_remaining = max(0, daily_limit - swipes_today)
        if free_remaining <= 0 and purchased <= 0:
            raise HTTPException(status_code=400, detail="No Super Swipes remaining! Purchase more or try again tomorrow.")
        if free_remaining <= 0 and purchased > 0:
            asyncio.create_task(
                db.users.update_one({"id": rid}, {"$inc": {"recruiter_super_swipes": -1}})
            )

    # ── Phase 2: Insert immediately ───────────────────────────────────
    swipe_doc = {
        "id": str(uuid.uuid4()),
        "recruiter_id": rid,
        "seeker_id": seeker_id,
        "action": action,
        "job_id": job_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await db.recruiter_swipes.insert_one(swipe_doc)
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            raise HTTPException(status_code=400, detail="Already swiped on this candidate")
        raise

    # Track profile view
    asyncio.create_task(_record_profile_view(rid, seeker_id))

    # ── Phase 3: Return immediately, process the rest in background ───
    asyncio.create_task(
        _recruiter_swipe_post_process(swipe_doc["id"], seeker_id, action, dict(current_user))
    )

    return {"message": f"Swiped {action}", "is_matched": False}


# ==================== SWIPE ====================

async def _check_match_on_swipe(
    application_id: str,
    job: dict,
    current_user_snapshot: dict,
    action_str: str,
    job_id: str,
):
    """Inline match check — returns match data if mutual interest exists.
    Called synchronously so the HTTP response includes the match for the modal."""
    uid = current_user_snapshot["id"]
    invalidate_user(uid)

    if action_str not in ("like", "superlike"):
        return None

    # Check if recruiter already swiped on this seeker → auto-match
    recruiter_swipe = await db.recruiter_swipes.find_one({
        "recruiter_id": job["recruiter_id"],
        "seeker_id": uid,
        "action": {"$in": ["like", "superlike"]},
    })
    if not recruiter_swipe:
        return None

    # Guard against duplicate matches (race with recruiter swipe creating one too)
    existing_match = await db.matches.find_one({"seeker_id": uid, "job_id": job_id})
    if existing_match:
        return {k: v for k, v in existing_match.items() if k != "_id"}

    # Mutual interest — create match
    match_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    match_doc = {
        "id": match_id,
        "application_id": application_id,
        "job_id": job_id,
        "job_title": job.get("title", "Unknown"),
        "company": job.get("company", "Unknown"),
        "seeker_id": uid,
        "seeker_name": current_user_snapshot["name"],
        "seeker_avatar": current_user_snapshot.get("avatar"),
        "recruiter_id": job["recruiter_id"],
        "recruiter_name": job.get("recruiter_name", ""),
        "created_at": now,
    }

    try:
        await asyncio.gather(
            db.matches.insert_one(match_doc),
            db.applications.update_one(
                {"id": application_id},
                {"$set": {"recruiter_action": "accept", "is_matched": True}}
            ),
        )
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            existing = await db.matches.find_one({"seeker_id": uid, "job_id": job_id})
            return {k: v for k, v in existing.items() if k != "_id"} if existing else None
        raise

    match_payload = {k: v for k, v in match_doc.items() if k != "_id"}

    # Notifications + WebSocket in background (don't block the response)
    asyncio.create_task(_swipe_match_notify(
        match_id, match_payload, job, current_user_snapshot, uid, job_id
    ))

    return match_payload


async def _swipe_match_notify(match_id, match_payload, job, current_user_snapshot, uid, job_id):
    """Background: send match notifications + WebSocket after match is created."""
    try:
        await asyncio.gather(
            create_notification(
                user_id=job["recruiter_id"],
                notif_type="match",
                title="It's a Match!",
                message=f"{current_user_snapshot['name']} applied to {job.get('title', 'your position')} - mutual interest!",
                data={"match_id": match_id, "job_id": job_id}
            ),
            manager.send_to_user(uid, {"type": "new_match", "match": match_payload}),
            manager.send_to_user(job["recruiter_id"], {"type": "new_match", "match": match_payload}),
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Swipe match notify error: {e}")


@router.post("/swipe")
async def swipe(action: SwipeAction, current_user: dict = Depends(get_current_user)):
    """Job seeker swipes on a job.

    Optimized for speed: validates + writes in parallel, then kicks off
    match-checking and notifications as a background task so the response
    returns in <50ms even under load."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can swipe")

    uid = current_user["id"]
    is_superlike = action.action == "superlike"

    # ── Phase 1: Parallel pre-validation ──────────────────────────────
    # Run ALL pre-checks concurrently instead of sequentially.
    queries = [
        db.jobs.find_one({"id": action.job_id}, {"_id": 0}),  # 0: job
    ]
    if is_superlike:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        queries.append(
            db.applications.count_documents({
                "seeker_id": uid, "action": "superlike",
                "created_at": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}
            })
        )  # 1: superlikes_today
        queries.append(
            db.users.find_one({"id": uid}, {"_id": 0, "seeker_purchased_superlikes": 1, "subscription": 1})
        )  # 2: user_data

    results = await asyncio.gather(*queries)
    job = results[0]
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Superlike limit check
    remaining_superlikes = None
    if is_superlike:
        superlikes_today = results[1]
        user_data = results[2]
        purchased = (user_data or {}).get("seeker_purchased_superlikes", 0)
        daily_limit = _get_seeker_daily_superlike_limit(user_data or {})
        free_remaining = max(0, daily_limit - superlikes_today)

        if free_remaining <= 0 and purchased <= 0:
            raise HTTPException(status_code=400, detail="No Super Likes remaining! Purchase more or try again tomorrow.")

        # Deduct purchased superlike (non-blocking — fire and forget)
        if free_remaining <= 0 and purchased > 0:
            asyncio.create_task(
                db.users.update_one({"id": uid}, {"$inc": {"seeker_purchased_superlikes": -1}})
            )
            purchased -= 1

        # Compute remaining from data we already have (no second query!)
        remaining_superlikes = max(0, free_remaining - 1) + purchased

    # ── Phase 2: Upsert (idempotent — safe for retries) ──────────────
    # Check if this job was already swiped on (handles retry queue, sendBeacon, etc.)
    existing = await db.applications.find_one(
        {"seeker_id": uid, "job_id": action.job_id},
        {"_id": 0, "id": 1}
    )
    if existing:
        # Already swiped — return success (idempotent), don't create a duplicate
        # Invalidate caches so dashboard reflects the latest state
        invalidate(stats_cache, cache_key("stats", uid))
        return {
            "message": f"Swiped {action.action}",
            "application_id": existing["id"],
            "remaining_superlikes": remaining_superlikes,
            "match": None,
        }

    application_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    application_doc = {
        "id": application_id,
        "job_id": action.job_id,
        "seeker_id": uid,
        "seeker_name": current_user["name"],
        "seeker_title": current_user.get("title"),
        "seeker_skills": current_user.get("skills", []),
        "seeker_avatar": current_user.get("avatar"),
        "seeker_photo": current_user.get("photo_url"),
        "seeker_video": current_user.get("video_url"),
        "seeker_experience": current_user.get("experience_years"),
        "seeker_school": current_user.get("school"),
        "seeker_degree": current_user.get("degree"),
        "seeker_location": current_user.get("location"),
        "seeker_current_employer": current_user.get("current_employer"),
        "seeker_bio": current_user.get("bio"),
        "job_title": job.get("title", ""),
        "recruiter_id": job["recruiter_id"],
        "action": action.action,
        "is_matched": False,
        "recruiter_action": None,
        "created_at": now,
    }

    # Attach note to Super Like (Premium seekers only, max 140 chars)
    if is_superlike and action.note:
        sub = current_user.get("subscription") or {}
        if (sub.get("status") == "active" and sub.get("period_end", "") >= now
                and sub.get("tier_id") == "seeker_premium"):
            application_doc["superlike_note"] = action.note[:140]

    try:
        await db.applications.insert_one(application_doc)
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            # Race condition: another request beat us — return success (idempotent)
            invalidate(stats_cache, cache_key("stats", uid))
            return {
                "message": f"Swiped {action.action}",
                "application_id": application_id,
                "remaining_superlikes": remaining_superlikes,
                "match": None,
            }
        raise

    # Invalidate stats cache immediately so the next dashboard fetch gets fresh counts
    invalidate(stats_cache, cache_key("stats", uid))

    # ── Phase 3: Check for match inline so the response includes match data ───
    # This enables the frontend to show the "It's a Match!" modal immediately.
    match_data = None
    try:
        match_data = await _check_match_on_swipe(
            application_id, job, dict(current_user), action.action, action.job_id
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Match check error (non-fatal): {e}")

    return {
        "message": f"Swiped {action.action}",
        "application_id": application_id,
        "remaining_superlikes": remaining_superlikes,
        "match": match_data,
    }


# ==================== UNDO LAST SWIPE ====================

@router.post("/swipe/undo")
async def undo_last_swipe(current_user: dict = Depends(get_current_user)):
    """Undo the seeker's most recent swipe.

    Requires an active subscription with can_undo enabled (seeker_plus or seeker_premium).
    Deletes the application record and removes the job from swiped history so
    the card reappears in the deck.
    """
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can undo swipes")

    uid = current_user["id"]

    # Check subscription allows undo
    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc).isoformat()
    can_undo = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")
    )
    if not can_undo:
        raise HTTPException(status_code=403, detail="Upgrade to Plus or Premium to undo swipes")

    # Find the most recent application (like or superlike, not pass)
    last_app = await db.applications.find_one(
        {"seeker_id": uid, "action": {"$in": ["like", "superlike"]}},
        sort=[("created_at", -1)],
        projection={"_id": 0},
    )
    if not last_app:
        raise HTTPException(status_code=404, detail="No recent swipe to undo")

    # Don't allow undo if already matched or recruiter already acted
    if last_app.get("is_matched") or last_app.get("recruiter_action"):
        raise HTTPException(status_code=400, detail="Cannot undo — recruiter has already responded or you matched")

    # Delete the application
    await db.applications.delete_one({"id": last_app["id"]})

    # If it was a superlike, refund the daily count (by not doing anything — the count
    # is derived from DB at query time, so deleting the record is sufficient)

    # Invalidate stats cache
    invalidate(stats_cache, cache_key("stats", uid))

    return {
        "message": "Swipe undone",
        "undone_job_id": last_app["job_id"],
        "undone_action": last_app["action"],
    }


# ==================== BEACON SWIPE (page unload) ====================

@router.post("/swipe/beacon")
async def swipe_beacon(request: Request, token: Optional[str] = Query(None)):
    """sendBeacon-compatible swipe endpoint.

    sendBeacon cannot set Authorization headers, so the JWT is passed as a
    query parameter.  This endpoint does a best-effort fire-and-forget save
    (no response body needed — the page is already closing)."""
    import jwt as _jwt
    from database import JWT_SECRET, JWT_ALGORITHM

    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    try:
        payload = _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid body")

    job_id = body.get("job_id")
    action_str = body.get("action", "like")
    if not job_id or action_str not in ("like", "pass", "superlike"):
        raise HTTPException(status_code=400, detail="Invalid swipe data")

    # Check if already swiped (idempotent)
    existing = await db.applications.find_one(
        {"seeker_id": user_id, "job_id": job_id}, {"_id": 1}
    )
    if existing:
        return {"ok": True}

    # Minimal save — no match checking (page is already gone)
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "title": 1, "recruiter_id": 1})
    if not job:
        return {"ok": True}  # job deleted, nothing to do

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        return {"ok": True}

    application_doc = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "seeker_id": user_id,
        "seeker_name": user.get("name", ""),
        "seeker_title": user.get("title"),
        "seeker_skills": user.get("skills", []),
        "seeker_avatar": user.get("avatar"),
        "seeker_photo": user.get("photo_url"),
        "seeker_video": user.get("video_url"),
        "seeker_experience": user.get("experience_years"),
        "seeker_school": user.get("school"),
        "seeker_degree": user.get("degree"),
        "seeker_location": user.get("location"),
        "seeker_current_employer": user.get("current_employer"),
        "seeker_bio": user.get("bio"),
        "job_title": job.get("title", ""),
        "recruiter_id": job.get("recruiter_id", ""),
        "action": action_str,
        "is_matched": False,
        "recruiter_action": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await db.applications.insert_one(application_doc)
        invalidate(stats_cache, cache_key("stats", user_id))
    except Exception:
        pass  # best-effort

    return {"ok": True}


# ==================== RECRUITER APPLICATIONS ====================

@router.get("/applications", response_model=List[ApplicationResponse])
async def get_applications(
    current_user: dict = Depends(get_current_user),
    job_id: str = None
):
    """Get applications for recruiter's jobs"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view applications")

    query = {
        "recruiter_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    }
    if job_id:
        query["job_id"] = job_id

    applications = await db.applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Check seeker subscription status for priority sorting
    now = datetime.now(timezone.utc).isoformat()
    seeker_ids = list(set(a.get("seeker_id") for a in applications if a.get("seeker_id")))
    premium_seekers = set()
    if seeker_ids:
        seekers = await db.users.find(
            {"id": {"$in": seeker_ids}},
            {"_id": 0, "id": 1, "subscription": 1}
        ).to_list(len(seeker_ids))
        for s in seekers:
            sub = s.get("subscription", {})
            if sub.get("status") == "active" and sub.get("period_end", "") >= now:
                premium_seekers.add(s["id"])

    # Mark premium applicants
    for app in applications:
        if app.get("seeker_id") in premium_seekers:
            app["is_premium_seeker"] = True

    # Sort: superlikes first, then premium seekers, then regular - newest first within each group
    superlikes = [a for a in applications if a.get("action") == "superlike"]
    premium_regulars = [a for a in applications if a.get("action") != "superlike" and a.get("is_premium_seeker")]
    regulars = [a for a in applications if a.get("action") != "superlike" and not a.get("is_premium_seeker")]
    superlikes.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    premium_regulars.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    regulars.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    applications = superlikes + premium_regulars + regulars
    return applications


@router.get("/applications/mine")
async def get_my_applications(current_user: dict = Depends(get_current_user)):
    """Get all jobs the current seeker has applied to, with job details and status"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can view their applications")

    # Check if seeker has premium read receipts
    sub = current_user.get("subscription") or {}
    now_iso = datetime.now(timezone.utc).isoformat()
    has_read_receipts = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now_iso
        and sub.get("tier_id") == "seeker_premium"
    )

    applications = await db.applications.find(
        {"seeker_id": current_user["id"], "action": {"$in": ["like", "superlike"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    # Batch-fetch all referenced jobs in one query instead of N+1
    job_ids = list(set(app.get("job_id") for app in applications if app.get("job_id")))
    jobs_list = await db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0}).to_list(len(job_ids)) if job_ids else []
    jobs_map = {j["id"]: j for j in jobs_list}

    result = []
    for app in applications:
        job = jobs_map.get(app.get("job_id"))
        status = "matched" if app.get("is_matched") else (
            "declined" if app.get("recruiter_action") == "reject" else "pending"
        )
        app_id = app.get("id") or str(app.get("_id", ""))
        if not app_id or not app.get("job_id"):
            continue  # Skip malformed application docs
        app_entry = {
            "id": app_id,
            "job_id": app.get("job_id"),
            "action": app.get("action", "like"),
            "status": status,
            "pipeline_stage": app.get("pipeline_stage", "applied"),
            "recruiter_action": app.get("recruiter_action"),
            "is_matched": app.get("is_matched", False),
            "created_at": app.get("created_at", ""),
            "job": {
                "title": job.get("title", "Job Removed") if job else "Job Removed",
                "company": job.get("company", "") if job else "",
                "location": job.get("location", "") if job else "",
                "job_type": job.get("job_type", "") if job else "",
                "salary_min": job.get("salary_min") if job else None,
                "salary_max": job.get("salary_max") if job else None,
                "company_logo": job.get("company_logo") if job else None,
                "employment_type": job.get("employment_type", "full-time") if job else "",
            },
        }
        # Include read receipt for premium seekers
        if has_read_receipts and app.get("read_at"):
            app_entry["read_at"] = app["read_at"]
        # Flag for application insights availability (premium only)
        if has_read_receipts:
            app_entry["has_insights"] = True
        result.append(app_entry)

    return result

@router.post("/applications/respond")
async def respond_to_application(response: RecruiterAction, current_user: dict = Depends(get_current_user)):
    """Recruiter responds to an application"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can respond to applications")
    
    application = await db.applications.find_one({
        "id": response.application_id,
        "recruiter_id": current_user["id"]
    })
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Idempotency: don't process if already responded
    if application.get("recruiter_action") is not None:
        return {"message": f"Application already {application['recruiter_action']}ed", "is_matched": application.get("is_matched", False)}

    is_matched = response.action == "accept"
    
    stage_update = "shortlisted" if is_matched else "declined"
    await db.applications.update_one(
        {"id": response.application_id},
        {"$set": {
            "recruiter_action": response.action,
            "is_matched": is_matched,
            "pipeline_stage": stage_update,
        }}
    )
    
    # If matched, create a match record and send notifications
    if is_matched:
        job = await db.jobs.find_one({"id": application["job_id"]}, {"_id": 0})
        match_doc = {
            "id": str(uuid.uuid4()),
            "application_id": response.application_id,
            "job_id": application["job_id"],
            "job_title": job["title"] if job else "Unknown",
            "company": job["company"] if job else "Unknown",
            "seeker_id": application["seeker_id"],
            "seeker_name": application["seeker_name"],
            "seeker_avatar": application.get("seeker_avatar"),
            "recruiter_id": current_user["id"],
            "recruiter_name": current_user["name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.matches.insert_one(match_doc)
        
        # Create in-app notification for seeker
        await create_notification(
            user_id=application["seeker_id"],
            notif_type="match",
            title="It's a Match!",
            message=f"{job['company'] if job else 'A company'} accepted your application for {job['title'] if job else 'a position'}!",
            data={"match_id": match_doc["id"], "job_id": application["job_id"]}
        )
        
        # Send WebSocket notification to seeker
        await manager.send_to_user(application["seeker_id"], {
            "type": "new_match",
            "match": {k: v for k, v in match_doc.items() if k != "_id"}
        })
        
        # Send email notification to seeker
        seeker = await db.users.find_one({"id": application["seeker_id"]}, {"_id": 0, "email": 1})
        if seeker and seeker.get("email"):
            asyncio.create_task(send_email_notification(
                seeker["email"],
                f"You matched with {job['company'] if job else 'a company'} on Hireabble!",
                get_match_email_html(
                    job["title"] if job else "Unknown",
                    job["company"] if job else "Unknown",
                    current_user["name"],
                    is_seeker=True
                )
            ))
    
    # Invalidate caches for both parties
    invalidate_user(current_user["id"])
    invalidate_user(application["seeker_id"])

    return {"message": f"Application {response.action}ed", "is_matched": is_matched}


# ==================== PIPELINE STAGES ====================

PIPELINE_STAGES = ["applied", "reviewing", "shortlisted", "interviewing", "offered", "hired", "declined"]

class PipelineStageUpdate(BaseModel):
    stage: str

@router.put("/applications/{application_id}/stage")
async def update_pipeline_stage(
    application_id: str,
    data: PipelineStageUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Recruiter updates an application's pipeline stage"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can update pipeline stages")
    if data.stage not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {', '.join(PIPELINE_STAGES)}")

    application = await db.applications.find_one(
        {"id": application_id, "recruiter_id": current_user["id"]},
        {"_id": 0}
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    await db.applications.update_one(
        {"id": application_id},
        {"$set": {"pipeline_stage": data.stage}}
    )

    # Notify seeker of stage change
    job_title = application.get("job_title", "a position")
    stage_label = data.stage.replace("_", " ").title()
    await create_notification(
        user_id=application["seeker_id"],
        notif_type="status_update",
        title="Application Update",
        message=f"Your application for {job_title} has moved to: {stage_label}",
        data={"application_id": application_id, "stage": data.stage}
    )

    # Send email if user has status_updates enabled
    from database import send_email_notification, get_email_template, get_unsubscribe_url, get_user_email_prefs, FRONTEND_URL
    async def _send_stage_email():
        prefs = await get_user_email_prefs(application["seeker_id"])
        if not prefs.get("status_updates", True):
            return
        seeker = await db.users.find_one({"id": application["seeker_id"]}, {"_id": 0, "email": 1})
        if not seeker or not seeker.get("email"):
            return
        html = get_email_template(
            title="Application Status Update",
            body_html=f"<p>Your application for <strong>{job_title}</strong> has moved to: <strong>{stage_label}</strong></p>",
            cta_text="View Applications",
            cta_url=f"{FRONTEND_URL}/applied",
            unsubscribe_url=get_unsubscribe_url(application["seeker_id"], "status_updates"),
        )
        await send_email_notification(seeker["email"], f"Application update: {stage_label}", html)
    asyncio.create_task(_send_stage_email())

    invalidate_user(application["seeker_id"])
    return {"message": "Stage updated", "stage": data.stage}


# ==================== REFERENCES ====================

@router.post("/references/request/{seeker_id}")
async def request_references(seeker_id: str, current_user: dict = Depends(get_current_user)):
    """Recruiter requests references from a seeker"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can request references")

    seeker = await db.users.find_one({"id": seeker_id}, {"_id": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Seeker not found")

    # Create a reference request
    request_doc = {
        "id": str(uuid.uuid4()),
        "recruiter_id": current_user["id"],
        "recruiter_name": current_user["name"],
        "recruiter_company": current_user.get("company", ""),
        "seeker_id": seeker_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reference_requests.insert_one(request_doc)

    await create_notification(
        user_id=seeker_id,
        notif_type="reference_request",
        title="References Requested",
        message=f"{current_user['name']} from {current_user.get('company', 'a company')} is requesting your references.",
        data={"request_id": request_doc["id"], "recruiter_id": current_user["id"]}
    )

    # Also send a chat message in the match conversation
    match = await db.matches.find_one({
        "seeker_id": seeker_id,
        "recruiter_id": current_user["id"]
    }, {"_id": 0})
    if match:
        company = current_user.get('company', 'our company')
        await send_system_message(
            match_id=match["id"],
            sender_id=current_user["id"],
            sender_name=current_user["name"],
            content=f"📋 Reference Request\n\n{current_user['name']} from {company} is requesting your professional references.",
            msg_type="reference_request",
            data={"request_id": request_doc["id"], "recruiter_id": current_user["id"], "recruiter_name": current_user["name"], "company": company}
        )

    return {"message": "Reference request sent", "request_id": request_doc["id"]}


@router.post("/references/respond/{request_id}")
async def respond_to_reference_request(
    request_id: str,
    action: dict,
    current_user: dict = Depends(get_current_user)
):
    """Seeker approves or denies a reference request"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can respond to reference requests")

    ref_request = await db.reference_requests.find_one({"id": request_id, "seeker_id": current_user["id"]})
    if not ref_request:
        raise HTTPException(status_code=404, detail="Reference request not found")

    status = "approved" if action.get("approve") else "denied"
    await db.reference_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status}}
    )

    await create_notification(
        user_id=ref_request["recruiter_id"],
        notif_type="reference_response",
        title=f"References {status.capitalize()}",
        message=f"{current_user['name']} has {status} your reference request.",
        data={"request_id": request_id, "seeker_id": current_user["id"], "status": status}
    )

    return {"message": f"Reference request {status}"}


@router.get("/references/requests")
async def get_reference_requests(current_user: dict = Depends(get_current_user)):
    """Get reference requests for the current user"""
    if current_user["role"] == "seeker":
        query = {"seeker_id": current_user["id"]}
    else:
        query = {"recruiter_id": current_user["id"]}

    requests = await db.reference_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return requests


# ==================== RESUME VIEW FOR RECRUITERS ====================

@router.get("/applicant/{seeker_id}/resume")
async def get_applicant_resume(seeker_id: str, current_user: dict = Depends(get_current_user)):
    """Get full resume data for a seeker (recruiter only, must have an application)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view resumes")

    # Verify there's an application from this seeker to this recruiter
    app = await db.applications.find_one({
        "seeker_id": seeker_id,
        "recruiter_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    })
    if not app:
        raise HTTPException(status_code=403, detail="No application from this seeker")

    seeker = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Seeker not found")

    # Track profile view (fire-and-forget)
    asyncio.create_task(_record_profile_view(current_user["id"], seeker_id))

    # Check if references are shared
    ref_request = await db.reference_requests.find_one({
        "seeker_id": seeker_id,
        "recruiter_id": current_user["id"],
        "status": "approved"
    })

    # Only include references if approved or not hidden
    references = seeker.get("references", [])
    if seeker.get("references_hidden", True) and not ref_request:
        references = []

    return {
        "name": seeker.get("name"),
        "title": seeker.get("title"),
        "email": seeker.get("email"),
        "location": seeker.get("location"),
        "bio": seeker.get("bio"),
        "skills": seeker.get("skills", []),
        "experience_years": seeker.get("experience_years"),
        "current_employer": seeker.get("current_employer"),
        "work_history": seeker.get("work_history", []),
        "education": seeker.get("education", []),
        "school": seeker.get("school"),
        "degree": seeker.get("degree"),
        "certifications": seeker.get("certifications", []),
        "photo_url": seeker.get("photo_url"),
        "video_url": seeker.get("video_url"),
        "references": references,
        "references_available": bool(seeker.get("references")) and seeker.get("references_hidden", True) and not ref_request,
        "references_approved": bool(ref_request),
    }


# ==================== PROFILE VIEW TRACKING ====================

async def _record_profile_view(viewer_id: str, seeker_id: str):
    """Record a profile view (deduped: one entry per viewer per seeker per day)."""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.profile_views.update_one(
            {"viewer_id": viewer_id, "seeker_id": seeker_id, "date": today},
            {"$set": {
                "viewer_id": viewer_id,
                "seeker_id": seeker_id,
                "date": today,
                "viewed_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    except Exception as e:
        logging.getLogger(__name__).error(f"Profile view tracking error: {e}")


@router.get("/profile/viewers")
async def get_profile_viewers(current_user: dict = Depends(get_current_user)):
    """Get list of recruiters who viewed the seeker's profile (Plus/Premium only)."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can view this")

    # Check subscription
    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc).isoformat()
    has_access = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")
    )

    # Always return the count (tease for free users), but only return details for subscribers
    views = await db.profile_views.find(
        {"seeker_id": current_user["id"]},
        {"_id": 0}
    ).sort("viewed_at", -1).to_list(50)

    total_views = len(views)

    if not has_access:
        return {"total_views": total_views, "viewers": [], "locked": True}

    # Fetch viewer details
    viewer_ids = list(set(v["viewer_id"] for v in views))
    viewers_data = {}
    if viewer_ids:
        recruiters = await db.users.find(
            {"id": {"$in": viewer_ids}},
            {"_id": 0, "id": 1, "name": 1, "company": 1, "photo_url": 1, "avatar": 1}
        ).to_list(len(viewer_ids))
        viewers_data = {r["id"]: r for r in recruiters}

    result = []
    seen_viewers = set()
    for v in views:
        vid = v["viewer_id"]
        if vid in seen_viewers:
            continue
        seen_viewers.add(vid)
        recruiter = viewers_data.get(vid, {})
        result.append({
            "viewer_id": vid,
            "name": recruiter.get("name", "Recruiter"),
            "company": recruiter.get("company", ""),
            "photo_url": recruiter.get("photo_url") or recruiter.get("avatar"),
            "viewed_at": v.get("viewed_at", ""),
        })

    return {"total_views": total_views, "viewers": result, "locked": False}


# ==================== APPLICATION READ RECEIPTS ====================

@router.post("/applications/{application_id}/read")
async def mark_application_read(application_id: str, current_user: dict = Depends(get_current_user)):
    """Mark an application as read by the recruiter. Fires when recruiter views the applicant card."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can mark applications as read")

    now = datetime.now(timezone.utc).isoformat()
    result = await db.applications.update_one(
        {"id": application_id, "recruiter_id": current_user["id"], "read_at": {"$exists": False}},
        {"$set": {"read_at": now, "read_by": current_user["id"]}}
    )

    return {"marked": result.modified_count > 0}


# ==================== APPLICATION INSIGHTS (Premium) ====================

@router.get("/applications/{application_id}/insights")
async def get_application_insights(application_id: str, current_user: dict = Depends(get_current_user)):
    """Get insights about how the seeker ranks against other applicants for a job.
    Premium seekers only."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can view application insights")

    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc).isoformat()
    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now
            and sub.get("tier_id") == "seeker_premium"):
        raise HTTPException(status_code=403, detail="Premium subscription required for application insights")

    app = await db.applications.find_one({"id": application_id, "seeker_id": current_user["id"]})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job_id = app["job_id"]

    # Count total applicants and where this seeker stands
    all_apps = await db.applications.find(
        {"job_id": job_id, "action": {"$in": ["like", "superlike"]}},
        {"_id": 0, "seeker_id": 1, "action": 1, "created_at": 1}
    ).to_list(500)

    total_applicants = len(all_apps)
    superlike_count = sum(1 for a in all_apps if a.get("action") == "superlike")

    # Determine rough rank based on match score
    # Fetch the job to calculate this seeker's match score
    from routers.jobs import calculate_job_match_score
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    my_score = calculate_job_match_score(current_user, job) if job else 50

    # Get experience distribution of applicants
    applicant_ids = [a["seeker_id"] for a in all_apps if a["seeker_id"] != current_user["id"]]
    experience_data = []
    if applicant_ids:
        applicants = await db.users.find(
            {"id": {"$in": applicant_ids}},
            {"_id": 0, "experience_years": 1}
        ).to_list(len(applicant_ids))
        experience_data = [a.get("experience_years", 0) for a in applicants if a.get("experience_years")]

    my_exp = current_user.get("experience_years", 0)
    more_experienced = sum(1 for e in experience_data if e > my_exp)
    percentile = max(1, round((1 - more_experienced / max(total_applicants, 1)) * 100))

    # Applied timing rank (earlier = better)
    my_created = app.get("created_at", "")
    earlier_apps = sum(1 for a in all_apps if a.get("created_at", "") < my_created)
    applied_rank = earlier_apps + 1

    return {
        "total_applicants": total_applicants,
        "superlike_count": superlike_count,
        "my_action": app.get("action", "like"),
        "match_score": my_score,
        "experience_percentile": percentile,
        "applied_rank": applied_rank,
        "applied_early": applied_rank <= max(1, total_applicants // 4),
    }


# ==================== INCOGNITO MODE (Premium) ====================

@router.post("/profile/incognito")
async def toggle_incognito(body: dict, current_user: dict = Depends(get_current_user)):
    """Toggle incognito mode — hide profile from recruiter discovery.
    Premium seekers only."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can use incognito mode")

    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc).isoformat()
    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now
            and sub.get("tier_id") == "seeker_premium"):
        raise HTTPException(status_code=403, detail="Premium subscription required for incognito mode")

    enabled = bool(body.get("enabled", False))
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"incognito_mode": enabled}}
    )

    return {"incognito_mode": enabled}


# ==================== WEEKLY PROFILE BOOST (Plus+) ====================

@router.post("/profile/boost")
async def activate_profile_boost(current_user: dict = Depends(get_current_user)):
    """Activate a weekly profile boost for Plus+ seekers.
    Boosts the seeker's profile in recruiter discovery for 30 minutes."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can boost their profile")

    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now_iso
            and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")):
        raise HTTPException(status_code=403, detail="Plus or Premium subscription required")

    # Check weekly boost limit
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    boosts_this_week = await db.profile_boosts.count_documents({
        "seeker_id": current_user["id"],
        "activated_at": {"$gte": week_start},
    })

    if boosts_this_week >= 1:
        raise HTTPException(status_code=400, detail="Weekly boost already used. Resets every Monday.")

    # Check if already actively boosted
    existing_boost = current_user.get("profile_boost_until", "")
    if existing_boost and existing_boost >= now_iso:
        raise HTTPException(status_code=400, detail="Profile is already boosted")

    boost_until = (now + timedelta(minutes=30)).isoformat()
    await asyncio.gather(
        db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"profile_boost_until": boost_until}}
        ),
        db.profile_boosts.insert_one({
            "id": str(uuid.uuid4()),
            "seeker_id": current_user["id"],
            "activated_at": now_iso,
            "boost_until": boost_until,
        }),
    )

    return {"message": "Profile boosted for 30 minutes!", "boost_until": boost_until}


# ==================== TOP PICKS (Premium) ====================

@router.get("/top-picks")
async def get_top_picks(current_user: dict = Depends(get_current_user)):
    """Get 3 curated daily top picks for premium seekers.
    Returns highest-matching unswiped jobs for today."""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only seekers can view top picks")

    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc).isoformat()
    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now
            and sub.get("tier_id") == "seeker_premium"):
        raise HTTPException(status_code=403, detail="Premium subscription required for Top Picks")

    uid = current_user["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check if picks already generated today (cached)
    cached_picks = await db.top_picks.find_one({"seeker_id": uid, "date": today})
    if cached_picks:
        job_ids = cached_picks.get("job_ids", [])
        jobs = await db.jobs.find({"id": {"$in": job_ids}, "is_active": True}, {"_id": 0}).to_list(3)
        # Add match scores
        from routers.jobs import calculate_job_match_score
        for job in jobs:
            job["match_score"] = calculate_job_match_score(current_user, job)
        return {"picks": jobs, "date": today}

    # Generate new picks: get top 3 matching unswiped jobs
    swiped = await db.applications.find({"seeker_id": uid}, {"job_id": 1}).to_list(1000)
    swiped_ids = [s["job_id"] for s in swiped]

    job_query = {"id": {"$nin": swiped_ids}, "is_active": True}
    candidates = await db.jobs.find(job_query, {"_id": 0}).to_list(100)

    from routers.jobs import calculate_job_match_score
    for job in candidates:
        job["match_score"] = calculate_job_match_score(current_user, job)

    candidates.sort(key=lambda j: j["match_score"], reverse=True)
    top_3 = candidates[:3]

    # Cache the picks for today
    if top_3:
        await db.top_picks.update_one(
            {"seeker_id": uid, "date": today},
            {"$set": {"seeker_id": uid, "date": today, "job_ids": [j["id"] for j in top_3]}},
            upsert=True,
        )

    return {"picks": top_3, "date": today}


# ==================== CANDIDATE NOTES ====================


class CandidateNoteBody(BaseModel):
    note: str


@router.put("/candidates/{seeker_id}/note")
async def save_candidate_note(
    seeker_id: str,
    body: CandidateNoteBody,
    current_user: dict = Depends(get_current_user),
):
    """Save or update a recruiter's private note on a candidate."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can add notes")

    note_text = body.note.strip()[:2000]  # max 2000 chars

    await db.candidate_notes.update_one(
        {"recruiter_id": current_user["id"], "seeker_id": seeker_id},
        {"$set": {
            "recruiter_id": current_user["id"],
            "seeker_id": seeker_id,
            "note": note_text,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"success": True}


@router.get("/candidates/{seeker_id}/note")
async def get_candidate_note(
    seeker_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a recruiter's private note on a candidate."""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view notes")

    doc = await db.candidate_notes.find_one(
        {"recruiter_id": current_user["id"], "seeker_id": seeker_id},
        {"_id": 0, "note": 1, "updated_at": 1},
    )
    return {"note": doc["note"] if doc else "", "updated_at": doc.get("updated_at") if doc else None}
