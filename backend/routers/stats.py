"""
Stats and utility routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
import io
import re
import asyncio

# PDF Generation
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from database import (
    db, get_current_user
)
from cache import (
    stats_cache, completeness_cache, superlikes_cache,
    cache_key, get_cached, set_cached
)

router = APIRouter(tags=["Stats & Utilities"])

# ==================== BATCHED DASHBOARD (single request instead of 6-8) ====================

DAILY_SUPERLIKE_LIMIT = 3

def _get_seeker_daily_superlike_limit(user: dict) -> int:
    """Return the daily super like limit based on seeker subscription tier."""
    sub = user.get("subscription", {})
    now = datetime.now(timezone.utc).isoformat()
    if sub.get("status") == "active" and sub.get("period_end", "") >= now:
        tier = sub.get("tier_id", "")
        if tier == "seeker_premium":
            return 999
        elif tier == "seeker_plus":
            return 10
    return DAILY_SUPERLIKE_LIMIT

@router.get("/dashboard")
async def get_seeker_dashboard(current_user: dict = Depends(get_current_user)):
    """Batched endpoint: returns everything the seeker dashboard needs in one request.
    Replaces 6+ separate API calls with a single round trip."""

    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Seeker only")

    uid = current_user["id"]
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # --- 5 parallel queries instead of 8: derive counts from the applications list ---
    (
        swiped_apps,
        matches_count,
        user_data,
        unread_messages,
        unread_notifications,
        profile_views_count,
    ) = await asyncio.gather(
        db.applications.find(
            {"seeker_id": uid}, {"job_id": 1, "action": 1, "created_at": 1}
        ).to_list(1000),
        db.matches.count_documents({"seeker_id": uid}),
        db.users.find_one({"id": uid}, {"_id": 0, "seeker_purchased_superlikes": 1, "subscription": 1}),
        db.messages.count_documents({"receiver_id": uid, "is_read": False}),
        db.notifications.count_documents({"user_id": uid, "is_read": False}),
        db.profile_views.count_documents({"seeker_id": uid}),
    )

    # Derive all application counts locally (saves 3 DB round trips)
    swiped_job_ids = [s["job_id"] for s in swiped_apps]
    applications_count = sum(1 for s in swiped_apps if s.get("action") in ("like", "superlike"))
    superlikes_count = sum(1 for s in swiped_apps if s.get("action") == "superlike")
    superlikes_today = sum(
        1 for s in swiped_apps
        if s.get("action") == "superlike" and s.get("created_at", "") >= today_start
    )

    # Fetch available jobs (excluding already-swiped)
    job_query = {"id": {"$nin": swiped_job_ids}, "is_active": True}
    seeker_location = current_user.get("location", "")
    if seeker_location:
        job_query["$or"] = [
            {"location_restriction": None},
            {"location_restriction": "any"},
            {"location_restriction": {"$exists": False}},
            {"location": {"$regex": re.escape(seeker_location.split(",")[0].strip()), "$options": "i"}},
        ]

    jobs = await db.jobs.find(job_query, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Batch-fetch recruiter subscriptions
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

    # Score and sort jobs
    from routers.jobs import calculate_job_match_score
    for job in jobs:
        job["match_score"] = calculate_job_match_score(current_user, job)
        job["is_boosted"] = bool(job.get("is_boosted") and job.get("boost_until", "") >= now)
        rec_tier = recruiter_subs.get(job.get("recruiter_id"), "")
        if rec_tier or job.get("is_featured"):
            job["is_premium_listing"] = True
            job["match_score"] = min(100, job["match_score"] + 15)

    boosted = [j for j in jobs if j.get("is_boosted")]
    regular = [j for j in jobs if not j.get("is_boosted")]
    regular.sort(key=lambda j: (1 if j.get("is_premium_listing") else 0, j["match_score"]), reverse=True)
    result_jobs = list(regular)
    boost_positions = [0, 3, 7, 12, 18]
    for i, bj in enumerate(boosted):
        pos = boost_positions[i] if i < len(boost_positions) else len(result_jobs)
        pos = min(pos, len(result_jobs))
        result_jobs.insert(pos, bj)

    # Profile completeness (computed from current_user, no extra DB call)
    fields_to_check = {
        "name": 10, "title": 15, "bio": 10, "skills": 15,
        "experience_years": 10, "location": 10, "photo_url": 15,
        "school": 5, "degree": 5, "current_employer": 5
    }
    completeness_total = 0
    missing = []
    field_labels = {
        "name": "name", "title": "job title", "bio": "bio", "skills": "skills",
        "experience_years": "experience", "location": "location", "photo_url": "photo",
        "school": "education", "degree": "degree", "current_employer": "employer"
    }
    for field, weight in fields_to_check.items():
        value = current_user.get(field)
        if value and (not isinstance(value, list) or len(value) > 0):
            completeness_total += weight
        else:
            missing.append(field_labels.get(field, field))

    # Superlikes remaining (respects subscription tier limits)
    purchased = (user_data or {}).get("seeker_purchased_superlikes", 0)
    daily_limit = _get_seeker_daily_superlike_limit(user_data or {})
    free_remaining = max(0, daily_limit - superlikes_today)

    # Check if user can undo: paid tiers get unlimited, free tier gets 1/day
    sub = (user_data or {}).get("subscription") or current_user.get("subscription") or {}
    is_paid_undo = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")
    )
    if is_paid_undo:
        can_undo = True
    else:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        undos_today = await db.undo_log.count_documents({
            "user_id": current_user["id"],
            "created_at": {"$gte": today_start},
        })
        can_undo = undos_today < 1

    # Check subscription for premium features
    is_plus_or_premium = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id", "") in ("seeker_plus", "seeker_premium")
    )
    is_premium = (
        sub.get("status") == "active"
        and sub.get("period_end", "") >= now
        and sub.get("tier_id") == "seeker_premium"
    )

    # Premium feature flags
    premium_features = {
        "can_see_viewers": is_plus_or_premium,
        "advanced_filters": is_plus_or_premium,
        "superlike_notes": is_premium,
        "application_insights": is_premium,
        "incognito_mode": True,  # Free for all seekers
        "top_picks": is_premium,
    }

    # Batch top picks into dashboard response (saves a separate API round-trip)
    top_picks = []
    if is_premium:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cached_picks = await db.top_picks.find_one({"seeker_id": uid, "date": today})
        if cached_picks:
            pick_ids = cached_picks.get("job_ids", [])
            pick_jobs = await db.jobs.find({"id": {"$in": pick_ids}, "is_active": True}, {"_id": 0}).to_list(3)
            for pj in pick_jobs:
                pj["match_score"] = calculate_job_match_score(current_user, pj)
            top_picks = pick_jobs
        else:
            # Generate from already-scored result_jobs (top 3 by match score)
            sorted_by_score = sorted(result_jobs, key=lambda j: j.get("match_score", 0), reverse=True)
            top_picks = sorted_by_score[:3]
            if top_picks:
                await db.top_picks.update_one(
                    {"seeker_id": uid, "date": today},
                    {"$set": {"seeker_id": uid, "date": today, "job_ids": [j["id"] for j in top_picks]}},
                    upsert=True,
                )

    return {
        "jobs": result_jobs,
        "swiped_job_ids": swiped_job_ids,
        "can_undo": can_undo,
        "stats": {
            "applications_sent": applications_count,
            "super_likes_used": superlikes_count,
            "matches": matches_count,
            "profile_views": profile_views_count,
        },
        "premium_features": premium_features,
        "incognito_active": bool(current_user.get("incognito_mode")),
        "boost_active_until": current_user.get("profile_boost_until") if current_user.get("profile_boost_until", "") >= now else None,
        "completeness": {
            "percentage": completeness_total,
            "missing_fields": missing,
            "is_complete": completeness_total >= 80,
        },
        "superlikes": {
            "remaining": free_remaining + purchased,
            "free_remaining": free_remaining,
            "purchased_remaining": purchased,
            "used_today": superlikes_today,
            "daily_limit": daily_limit,
        },
        "unread_messages": unread_messages,
        "unread_notifications": unread_notifications,
        "top_picks": top_picks,
    }


@router.get("/recruiter/dashboard-data")
async def get_recruiter_dashboard_data(current_user: dict = Depends(get_current_user)):
    """Batched endpoint: returns everything the recruiter dashboard needs in one request."""

    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Recruiter only")

    uid = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # --- All count + list queries in parallel ---
    (
        active_jobs, total_jobs, total_applications, pending_applications,
        super_likes, matches_count, interviews_scheduled, interviews_pending,
        responded, weekly_apps, jobs_list,
        recruiter_jobs,
        raw_applications,
        user_sub_data,
        unread_messages, unread_notifications,
        pipeline_agg,
    ) = await asyncio.gather(
        db.jobs.count_documents({"recruiter_id": uid, "is_active": True}),
        db.jobs.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}}),
        db.applications.count_documents({"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}, "recruiter_action": None}),
        db.applications.count_documents({"recruiter_id": uid, "action": "superlike"}),
        db.matches.count_documents({"recruiter_id": uid}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "accepted"}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "pending"}),
        db.applications.count_documents({"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}, "recruiter_action": {"$ne": None}}),
        db.applications.count_documents({"recruiter_id": uid, "created_at": {"$gte": week_ago}}),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0, "id": 1, "title": 1}).to_list(50),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(100),
        db.applications.find(
            {"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}}, {"_id": 0}
        ).sort("created_at", -1).to_list(100),
        db.users.find_one({"id": uid}, {"_id": 0, "subscription": 1}),
        db.messages.count_documents({"receiver_id": uid, "is_read": False}),
        db.notifications.count_documents({"user_id": uid, "is_read": False}),
        db.applications.aggregate([
            {"$match": {"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}}},
            {"$group": {"_id": "$pipeline_stage", "count": {"$sum": 1}}}
        ]).to_list(20),
    )

    # Normalize legacy pipeline stages (reviewing→applied, offered→shortlisted)
    stage_map = {"reviewing": "applied", "offered": "shortlisted"}
    raw_counts = {}
    for doc in pipeline_agg:
        stage = doc["_id"]
        if not stage:
            stage = "applied"  # apps with no pipeline_stage are new applicants
        normalized = stage_map.get(stage, stage)
        raw_counts[normalized] = raw_counts.get(normalized, 0) + doc["count"]
    pipeline_counts = raw_counts

    # Per-job stats aggregation
    response_rate = round((responded / total_applications * 100) if total_applications > 0 else 0)
    match_rate = round((matches_count / total_applications * 100) if total_applications > 0 else 0)
    top_jobs = []
    if jobs_list:
        job_ids = [job["id"] for job in jobs_list]
        job_title_map = {job["id"]: job["title"] for job in jobs_list}
        app_counts, match_counts = await asyncio.gather(
            db.applications.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
            db.matches.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
        )
        app_map = {doc["_id"]: doc["count"] for doc in app_counts}
        match_map = {doc["_id"]: doc["count"] for doc in match_counts}
        top_jobs = [{
            "job_id": jid, "title": job_title_map[jid],
            "applications": app_map.get(jid, 0), "matches": match_map.get(jid, 0),
        } for jid in job_ids]
        top_jobs.sort(key=lambda j: j["applications"], reverse=True)

    # Mark premium seekers in applications
    seeker_ids = list(set(a.get("seeker_id") for a in raw_applications if a.get("seeker_id")))
    premium_seekers = set()
    if seeker_ids:
        seekers = await db.users.find(
            {"id": {"$in": seeker_ids}}, {"_id": 0, "id": 1, "subscription": 1}
        ).to_list(len(seeker_ids))
        for s in seekers:
            sub = s.get("subscription", {})
            if sub.get("status") == "active" and sub.get("period_end", "") >= now_iso:
                premium_seekers.add(s["id"])
    for app in raw_applications:
        if app.get("seeker_id") in premium_seekers:
            app["is_premium_seeker"] = True
    sl = [a for a in raw_applications if a.get("action") == "superlike"]
    pr = [a for a in raw_applications if a.get("action") != "superlike" and a.get("is_premium_seeker")]
    rg = [a for a in raw_applications if a.get("action") != "superlike" and not a.get("is_premium_seeker")]
    applications = sl + pr + rg

    # Normalize legacy pipeline stages on individual applications
    for app in applications:
        stage = app.get("pipeline_stage")
        if stage in stage_map:
            app["pipeline_stage"] = stage_map[stage]

    # Attach match_id so frontend can navigate directly to chat
    matched_apps = [a for a in applications if a.get("recruiter_action") == "accept"]
    if matched_apps:
        matched_seeker_ids = list(set(a.get("seeker_id") for a in matched_apps))
        matches = await db.matches.find(
            {"recruiter_id": uid, "seeker_id": {"$in": matched_seeker_ids}},
            {"_id": 0, "id": 1, "seeker_id": 1, "job_id": 1}
        ).to_list(500)
        match_lookup = {(m["seeker_id"], m.get("job_id")): m["id"] for m in matches}
        for app in matched_apps:
            key = (app.get("seeker_id"), app.get("job_id"))
            if key in match_lookup:
                app["match_id"] = match_lookup[key]

    # Subscription status
    sub = (user_sub_data or {}).get("subscription", {})
    from routers.payments import SUBSCRIPTION_TIERS
    tier_id = sub.get("tier_id")
    tier = SUBSCRIPTION_TIERS.get(tier_id)
    if tier and sub.get("status") == "active":
        period_end = sub.get("period_end", "")
        if period_end and period_end >= now_iso:
            subscription = {
                "subscribed": True, "tier": tier_id, "tier_name": tier["name"],
                "tier_level": tier["tier_level"], "limits": tier["limits"], "period_end": period_end,
            }
        else:
            subscription = {"subscribed": False, "tier": None, "tier_name": "Free", "limits": {}}
    else:
        subscription = {"subscribed": False, "tier": None, "tier_name": "Free", "limits": {}}

    return {
        "stats": {
            "active_jobs": active_jobs, "total_jobs": total_jobs,
            "total_applications": total_applications, "pending_applications": pending_applications,
            "super_likes": super_likes, "matches": matches_count,
            "interviews_scheduled": interviews_scheduled, "interviews_pending": interviews_pending,
            "response_rate": response_rate, "match_rate": match_rate,
            "weekly_applications": weekly_apps, "top_jobs": top_jobs[:10],
            "pipeline_counts": pipeline_counts,
        },
        "jobs": recruiter_jobs,
        "applications": applications,
        "subscription": subscription,
        "unread_messages": unread_messages,
        "unread_notifications": unread_notifications,
    }


# ==================== STATS ====================

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    uid = current_user["id"]
    key = cache_key("stats", uid)
    cached = get_cached(stats_cache, key)
    if cached:
        return cached

    if current_user["role"] == "seeker":
        applications, superlikes, matches = await asyncio.gather(
            db.applications.count_documents({"seeker_id": uid, "action": {"$in": ["like", "superlike"]}}),
            db.applications.count_documents({"seeker_id": uid, "action": "superlike"}),
            db.matches.count_documents({"seeker_id": uid}),
        )
        result = {
            "applications_sent": applications,
            "super_likes_used": superlikes,
            "matches": matches
        }
    else:
        jobs, applications, matches = await asyncio.gather(
            db.jobs.count_documents({"recruiter_id": uid}),
            db.applications.count_documents({"recruiter_id": uid}),
            db.matches.count_documents({"recruiter_id": uid}),
        )
        result = {
            "jobs_posted": jobs,
            "applications_received": applications,
            "matches": matches
        }

    set_cached(stats_cache, key, result)
    return result

@router.get("/stats/recruiter")
async def get_recruiter_stats(current_user: dict = Depends(get_current_user)):
    """Get detailed recruiter statistics"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")

    uid = current_user["id"]
    key = cache_key("rstats", uid)
    cached = get_cached(stats_cache, key)
    if cached:
        return cached

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # Run all count queries in parallel
    (
        active_jobs, total_jobs, total_applications, pending_applications,
        super_likes, matches, interviews_scheduled, interviews_pending,
        responded, weekly_apps, jobs_list,
    ) = await asyncio.gather(
        db.jobs.count_documents({"recruiter_id": uid, "is_active": True}),
        db.jobs.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}}),
        db.applications.count_documents({"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}, "recruiter_action": None}),
        db.applications.count_documents({"recruiter_id": uid, "action": "superlike"}),
        db.matches.count_documents({"recruiter_id": uid}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "accepted"}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "pending"}),
        db.applications.count_documents({"recruiter_id": uid, "action": {"$in": ["like", "superlike"]}, "recruiter_action": {"$ne": None}}),
        db.applications.count_documents({"recruiter_id": uid, "created_at": {"$gte": week_ago}}),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0, "id": 1, "title": 1}).to_list(50),
    )

    response_rate = round((responded / total_applications * 100) if total_applications > 0 else 0)
    match_rate = round((matches / total_applications * 100) if total_applications > 0 else 0)

    # Get per-job stats with aggregation pipelines (2 queries instead of N*2)
    if jobs_list:
        job_ids = [job["id"] for job in jobs_list]
        job_title_map = {job["id"]: job["title"] for job in jobs_list}

        app_counts, match_counts = await asyncio.gather(
            db.applications.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
            db.matches.aggregate([
                {"$match": {"job_id": {"$in": job_ids}}},
                {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}
            ]).to_list(100),
        )

        app_map = {doc["_id"]: doc["count"] for doc in app_counts}
        match_map = {doc["_id"]: doc["count"] for doc in match_counts}

        top_jobs = [{
            "job_id": jid,
            "title": job_title_map[jid],
            "applications": app_map.get(jid, 0),
            "matches": match_map.get(jid, 0),
        } for jid in job_ids]
        top_jobs.sort(key=lambda j: j["applications"], reverse=True)
    else:
        top_jobs = []

    result = {
        "active_jobs": active_jobs,
        "total_jobs": total_jobs,
        "total_applications": total_applications,
        "pending_applications": pending_applications,
        "super_likes": super_likes,
        "matches": matches,
        "interviews_scheduled": interviews_scheduled,
        "interviews_pending": interviews_pending,
        "response_rate": response_rate,
        "match_rate": match_rate,
        "weekly_applications": weekly_apps,
        "top_jobs": top_jobs[:10],
    }
    set_cached(stats_cache, key, result)
    return result


