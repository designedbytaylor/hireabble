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
    """Get remaining super likes for today"""
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
    
    return {
        "remaining": max(0, DAILY_SUPERLIKE_LIMIT - superlikes_today),
        "used_today": superlikes_today,
        "daily_limit": DAILY_SUPERLIKE_LIMIT
    }

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
    
    # Check super like limit for today
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
        
        if superlikes_today >= DAILY_SUPERLIKE_LIMIT:
            raise HTTPException(
                status_code=400, 
                detail=f"Daily Super Like limit reached ({DAILY_SUPERLIKE_LIMIT}/day). Try again tomorrow!"
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
        remaining_superlikes = DAILY_SUPERLIKE_LIMIT - superlikes_today
    
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

    # Enrich with job details
    result = []
    for app in applications:
        job = await db.jobs.find_one({"id": app["job_id"]}, {"_id": 0})
        status = "matched" if app.get("is_matched") else (
            "declined" if app.get("recruiter_action") == "reject" else "pending"
        )
        result.append({
            "id": app["id"],
            "job_id": app["job_id"],
            "action": app["action"],
            "status": status,
            "recruiter_action": app.get("recruiter_action"),
            "is_matched": app.get("is_matched", False),
            "created_at": app["created_at"],
            "job": {
                "title": job["title"] if job else "Job Removed",
                "company": job["company"] if job else "",
                "location": job.get("location", "") if job else "",
                "job_type": job.get("job_type", "") if job else "",
                "salary_min": job.get("salary_min") if job else None,
                "salary_max": job.get("salary_max") if job else None,
                "company_logo": job.get("company_logo") if job else None,
                "employment_type": job.get("employment_type", "full-time") if job else "",
            } if True else None,
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
