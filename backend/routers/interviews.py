"""
Interview Scheduling routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import (
    db, get_current_user, create_notification, send_system_message, manager, logger,
    send_email_notification, get_email_template, get_unsubscribe_url, get_user_email_prefs,
    escape_html, FRONTEND_URL,
)
import asyncio

router = APIRouter(prefix="/interviews", tags=["Interview Scheduling"])


# ==================== MODELS ====================

class TimeSlot(BaseModel):
    start: str  # ISO datetime
    end: str    # ISO datetime

class InterviewCreate(BaseModel):
    match_id: str
    title: Optional[str] = None  # Auto-generated from job title if not provided
    description: Optional[str] = None
    proposed_times: List[TimeSlot]
    interview_type: str = "video"  # video, phone, in_person
    location: Optional[str] = None  # For in-person interviews

class InterviewRespond(BaseModel):
    selected_time_index: Optional[int] = None  # Index of chosen time slot
    action: str  # "accept", "decline", "reschedule"
    message: Optional[str] = None

class InterviewReschedule(BaseModel):
    proposed_times: List[TimeSlot]
    message: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.post("")
async def create_interview(data: InterviewCreate, current_user: dict = Depends(get_current_user)):
    """Create an interview request for a match (recruiters only)"""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can schedule interviews")

    # Verify match exists and user is part of it
    match = await db.matches.find_one({"id": data.match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized for this match")

    if not data.proposed_times:
        raise HTTPException(status_code=400, detail="At least one proposed time is required")

    # Determine the other party
    other_id = match["recruiter_id"] if current_user["id"] == match["seeker_id"] else match["seeker_id"]

    # Auto-generate title from job title if not provided
    interview_title = data.title or f"Interview - {match.get('job_title', 'Position')}"

    interview_id = str(uuid.uuid4())
    interview_doc = {
        "id": interview_id,
        "match_id": data.match_id,
        "created_by": current_user["id"],
        "created_by_name": current_user["name"],
        "other_party_id": other_id,
        "title": interview_title,
        "description": data.description,
        "proposed_times": [t.dict() for t in data.proposed_times],
        "selected_time": None,
        "interview_type": data.interview_type,
        "location": data.location,
        "status": "pending",  # pending, accepted, declined, rescheduled, cancelled
        "seeker_id": match["seeker_id"],
        "recruiter_id": match["recruiter_id"],
        "job_title": match.get("job_title", ""),
        "company": match.get("company", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.interviews.insert_one(interview_doc)

    # Auto-advance pipeline stage to "interviewing"
    await db.applications.update_many(
        {"seeker_id": match["seeker_id"], "recruiter_id": match["recruiter_id"],
         "pipeline_stage": {"$in": ["applied", "reviewing", "shortlisted", None]}},
        {"$set": {"pipeline_stage": "interviewing"}}
    )

    # Notify the other party
    notif_msg = f"{current_user['name']} wants to schedule an interview: {interview_title}"
    await create_notification(
        user_id=other_id,
        notif_type="interview",
        title="Interview Request",
        message=notif_msg,
        data={"interview_id": interview_id, "match_id": data.match_id}
    )

    # Send email notification (async, non-blocking)
    async def _send_interview_email():
        prefs = await get_user_email_prefs(other_id)
        if not prefs.get("interviews", True):
            return
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "email": 1})
        if not other_user or not other_user.get("email"):
            return
        html = get_email_template(
            title="Interview Request",
            body_html=f"<p>{escape_html(current_user['name'])} wants to schedule an interview for <strong>{escape_html(match.get('job_title', 'a position'))}</strong> at {escape_html(match.get('company', 'their company'))}.</p><p>Interview: {escape_html(interview_title)}</p>",
            cta_text="View Interview",
            cta_url=f"{FRONTEND_URL}/interviews",
            unsubscribe_url=get_unsubscribe_url(other_id, "interviews"),
        )
        await send_email_notification(other_user["email"], f"Interview request: {interview_title}", html)
    asyncio.create_task(_send_interview_email())

    # Send a chat message so it appears in the conversation
    times_text = ""
    for t in data.proposed_times[:3]:
        try:
            dt = datetime.fromisoformat(t.start.replace('Z', '+00:00'))
            times_text += f"\n  - {dt.strftime('%b %d, %Y at %I:%M %p')}"
        except Exception:
            times_text += f"\n  - {t.start}"

    chat_msg = f"📅 Interview Request: {interview_title}"
    if data.interview_type:
        chat_msg += f"\nType: {data.interview_type.replace('_', ' ').title()}"
    if times_text:
        chat_msg += f"\nProposed times:{times_text}"
    chat_msg += "\n\nPlease respond in the Interviews section."

    await send_system_message(
        match_id=data.match_id,
        sender_id=current_user["id"],
        sender_name=current_user["name"],
        content=chat_msg,
        msg_type="interview_request",
        data={"interview_id": interview_id, "match_id": data.match_id}
    )

    return {k: v for k, v in interview_doc.items() if k != "_id"}


@router.get("")
async def list_interviews(current_user: dict = Depends(get_current_user)):
    """List all interviews for current user"""
    interviews = await db.interviews.find(
        {"$or": [
            {"created_by": current_user["id"]},
            {"other_party_id": current_user["id"]}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    # Enrich with participant names from matches
    match_ids = list(set(i.get("match_id") for i in interviews if i.get("match_id")))
    if match_ids:
        matches = await db.matches.find(
            {"id": {"$in": match_ids}},
            {"_id": 0, "id": 1, "seeker_name": 1, "recruiter_name": 1,
             "seeker_photo": 1, "recruiter_photo": 1,
             "seeker_avatar": 1, "recruiter_avatar": 1}
        ).to_list(len(match_ids))
        match_map = {m["id"]: m for m in matches}
        for interview in interviews:
            m = match_map.get(interview.get("match_id"))
            if m:
                interview["seeker_name"] = m.get("seeker_name", "")
                interview["recruiter_name"] = m.get("recruiter_name", "")
                interview["seeker_photo"] = m.get("seeker_photo") or m.get("seeker_avatar")
                interview["recruiter_photo"] = m.get("recruiter_photo") or m.get("recruiter_avatar")

    return interviews


@router.get("/{interview_id}")
async def get_interview(interview_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific interview"""
    interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview["created_by"] != current_user["id"] and interview["other_party_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this interview")

    return interview