@router.get("/analytics/insights")
async def get_user_insights(current_user: dict = Depends(get_current_user)):
    """Get detailed analytics insights for the current user."""
    user_id = current_user["id"]
    role = current_user.get("role", "seeker")
    now = datetime.now(timezone.utc)

    if role == "seeker":
        # Application stats
        total_apps = await db.applications.count_documents({"seeker_id": user_id})
        liked_apps = await db.applications.count_documents({"seeker_id": user_id, "action": "like"})
        superliked_apps = await db.applications.count_documents({"seeker_id": user_id, "action": "superlike"})
        total_matches = await db.matches.count_documents({"seeker_id": user_id})

        # Match rate
        match_rate = round((total_matches / max(liked_apps + superliked_apps, 1)) * 100, 1)

        # Applications by week (last 4 weeks)
        four_weeks_ago = (now - timedelta(weeks=4)).isoformat()
        recent_apps = await db.applications.find(
            {"seeker_id": user_id, "created_at": {"$gte": four_weeks_ago}},
            {"_id": 0, "created_at": 1, "action": 1}
        ).to_list(500)

        weekly_apps = {}
        for app in recent_apps:
            week = app["created_at"][:10]  # YYYY-MM-DD
            weekly_apps[week] = weekly_apps.get(week, 0) + 1

        # Profile views (last 30 days)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        profile_views = await db.profile_views.count_documents({
            "viewed_id": user_id,
            "created_at": {"$gte": thirty_days_ago}
        })

        # Response rate (how many of user's apps got recruiter action)
        responded_apps = await db.applications.count_documents({
            "seeker_id": user_id,
            "recruiter_action": {"$in": ["accept", "reject"]}
        })
        response_rate = round((responded_apps / max(total_apps, 1)) * 100, 1)

        # Top categories applied to
        pipeline = [
            {"$match": {"seeker_id": user_id}},
            {"$lookup": {"from": "jobs", "localField": "job_id", "foreignField": "id", "as": "job"}},
            {"$unwind": {"path": "$job", "preserveNullAndEmptyCount": True}},
            {"$group": {"_id": "$job.category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        category_stats = []
        async for doc in db.applications.aggregate(pipeline):
            if doc["_id"]:
                category_stats.append({"category": doc["_id"], "count": doc["count"]})

        return {
            "total_applications": total_apps,
            "total_matches": total_matches,
            "match_rate": match_rate,
            "response_rate": response_rate,
            "profile_views_30d": profile_views,
            "superlike_count": superliked_apps,
            "activity_by_day": dict(sorted(weekly_apps.items())),
            "top_categories": category_stats,
        }

    else:  # recruiter
        total_jobs = await db.jobs.count_documents({"recruiter_id": user_id})
        active_jobs = await db.jobs.count_documents({"recruiter_id": user_id, "is_active": True})
        total_apps_received = await db.applications.count_documents({"recruiter_id": user_id})
        total_matches = await db.matches.count_documents({"recruiter_id": user_id})

        # Apps per job
        apps_per_job = round(total_apps_received / max(total_jobs, 1), 1)

        # Match rate
        total_swipes = await db.recruiter_swipes.count_documents({"recruiter_id": user_id, "action": "like"})
        match_rate = round((total_matches / max(total_swipes, 1)) * 100, 1)

        # Activity by day (last 4 weeks)
        four_weeks_ago = (now - timedelta(weeks=4)).isoformat()
        recent_apps = await db.applications.find(
            {"recruiter_id": user_id, "created_at": {"$gte": four_weeks_ago}},
            {"_id": 0, "created_at": 1}
        ).to_list(500)

        daily_apps = {}
        for app in recent_apps:
            day = app["created_at"][:10]
            daily_apps[day] = daily_apps.get(day, 0) + 1

        return {
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "total_applications_received": total_apps_received,
            "total_matches": total_matches,
            "apps_per_job": apps_per_job,
            "match_rate": match_rate,
            "activity_by_day": dict(sorted(daily_apps.items())),
        }


@router.get("/profile/completeness")
async def get_profile_completeness(current_user: dict = Depends(get_current_user)):
    """Get profile completeness percentage"""
    if current_user["role"] != "seeker":
        return {"percentage": 100, "missing_fields": [], "is_complete": True}

    key = cache_key("completeness", current_user["id"])
    cached = get_cached(completeness_cache, key)
    if cached:
        return cached

    fields_to_check = {
        "photo_url": 12,
        "name": 8,
        "title": 12,
        "bio": 10,
        "skills": 12,
        "experience_years": 8,
        "location": 8,
        "school": 5,
        "degree": 5,
        "current_employer": 5,
        "work_history": 5,
        "interests": 5,
        "certifications": 5,
    }

    # Friendly display names for missing fields
    field_labels = {
        "photo_url": "Profile photo",
        "name": "Full name",
        "title": "Job title",
        "bio": "Professional summary",
        "skills": "Skills",
        "experience_years": "Years of experience",
        "location": "Location",
        "school": "School",
        "degree": "Degree",
        "current_employer": "Current employer",
        "work_history": "Work history",
        "interests": "Interests",
        "certifications": "Certifications",
    }

    total = 0
    missing = []

    for field, weight in fields_to_check.items():
        value = current_user.get(field)
        if value and (not isinstance(value, list) or len(value) > 0):
            total += weight
        else:
            missing.append(field_labels.get(field, field))

    # Cap at 100
    total = min(total, 100)

    result = {
        "percentage": total,
        "missing_fields": missing,
        "is_complete": total >= 80
    }
    set_cached(completeness_cache, key, result)
    return result

# ==================== RESUME PDF ====================

@router.get("/users/resume/download")
async def download_resume(
    current_user: dict = Depends(get_current_user),
    theme: str = "classic",
    include_photo: bool = True,
):
    """Download user profile as a professionally formatted PDF resume.

    Query params:
      - theme: 'classic', 'modern', or 'minimal' (default: classic)
      - include_photo: whether to include profile photo (default: true)
    """
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can download resumes")

    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    if not user:
        user = current_user

    # Use the user's saved preference if include_photo wasn't explicitly set to false
    if include_photo and user.get('include_photo_on_resume') is False:
        include_photo = False
    from routers.resume_themes import generate_resume_pdf
    buffer = await asyncio.to_thread(generate_resume_pdf, user, theme=theme, include_photo=include_photo, for_recruiter=False)

    safe_name = re.sub(r'[^\w\s-]', '', user.get('name', 'resume')).strip().replace(' ', '_') or 'resume'
    filename = f"{safe_name}_Resume.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/applicant/{seeker_id}/resume/pdf")
async def download_applicant_resume_pdf(seeker_id: str, current_user: dict = Depends(get_current_user)):
    """Download a seeker's resume as PDF (recruiter only, must have an application)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can download applicant resumes")

    app = await db.applications.find_one({
        "seeker_id": seeker_id,
        "recruiter_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    })
    if not app:
        match = await db.matches.find_one({
            "seeker_id": seeker_id,
            "recruiter_id": current_user["id"]
        })
        if not match:
            raise HTTPException(status_code=403, detail="No application from this seeker")

    user = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Seeker not found")

    try:
        from routers.resume_themes import generate_resume_pdf
        seeker_theme = user.get('resume_theme', 'classic')
        if seeker_theme not in ('classic', 'modern', 'minimal'):
            seeker_theme = 'classic'
        show_photo = user.get('include_photo_on_resume', True) is not False
        buffer = await asyncio.to_thread(generate_resume_pdf, user, theme=seeker_theme, include_photo=show_photo, for_recruiter=True)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Resume PDF generation failed for {seeker_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate resume PDF")

    safe_name2 = re.sub(r'[^\w\s-]', '', user.get('name', 'resume')).strip().replace(' ', '_') or 'resume'
    filename = f"{safe_name2}_Resume.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ==================== PUSH NOTIFICATIONS ====================

@router.post("/push/subscribe")
async def subscribe_push(subscription: dict, current_user: dict = Depends(get_current_user)):
    """Subscribe to push notifications"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"push_subscription": subscription}}
    )
    return {"message": "Push subscription saved"}

@router.delete("/push/unsubscribe")
async def unsubscribe_push(current_user: dict = Depends(get_current_user)):
    """Unsubscribe from push notifications"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"push_subscription": None}}
    )
    return {"message": "Push subscription removed"}
