"""
Stats and utility routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
import io
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

router = APIRouter(tags=["Stats & Utilities"])

# ==================== STATS ====================

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    uid = current_user["id"]
    if current_user["role"] == "seeker":
        applications, superlikes, matches = await asyncio.gather(
            db.applications.count_documents({"seeker_id": uid}),
            db.applications.count_documents({"seeker_id": uid, "action": "superlike"}),
            db.matches.count_documents({"seeker_id": uid}),
        )
        return {
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
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # Run all count queries in parallel
    (
        active_jobs, total_jobs, total_applications, pending_applications,
        super_likes, matches, interviews_scheduled, interviews_pending,
        responded, weekly_apps, jobs_list,
    ) = await asyncio.gather(
        db.jobs.count_documents({"recruiter_id": uid, "is_active": True}),
        db.jobs.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid}),
        db.applications.count_documents({"recruiter_id": uid, "recruiter_action": None}),
        db.applications.count_documents({"recruiter_id": uid, "action": "superlike"}),
        db.matches.count_documents({"recruiter_id": uid}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "accepted"}),
        db.interviews.count_documents({"recruiter_id": uid, "status": "pending"}),
        db.applications.count_documents({"recruiter_id": uid, "recruiter_action": {"$ne": None}}),
        db.applications.count_documents({"recruiter_id": uid, "created_at": {"$gte": week_ago}}),
        db.jobs.find({"recruiter_id": uid}, {"_id": 0, "id": 1, "title": 1}).to_list(50),
    )

    response_rate = round((responded / total_applications * 100) if total_applications > 0 else 0)
    match_rate = round((matches / total_applications * 100) if total_applications > 0 else 0)

    # Get per-job stats in parallel (not one-by-one)
    if jobs_list:
        job_stats = await asyncio.gather(*[
            asyncio.gather(
                db.applications.count_documents({"job_id": job["id"]}),
                db.matches.count_documents({"job_id": job["id"]}),
            )
            for job in jobs_list
        ])
        top_jobs = [{
            "job_id": jobs_list[i]["id"],
            "title": jobs_list[i]["title"],
            "applications": job_stats[i][0],
            "matches": job_stats[i][1],
        } for i in range(len(jobs_list))]
        top_jobs.sort(key=lambda j: j["applications"], reverse=True)
    else:
        top_jobs = []

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
    """Download user profile as a professionally formatted PDF resume"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can download resumes")

    # Fetch full user data (profile may have work_history, education, references)
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    if not user:
        user = current_user

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.65 * inch, rightMargin=0.65 * inch
    )
    styles = getSampleStyleSheet()

    # Color scheme
    primary = colors.HexColor('#1a1a2e')
    accent = colors.HexColor('#6366f1')
    dark_gray = colors.HexColor('#333333')
    med_gray = colors.HexColor('#666666')
    light_gray = colors.HexColor('#999999')

    # Custom styles
    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=26, textColor=primary, spaceAfter=2, fontName='Helvetica-Bold', alignment=TA_LEFT)
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=14, textColor=accent, spaceAfter=4, fontName='Helvetica')
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'],
        fontSize=9, textColor=med_gray, spaceAfter=2, fontName='Helvetica')
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=12, textColor=accent, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold', borderWidth=0, leading=16)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=11, textColor=primary, fontName='Helvetica-Bold', spaceAfter=1)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=10, textColor=med_gray, fontName='Helvetica', spaceAfter=2)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, spaceAfter=4, fontName='Helvetica', leading=14)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, leftIndent=12, fontName='Helvetica', leading=13, spaceAfter=2)

    elements = []

    # ===== HEADER =====
    elements.append(Paragraph(user.get('name', 'Job Seeker'), name_style))
    if user.get('title'):
        elements.append(Paragraph(user['title'], title_style))

    # Contact line
    contact_parts = []
    if user.get('email'):
        contact_parts.append(user['email'])
    if user.get('location'):
        contact_parts.append(user['location'])
    if user.get('work_preference'):
        pref_labels = {'remote': 'Remote', 'onsite': 'On-site', 'hybrid': 'Hybrid', 'flexible': 'Flexible'}
        contact_parts.append(pref_labels.get(user['work_preference'], user['work_preference']))
    if contact_parts:
        elements.append(Paragraph("  |  ".join(contact_parts), contact_style))

    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0'), spaceAfter=8))

    # ===== PROFESSIONAL SUMMARY =====
    if user.get('bio'):
        elements.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        elements.append(Paragraph(user['bio'], body_style))

    # ===== EXPERIENCE =====
    work_history = user.get('work_history', [])
    has_experience = work_history or user.get('current_employer')

    if has_experience:
        elements.append(Paragraph("EXPERIENCE", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))

        if work_history:
            for job in work_history:
                title_text = job.get('title', 'Role')
                elements.append(Paragraph(title_text, job_title_style))
                company_line = job.get('company', '')
                dates = ""
                if job.get('start_date'):
                    dates = job['start_date']
                    if job.get('end_date'):
                        dates += f" - {job['end_date']}"
                    else:
                        dates += " - Present"
                if company_line and dates:
                    company_line += f"  |  {dates}"
                elements.append(Paragraph(company_line, company_style))
                if job.get('description'):
                    for line in job['description'].split('\n'):
                        line = line.strip()
                        if line:
                            elements.append(Paragraph(f"• {line}", bullet_style))
                elements.append(Spacer(1, 6))
        else:
            if user.get('current_employer'):
                elements.append(Paragraph(user.get('title', 'Professional'), job_title_style))
                exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
                elements.append(Paragraph(f"{user['current_employer']}  |  {exp_str}", company_style))

    # ===== EDUCATION =====
    edu_list = user.get('education', [])
    has_edu = edu_list or user.get('school')

    if has_edu:
        elements.append(Paragraph("EDUCATION", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))

        if edu_list:
            for edu in edu_list:
                degree_text = edu.get('degree', '')
                if edu.get('field'):
                    degree_text += f" in {edu['field']}" if degree_text else edu['field']
                if degree_text:
                    elements.append(Paragraph(degree_text, job_title_style))
                school_line = edu.get('school', '')
                if edu.get('year'):
                    school_line += f"  |  {edu['year']}"
                if school_line:
                    elements.append(Paragraph(school_line, company_style))
                elements.append(Spacer(1, 4))
        else:
            degree_map = {
                'high_school': 'High School Diploma', 'some_college': 'Some College',
                'associates': "Associate's Degree", 'bachelors': "Bachelor's Degree",
                'masters': "Master's Degree", 'phd': 'PhD / Doctorate',
                'bootcamp': 'Bootcamp / Certification', 'self_taught': 'Self-taught',
            }
            degree_display = degree_map.get(user.get('degree', ''), user.get('degree', ''))
            if degree_display:
                elements.append(Paragraph(degree_display, job_title_style))
            if user.get('school'):
                elements.append(Paragraph(user['school'], company_style))

    # ===== SKILLS =====
    if user.get('skills'):
        elements.append(Paragraph("SKILLS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        # Display as skill chips in rows
        skills_text = "  •  ".join(user['skills'])
        elements.append(Paragraph(skills_text, body_style))

    # ===== CERTIFICATIONS =====
    if user.get('certifications'):
        elements.append(Paragraph("CERTIFICATIONS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                elements.append(Paragraph(f"• {cert}", bullet_style))

    # ===== REFERENCES =====
    refs = user.get('references', [])
    if refs and not user.get('references_hidden', True):
        elements.append(Paragraph("REFERENCES", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for ref in refs:
            ref_name = ref.get('name', '')
            ref_title = ref.get('title', '')
            ref_company = ref.get('company', '')
            ref_contact = ref.get('email') or ref.get('phone', '')
            line = f"<b>{ref_name}</b>"
            if ref_title:
                line += f" - {ref_title}"
            if ref_company:
                line += f" at {ref_company}"
            if ref_contact:
                line += f"  |  {ref_contact}"
            elements.append(Paragraph(line, body_style))
    elif refs:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("References available upon request", ParagraphStyle(
            'RefNote', parent=styles['Normal'], fontSize=9, textColor=light_gray, alignment=TA_CENTER
        )))

    # Footer
    elements.append(Spacer(1, 20))

    doc.build(elements)
    buffer.seek(0)

    filename = f"{user.get('name', 'resume').replace(' ', '_')}_Resume.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/applicant/{seeker_id}/resume/pdf")
async def download_applicant_resume_pdf(seeker_id: str, current_user: dict = Depends(get_current_user)):
    """Download a seeker's resume as PDF (recruiter only, must have an application)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can download applicant resumes")

    # Verify there's an application from this seeker to this recruiter
    app = await db.applications.find_one({
        "seeker_id": seeker_id,
        "recruiter_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    })
    if not app:
        raise HTTPException(status_code=403, detail="No application from this seeker")

    user = await db.users.find_one({"id": seeker_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Seeker not found")

    # Reuse the same PDF generation logic
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.65 * inch, rightMargin=0.65 * inch
    )
    styles = getSampleStyleSheet()

    primary = colors.HexColor('#1a1a2e')
    accent = colors.HexColor('#6366f1')
    dark_gray = colors.HexColor('#333333')
    med_gray = colors.HexColor('#666666')
    light_gray = colors.HexColor('#999999')

    name_style = ParagraphStyle('Name', parent=styles['Heading1'],
        fontSize=26, textColor=primary, spaceAfter=2, fontName='Helvetica-Bold', alignment=TA_LEFT)
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=14, textColor=accent, spaceAfter=4, fontName='Helvetica')
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'],
        fontSize=9, textColor=med_gray, spaceAfter=2, fontName='Helvetica')
    section_style = ParagraphStyle('Section', parent=styles['Heading2'],
        fontSize=12, textColor=accent, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold', borderWidth=0, leading=16)
    job_title_style = ParagraphStyle('JobTitle', parent=styles['Normal'],
        fontSize=11, textColor=primary, fontName='Helvetica-Bold', spaceAfter=1)
    company_style = ParagraphStyle('Company', parent=styles['Normal'],
        fontSize=10, textColor=med_gray, fontName='Helvetica', spaceAfter=2)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, spaceAfter=4, fontName='Helvetica', leading=14)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=10, textColor=dark_gray, leftIndent=12, fontName='Helvetica', leading=13, spaceAfter=2)

    elements = []
    elements.append(Paragraph(user.get('name', 'Job Seeker'), name_style))
    if user.get('title'):
        elements.append(Paragraph(user['title'], title_style))

    contact_parts = []
    if user.get('email'):
        contact_parts.append(user['email'])
    if user.get('location'):
        contact_parts.append(user['location'])
    if contact_parts:
        elements.append(Paragraph("  |  ".join(contact_parts), contact_style))

    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0'), spaceAfter=8))

    if user.get('bio'):
        elements.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        elements.append(Paragraph(user['bio'], body_style))

    work_history = user.get('work_history', [])
    if work_history or user.get('current_employer'):
        elements.append(Paragraph("EXPERIENCE", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        if work_history:
            for job in work_history:
                elements.append(Paragraph(job.get('title', 'Role'), job_title_style))
                cl = job.get('company', '')
                dates = ""
                if job.get('start_date'):
                    dates = job['start_date']
                    dates += f" - {job.get('end_date', 'Present')}"
                if cl and dates:
                    cl += f"  |  {dates}"
                elements.append(Paragraph(cl, company_style))
                if job.get('description'):
                    for line in job['description'].split('\n'):
                        line = line.strip()
                        if line:
                            elements.append(Paragraph(f"• {line}", bullet_style))
                elements.append(Spacer(1, 6))
        elif user.get('current_employer'):
            elements.append(Paragraph(user.get('title', 'Professional'), job_title_style))
            exp_str = f"{user.get('experience_years', 0)}+ years" if user.get('experience_years') else ""
            elements.append(Paragraph(f"{user['current_employer']}  |  {exp_str}", company_style))

    edu_list = user.get('education', [])
    if edu_list or user.get('school'):
        elements.append(Paragraph("EDUCATION", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        if edu_list:
            for edu in edu_list:
                dt = edu.get('degree', '')
                if edu.get('field'):
                    dt += f" in {edu['field']}" if dt else edu['field']
                if dt:
                    elements.append(Paragraph(dt, job_title_style))
                sl = edu.get('school', '')
                if edu.get('year'):
                    sl += f"  |  {edu['year']}"
                if sl:
                    elements.append(Paragraph(sl, company_style))
                elements.append(Spacer(1, 4))
        elif user.get('school'):
            if user.get('degree'):
                elements.append(Paragraph(user['degree'], job_title_style))
            elements.append(Paragraph(user['school'], company_style))

    if user.get('skills'):
        elements.append(Paragraph("SKILLS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        elements.append(Paragraph("  •  ".join(user['skills']), body_style))

    if user.get('certifications'):
        elements.append(Paragraph("CERTIFICATIONS", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=6))
        for cert in user['certifications']:
            if isinstance(cert, str) and cert.strip():
                elements.append(Paragraph(f"• {cert}", bullet_style))

    elements.append(Spacer(1, 20))
    doc.build(elements)
    buffer.seek(0)

    filename = f"{user.get('name', 'resume').replace(' ', '_')}_Resume.pdf"
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