@router.put("/{interview_id}/respond")
async def respond_to_interview(
    interview_id: str,
    data: InterviewRespond,
    current_user: dict = Depends(get_current_user)
):
    """Respond to an interview request (accept/decline/reschedule)"""
    interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Only the recipient can respond
    if interview["other_party_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the recipient can respond to this interview")

    if interview["status"] not in ("pending", "rescheduled"):
        raise HTTPException(status_code=400, detail=f"Cannot respond to an interview with status '{interview['status']}'")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if data.action == "accept":
        if data.selected_time_index is None or data.selected_time_index >= len(interview["proposed_times"]):
            raise HTTPException(status_code=400, detail="Please select a valid time slot")
        update["status"] = "accepted"
        update["selected_time"] = interview["proposed_times"][data.selected_time_index]
        notif_msg = f"{current_user['name']} accepted the interview: {interview['title']}"
    elif data.action == "decline":
        update["status"] = "declined"
        notif_msg = f"{current_user['name']} declined the interview: {interview['title']}"
    elif data.action == "reschedule":
        update["status"] = "rescheduled"
        notif_msg = f"{current_user['name']} requested to reschedule: {interview['title']}"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    if data.message:
        update["response_message"] = data.message

    await db.interviews.update_one({"id": interview_id}, {"$set": update})

    # Notify the creator
    await create_notification(
        user_id=interview["created_by"],
        notif_type="interview",
        title=f"Interview {data.action.capitalize()}",
        message=notif_msg,
        data={"interview_id": interview_id, "match_id": interview["match_id"]}
    )

    # Send email notification (async, non-blocking)
    async def _send_respond_email():
        prefs = await get_user_email_prefs(interview["created_by"])
        if not prefs.get("interviews", True):
            return
        creator = await db.users.find_one({"id": interview["created_by"]}, {"_id": 0, "email": 1})
        if not creator or not creator.get("email"):
            return
        action_label = {"accept": "accepted", "decline": "declined", "reschedule": "requested to reschedule"}.get(data.action, data.action)
        html = get_email_template(
            title=f"Interview {data.action.capitalize()}d",
            body_html=f"<p>{escape_html(current_user['name'])} has {action_label} the interview: <strong>{escape_html(interview['title'])}</strong></p>",
            cta_text="View Interview",
            cta_url=f"{FRONTEND_URL}/interviews",
            unsubscribe_url=get_unsubscribe_url(interview["created_by"], "interviews"),
        )
        await send_email_notification(creator["email"], f"Interview {action_label}: {interview['title']}", html)
    asyncio.create_task(_send_respond_email())

    updated = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    return updated


@router.put("/{interview_id}/reschedule")
async def reschedule_interview(
    interview_id: str,
    data: InterviewReschedule,
    current_user: dict = Depends(get_current_user)
):
    """Propose new times for an interview"""
    interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview["created_by"] != current_user["id"] and interview["other_party_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not data.proposed_times:
        raise HTTPException(status_code=400, detail="At least one proposed time is required")

    # Determine who to notify
    other_id = interview["other_party_id"] if current_user["id"] == interview["created_by"] else interview["created_by"]

    update = {
        "proposed_times": [t.dict() for t in data.proposed_times],
        "selected_time": None,
        "status": "rescheduled",
        "other_party_id": other_id,  # Swap so the other person responds
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.interviews.update_one({"id": interview_id}, {"$set": update})

    await create_notification(
        user_id=other_id,
        notif_type="interview",
        title="Interview Rescheduled",
        message=f"{current_user['name']} proposed new times for: {interview['title']}",
        data={"interview_id": interview_id, "match_id": interview["match_id"]}
    )

    updated = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    return updated


@router.put("/{interview_id}/cancel")
async def cancel_interview(interview_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel an interview"""
    interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview["created_by"] != current_user["id"] and interview["other_party_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Notify the other party
    other_id = interview["other_party_id"] if current_user["id"] == interview["created_by"] else interview["created_by"]
    await create_notification(
        user_id=other_id,
        notif_type="interview",
        title="Interview Cancelled",
        message=f"{current_user['name']} cancelled the interview: {interview['title']}",
        data={"interview_id": interview_id, "match_id": interview["match_id"]}
    )

    return {"message": "Interview cancelled"}
