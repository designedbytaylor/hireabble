"""
Jobs routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import (
    db, get_current_user,
    JobCreate, JobResponse
)
from content_filter import check_fields, is_severe

router = APIRouter(prefix="/jobs", tags=["Jobs"])

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
    location: Optional[str] = None
):
    """Get available jobs for seekers or recruiter's own jobs"""
    
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
        
        query = {
            "id": {"$nin": swiped_job_ids},
            "is_active": True
        }
        
        # Apply filters
        if job_type:
            query["job_type"] = job_type
        if experience_level:
            query["experience_level"] = experience_level
        if salary_min:
            query["salary_min"] = {"$gte": salary_min}
        if location:
            query["location"] = {"$regex": location, "$options": "i"}
        
        jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return jobs

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
                      "experience_level", "is_active"]
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

@router.delete("/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a job posting"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can delete jobs")
    
    result = await db.jobs.delete_one({"id": job_id, "recruiter_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found or not authorized")
    
    return {"message": "Job deleted successfully"}
