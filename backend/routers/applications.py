"""
Applications/Swipe routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone, timedelta
import uuid
import asyncio

from database import (
    db, get_current_user, manager, send_email_notification, create_notification,
    send_system_message,
    SwipeAction, ApplicationResponse, RecruiterAction, MatchResponse
)

router = APIRouter(tags=["Applications"])

DAILY_SUPERLIKE_LIMIT = 3

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
            <a href="#" style="display: inline-block; background: #6366f1; color: white; padding: 14px 40px; border-radius: 25px; text-decoration: none; font-weight: bold;">{cta_text}</a>
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

    # Get purchased super likes balance
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "seeker_purchased_superlikes": 1})
    purchased = (user or {}).get("seeker_purchased_superlikes", 0)

    free_remaining = max(0, DAILY_SUPERLIKE_LIMIT - superlikes_today)

    return {
        "remaining": free_remaining + purchased,
        "free_remaining": free_remaining,
        "purchased_remaining": purchased,
        "used_today": superlikes_today,
        "daily_limit": DAILY_SUPERLIKE_LIMIT
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

    # Sort by match score descending
    seekers.sort(key=lambda s: s.get("match_score", 0), reverse=True)

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

    user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_purchased_superswipes": 1, "subscription": 1})
    purchased = (user_data or {}).get("recruiter_purchased_superswipes", 0)

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


@router.post("/candidates/swipe")
async def recruiter_swipe_candidate(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Recruiter swipes on a candidate (like, pass, superlike)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can swipe on candidates")

    seeker_id = body.get("seeker_id")
    action = body.get("action", "like")  # like, pass, superlike
    job_id = body.get("job_id")  # optional: which job to associate

    if not seeker_id:
        raise HTTPException(status_code=400, detail="seeker_id is required")
    if action not in ("like", "pass", "superlike"):
        raise HTTPException(status_code=400, detail="Action must be like, pass, or superlike")

    # Check for duplicate swipe
    existing = await db.recruiter_swipes.find_one({
        "recruiter_id": current_user["id"],
        "seeker_id": seeker_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already swiped on this candidate")

    # Check super swipe limits
    if action == "superlike":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        swipes_today = await db.recruiter_swipes.count_documents({
            "recruiter_id": current_user["id"],
            "action": "superlike",
            "created_at": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}
        })
        user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_purchased_superswipes": 1, "subscription": 1})
        purchased = (user_data or {}).get("recruiter_purchased_superswipes", 0)

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
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$inc": {"recruiter_purchased_superswipes": -1}}
            )

    seeker = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
    if not seeker:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Record the swipe
    swipe_doc = {
        "id": str(uuid.uuid4()),
        "recruiter_id": current_user["id"],
        "seeker_id": seeker_id,
        "action": action,
        "job_id": job_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recruiter_swipes.insert_one(swipe_doc)

    # If recruiter liked/super-liked, create a match if seeker also applied to their jobs
    is_matched = False
    if action in ("like", "superlike"):
        # Check if seeker applied to any of this recruiter's jobs
        seeker_app = await db.applications.find_one({
            "seeker_id": seeker_id,
            "recruiter_id": current_user["id"],
            "action": {"$in": ["like", "superlike"]},
            "is_matched": False,
        })
        if seeker_app:
            # Auto-match: both parties expressed interest
            is_matched = True
            job = await db.jobs.find_one({"id": seeker_app["job_id"]}, {"_id": 0})
            await db.applications.update_one(
                {"id": seeker_app["id"]},
                {"$set": {"recruiter_action": "accept", "is_matched": True}}
            )
            match_doc = {
                "id": str(uuid.uuid4()),
                "application_id": seeker_app["id"],
                "job_id": seeker_app["job_id"],
                "job_title": job["title"] if job else "Unknown",
                "company": job["company"] if job else current_user.get("company", "Unknown"),
                "seeker_id": seeker_id,
                "seeker_name": seeker.get("name", ""),
                "seeker_avatar": seeker.get("avatar"),
                "recruiter_id": current_user["id"],
                "recruiter_name": current_user["name"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.matches.insert_one(match_doc)
            await create_notification(
                user_id=seeker_id,
                notif_type="match",
                title="It's a Match!",
                message=f"{current_user.get('company', 'A company')} is interested in you for the {job['title'] if job else 'a'} position!",
                data={"match_id": match_doc["id"]}
            )
            await manager.send_to_user(seeker_id, {"type": "new_match", "match": {k: v for k, v in match_doc.items() if k != "_id"}})
        else:
            # No existing application - notify seeker that a recruiter is interested
            await create_notification(
                user_id=seeker_id,
                notif_type="recruiter_interest",
                title="A recruiter is interested!",
                message=f"{current_user.get('company', 'A company')} thinks you'd be a great fit. Check out their job listings!",
                data={"recruiter_id": current_user["id"]}
            )

    return {"message": f"Swiped {action}", "is_matched": is_matched}


# ==================== SWIPE ====================

@router.post("/swipe")
async def swipe(action: SwipeAction, current_user: dict = Depends(get_current_user)):
    """Job seeker swipes on a job"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can swipe")
    
    # Check if already swiped
    existing = await db.applications.find_one({
        "job_id": action.job_id,
        "seeker_id": current_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already swiped on this job")
    
    # Check super like limit for today (free + purchased)
    if action.action == "superlike":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        superlikes_today = await db.applications.count_documents({
            "seeker_id": current_user["id"],
            "action": "superlike",
            "created_at": {
                "$gte": today_start.isoformat(),
                "$lt": today_end.isoformat()
            }
        })

        user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "seeker_purchased_superlikes": 1})
        purchased = (user_data or {}).get("seeker_purchased_superlikes", 0)
        free_remaining = max(0, DAILY_SUPERLIKE_LIMIT - superlikes_today)

        if free_remaining <= 0 and purchased <= 0:
            raise HTTPException(
                status_code=400,
                detail="No Super Likes remaining! Purchase more or try again tomorrow."
            )

        # Use purchased first if free are exhausted
        if free_remaining <= 0 and purchased > 0:
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$inc": {"seeker_purchased_superlikes": -1}}
            )
    
    # Get job details
    job = await db.jobs.find_one({"id": action.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    application_id = str(uuid.uuid4())
    application_doc = {
        "id": application_id,
        "job_id": action.job_id,
        "seeker_id": current_user["id"],
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.applications.insert_one(application_doc)
    
    # Return remaining super likes if it was a superlike action
    remaining_superlikes = None
    if action.action == "superlike":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        superlikes_today = await db.applications.count_documents({
            "seeker_id": current_user["id"],
            "action": "superlike",
            "created_at": {
                "$gte": today_start.isoformat(),
                "$lt": today_end.isoformat()
            }
        })
        user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "seeker_purchased_superlikes": 1})
        purchased_remaining = (user_data or {}).get("seeker_purchased_superlikes", 0)
        remaining_superlikes = max(0, DAILY_SUPERLIKE_LIMIT - superlikes_today) + purchased_remaining
    
    return {
        "message": f"Swiped {action.action}", 
        "application_id": application_id,
        "remaining_superlikes": remaining_superlikes
    }

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
        result.append({
            "id": app_id,
            "job_id": app.get("job_id"),
            "action": app.get("action", "like"),
            "status": status,
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
        })

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
    
    is_matched = response.action == "accept"
    
    await db.applications.update_one(
        {"id": response.application_id},
        {"$set": {
            "recruiter_action": response.action,
            "is_matched": is_matched
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
    
    return {"message": f"Application {response.action}ed", "is_matched": is_matched}


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
