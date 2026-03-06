"""
Stats and utility routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
import io

# PDF Generation
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from database import (
    db, get_current_user
)

router = APIRouter(tags=["Stats & Utilities"])

# ==================== STATS ====================

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    if current_user["role"] == "seeker":
        applications = await db.applications.count_documents({"seeker_id": current_user["id"]})
        superlikes = await db.applications.count_documents({
            "seeker_id": current_user["id"],
            "action": "superlike"
        })
        matches = await db.matches.count_documents({"seeker_id": current_user["id"]})
        
        return {
            "applications_sent": applications,
            "super_likes_used": superlikes,
            "matches": matches
        }
    else:
        jobs = await db.jobs.count_documents({"recruiter_id": current_user["id"]})
        applications = await db.applications.count_documents({"recruiter_id": current_user["id"]})
        matches = await db.matches.count_documents({"recruiter_id": current_user["id"]})
        
        return {
            "jobs_posted": jobs,
            "applications_received": applications,
            "matches": matches
        }

@router.get("/stats/recruiter")
async def get_recruiter_stats(current_user: dict = Depends(get_current_user)):
    """Get detailed recruiter statistics"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")

    uid = current_user["id"]

    active_jobs = await db.jobs.count_documents({"recruiter_id": uid, "is_active": True})
    total_jobs = await db.jobs.count_documents({"recruiter_id": uid})
    total_applications = await db.applications.count_documents({"recruiter_id": uid})
    pending_applications = await db.applications.count_documents({"recruiter_id": uid, "recruiter_action": None})
    super_likes = await db.applications.count_documents({"recruiter_id": uid, "action": "superlike"})
    matches = await db.matches.count_documents({"recruiter_id": uid})
    interviews_scheduled = await db.interviews.count_documents({"recruiter_id": uid, "status": "accepted"})
    interviews_pending = await db.interviews.count_documents({"recruiter_id": uid, "status": "pending"})

    # Application response rate
    responded = await db.applications.count_documents({
        "recruiter_id": uid,
        "recruiter_action": {"$ne": None}
    })
    response_rate = round((responded / total_applications * 100) if total_applications > 0 else 0)

    # Match rate (matches / total applications)
    match_rate = round((matches / total_applications * 100) if total_applications > 0 else 0)

    # Weekly new applications (last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    weekly_apps = await db.applications.count_documents({
        "recruiter_id": uid,
        "created_at": {"$gte": week_ago}
    })

    # Applications per job (for top jobs)
    jobs_list = await db.jobs.find(
        {"recruiter_id": uid},
        {"_id": 0, "id": 1, "title": 1}
    ).to_list(50)

    top_jobs = []
    for job in jobs_list:
        app_count = await db.applications.count_documents({"job_id": job["id"]})
        match_count = await db.matches.count_documents({"job_id": job["id"]})
        top_jobs.append({
            "job_id": job["id"],
            "title": job["title"],
            "applications": app_count,
            "matches": match_count,
        })
    top_jobs.sort(key=lambda j: j["applications"], reverse=True)

    return {
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


@router.get("/profile/completeness")
async def get_profile_completeness(current_user: dict = Depends(get_current_user)):
    """Get profile completeness percentage"""
    if current_user["role"] != "seeker":
        return {"percentage": 100, "missing_fields": [], "is_complete": True}
    
    fields_to_check = {
        "name": 10,
        "title": 15,
        "bio": 10,
        "skills": 15,
        "experience_years": 10,
        "location": 10,
        "photo_url": 15,
        "school": 5,
        "degree": 5,
        "current_employer": 5
    }
    
    total = 0
    missing = []
    
    for field, weight in fields_to_check.items():
        value = current_user.get(field)
        if value and (not isinstance(value, list) or len(value) > 0):
            total += weight
        else:
            missing.append(field)
    
    return {
        "percentage": total,
        "missing_fields": missing,
        "is_complete": total >= 80
    }

# ==================== RESUME PDF ====================

@router.get("/users/resume/download")
async def download_resume(current_user: dict = Depends(get_current_user)):
    """Download user profile as PDF resume"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can download resumes")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, alignment=TA_CENTER, spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER, textColor=colors.gray, spaceAfter=20)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#6366f1'), spaceBefore=15, spaceAfter=8)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, spaceAfter=6)
    
    elements = []
    
    # Header
    elements.append(Paragraph(current_user.get('name', 'Job Seeker'), title_style))
    subtitle = current_user.get('title', '')
    if current_user.get('location'):
        subtitle += f" | {current_user['location']}"
    elements.append(Paragraph(subtitle, subtitle_style))
    
    # Contact
    elements.append(Paragraph(f"Email: {current_user.get('email', 'N/A')}", body_style))
    elements.append(Spacer(1, 10))
    
    # About
    if current_user.get('bio'):
        elements.append(Paragraph("About", section_style))
        elements.append(Paragraph(current_user['bio'], body_style))
    
    # Experience
    elements.append(Paragraph("Experience", section_style))
    exp_years = current_user.get('experience_years', 0)
    current_emp = current_user.get('current_employer', 'N/A')
    elements.append(Paragraph(f"Years of Experience: {exp_years}", body_style))
    elements.append(Paragraph(f"Current Employer: {current_emp}", body_style))
    
    # Education
    if current_user.get('school') or current_user.get('degree'):
        elements.append(Paragraph("Education", section_style))
        if current_user.get('degree'):
            elements.append(Paragraph(current_user['degree'], body_style))
        if current_user.get('school'):
            elements.append(Paragraph(current_user['school'], body_style))
    
    # Skills
    if current_user.get('skills'):
        elements.append(Paragraph("Skills", section_style))
        skills_text = " • ".join(current_user['skills'])
        elements.append(Paragraph(skills_text, body_style))
    
    # Certifications
    if current_user.get('certifications'):
        elements.append(Paragraph("Certifications", section_style))
        for cert in current_user['certifications']:
            elements.append(Paragraph(f"• {cert}", body_style))
    
    # Footer
    elements.append(Spacer(1, 30))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph("Generated via Hireabble", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"{current_user.get('name', 'resume').replace(' ', '_')}_resume.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
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
