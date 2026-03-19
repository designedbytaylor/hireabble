"""
Matches and Messages routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from datetime import datetime, timezone
import uuid

import asyncio

from database import (
    db, get_current_user, manager, create_notification,
    MatchResponse, MessageCreate, MessageResponse,
    send_email_notification, get_email_template, get_unsubscribe_url,
    get_user_email_prefs, escape_html, FRONTEND_URL, logger,
)
from content_filter import check_text, is_severe
from routers.users import get_all_blocked_ids
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Matches & Messages"])

# ==================== MATCHES ====================

@router.get("/matches", response_model=List[MatchResponse])
async def get_matches(current_user: dict = Depends(get_current_user)):
    """Get user's matches with unread message counts"""
    blocked_ids = await get_all_blocked_ids(current_user["id"])

    query = {
        "$or": [
            {"seeker_id": current_user["id"]},
            {"recruiter_id": current_user["id"]}
        ]
    }
    # Exclude matches involving blocked users
    if blocked_ids:
        query["seeker_id"] = {"$nin": blocked_ids} if current_user.get("role") == "recruiter" else current_user["id"]
        query["recruiter_id"] = {"$nin": blocked_ids} if current_user.get("role") == "seeker" else current_user["id"]
        # Rebuild with proper $and to handle both directions
        query = {"$and": [
            {"$or": [
                {"seeker_id": current_user["id"]},
                {"recruiter_id": current_user["id"]}
            ]},
            {"seeker_id": {"$nin": blocked_ids}},
            {"recruiter_id": {"$nin": blocked_ids}}
        ]}

    matches = await db.matches.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

    if matches:
        match_ids = [m["id"] for m in matches]

        # Batch-fetch unread counts and job photos in parallel
        job_ids = list(set(m.get("job_id") for m in matches if m.get("job_id")))
        unread_pipeline = [
            {"$match": {
                "match_id": {"$in": match_ids},
                "receiver_id": current_user["id"],
                "is_read": False
            }},
            {"$group": {"_id": "$match_id", "count": {"$sum": 1}}}
        ]

        unread_task = db.messages.aggregate(unread_pipeline).to_list(len(match_ids))
        if job_ids:
            jobs_task = db.jobs.find(
                {"id": {"$in": job_ids}},
                {"_id": 0, "id": 1, "listing_photo": 1, "company_logo": 1}
            ).to_list(len(job_ids))
            unread_results, jobs_list = await asyncio.gather(unread_task, jobs_task)
        else:
            unread_results = await unread_task
            jobs_list = []

        unread_map = {r["_id"]: r["count"] for r in unread_results}
        jobs_map = {j["id"]: j for j in jobs_list}

        for m in matches:
            m["unread_count"] = unread_map.get(m["id"], 0)
            job_data = jobs_map.get(m.get("job_id"), {})
            m["listing_photo"] = job_data.get("listing_photo")
            m["company_logo"] = job_data.get("company_logo")

    return matches

@router.get("/matches/{match_id}")
async def get_match(match_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific match"""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify user is part of this match
    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this match")
    
    return match


@router.get("/matches/{match_id}/profile")
async def get_match_profile(match_id: str, current_user: dict = Depends(get_current_user)):
    """Get the full profile of the other person in a match, plus job details and match score"""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch profile and job in parallel (both depend on match, not each other)
    other_id = match["seeker_id"] if current_user["id"] == match["recruiter_id"] else match["recruiter_id"]
    import asyncio
    coros = [db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})]
    if match.get("job_id"):
        coros.append(db.jobs.find_one({"id": match["job_id"]}, {"_id": 0}))
    results = await asyncio.gather(*coros)
    profile = results[0]
    job = results[1] if len(results) > 1 else None
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    # Calculate match score
    match_score = calculate_match_score(current_user, profile, job)

    return {
        "match": match,
        "profile": profile,
        "job": job,
        "match_score": match_score,
    }


def calculate_match_score(viewer: dict, other: dict, job: dict = None) -> int:
    """Calculate a compatibility score (0-100) between a candidate and job/recruiter"""
    score = 0
    max_score = 0

    # Skills match (40 points max)
    if job and job.get("requirements"):
        max_score += 40
        seeker = other if other.get("role") == "seeker" else viewer
        seeker_skills = [s.lower().strip() for s in seeker.get("skills", [])]
        job_reqs = [r.lower().strip() for r in job["requirements"]]
        if job_reqs:
            matched = sum(1 for r in job_reqs if any(r in s or s in r for s in seeker_skills))
            score += int((matched / len(job_reqs)) * 40)

    # Experience level match (20 points max)
    if job and job.get("experience_level"):
        max_score += 20
        seeker = other if other.get("role") == "seeker" else viewer
        exp_years = seeker.get("experience_years") or 0
        level_map = {"entry": (0, 2), "mid": (2, 5), "senior": (5, 10), "lead": (8, 99)}
        low, high = level_map.get(job["experience_level"], (0, 99))
        if low <= exp_years <= high:
            score += 20
        elif abs(exp_years - low) <= 2 or abs(exp_years - high) <= 2:
            score += 10

    # Location match (20 points max)
    max_score += 20
    if job and job.get("job_type") == "remote":
        score += 20  # Remote jobs match everyone
    elif job and job.get("location") and other.get("location"):
        job_loc = job["location"].lower().split(",")[0].strip()
        user_loc = other.get("location", "").lower().split(",")[0].strip()
        if job_loc and user_loc and (job_loc in user_loc or user_loc in job_loc):
            score += 20
        elif job_loc and user_loc:
            score += 5  # Partial credit

    # Profile completeness bonus (20 points max)
    max_score += 20
    seeker = other if other.get("role") == "seeker" else viewer
    fields_present = sum(1 for f in ["bio", "skills", "experience_years", "school", "work_history", "education"]
                        if seeker.get(f))
    score += int((fields_present / 6) * 20)

    if max_score == 0:
        return 50
    return min(100, int((score / max_score) * 100))



# ==================== MESSAGES ====================

@router.post("/messages", response_model=MessageResponse)
@limiter.limit("30/minute")
async def send_message(message: MessageCreate, request: Request, current_user: dict = Depends(get_current_user)):
    """Send a message in a match"""
    # Verify match exists and user is part of it
    match = await db.matches.find_one({"id": message.match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to message in this match")

    # Enforce message length limit to prevent DoS via massive payloads
    if len(message.content) > 5000:
        raise HTTPException(status_code=400, detail="Message too long (max 5000 characters)")

    # Check if either user has blocked the other
    other_id = match["recruiter_id"] if current_user["id"] == match["seeker_id"] else match["seeker_id"]
    blocked_ids = await get_all_blocked_ids(current_user["id"])
    if other_id in blocked_ids:
        raise HTTPException(status_code=403, detail="Cannot send messages to this user")

    # Content moderation on message text
    is_clean, violations = check_text(message.content)
    if not is_clean and is_severe(violations):
        raise HTTPException(status_code=400, detail="Message contains prohibited content.")

    # Determine receiver
    receiver_id = match["recruiter_id"] if current_user["id"] == match["seeker_id"] else match["seeker_id"]
    
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "match_id": message.match_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "sender_avatar": current_user.get("avatar") or current_user.get("photo_url"),
        "receiver_id": receiver_id,
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    
    await db.messages.insert_one(message_doc)
    
    # Create in-app notification for receiver
    await create_notification(
        user_id=receiver_id,
        notif_type="message",
        title="New Message",
        message=f"{current_user['name']}: {message.content[:50]}{'...' if len(message.content) > 50 else ''}",
        data={"match_id": message.match_id, "message_id": message_id}
    )
    
    # Send via WebSocket
    await manager.send_to_user(receiver_id, {
        "type": "new_message",
        "message": {k: v for k, v in message_doc.items() if k != "_id"}
    })

    # Check if we should send a message digest email (batched, 15min cooldown)
    async def _maybe_send_digest():
        try:
            prefs = await get_user_email_prefs(receiver_id)
            if not prefs.get("messages", True):
                return
            # Check if receiver is online (has active WebSocket)
            if receiver_id in manager.active_connections and manager.active_connections[receiver_id]:
                return  # User is online, skip email
            receiver = await db.users.find_one({"id": receiver_id}, {"_id": 0, "email": 1, "last_email_digest_at": 1})
            if not receiver or not receiver.get("email"):
                return
            last_digest = receiver.get("last_email_digest_at", "")
            from datetime import timedelta
            cooldown = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
            if last_digest and last_digest > cooldown:
                return  # Too soon since last digest
            # Count unread messages
            unread = await db.messages.count_documents({"receiver_id": receiver_id, "is_read": False})
            if unread < 1:
                return
            # Get unique senders
            pipeline = [
                {"$match": {"receiver_id": receiver_id, "is_read": False}},
                {"$group": {"_id": "$sender_name"}},
            ]
            senders = [doc["_id"] async for doc in db.messages.aggregate(pipeline)]
            sender_list = ", ".join(senders[:3])
            if len(senders) > 3:
                sender_list += f" and {len(senders) - 3} more"
            html = get_email_template(
                title="You have unread messages",
                body_html=f"<p>You have <strong>{unread}</strong> unread message{'s' if unread != 1 else ''} from {escape_html(sender_list)}.</p>",
                cta_text="Read Messages",
                cta_url=f"{FRONTEND_URL}/messages",
                unsubscribe_url=get_unsubscribe_url(receiver_id, "messages"),
            )
            await send_email_notification(receiver["email"], f"You have {unread} unread message{'s' if unread != 1 else ''} on Hireabble", html)
            await db.users.update_one({"id": receiver_id}, {"$set": {"last_email_digest_at": datetime.now(timezone.utc).isoformat()}})
        except Exception as e:
            logger.error(f"Message digest email error: {e}")
    asyncio.create_task(_maybe_send_digest())

    return {k: v for k, v in message_doc.items() if k != "_id"}

@router.get("/messages/{match_id}", response_model=List[MessageResponse])
async def get_messages(match_id: str, current_user: dict = Depends(get_current_user)):
    """Get messages for a match"""
    # Verify match and user authorization
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view these messages")
    
    messages = await db.messages.find(
        {"match_id": match_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    # Mark messages as read and notify sender
    unread = await db.messages.find(
        {"match_id": match_id, "receiver_id": current_user["id"], "is_read": False},
        {"_id": 0, "sender_id": 1, "id": 1}
    ).to_list(500)

    if unread:
        await db.messages.update_many(
            {"match_id": match_id, "receiver_id": current_user["id"], "is_read": False},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Notify senders via WebSocket that messages were read
        sender_ids = set(m["sender_id"] for m in unread)
        for sid in sender_ids:
            await manager.send_to_user(sid, {
                "type": "messages_read",
                "match_id": match_id,
                "read_by": current_user["id"]
            })

    return messages


@router.get("/messages/unread/count")
async def get_unread_message_count(current_user: dict = Depends(get_current_user)):
    """Get total count of unread messages for the current user"""
    count = await db.messages.count_documents({
        "receiver_id": current_user["id"],
        "is_read": False
    })
    return {"unread_count": count}


@router.post("/messages/{match_id}/read")
async def mark_messages_read(match_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all messages in a match as read by the current user."""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.messages.update_many(
        {"match_id": match_id, "receiver_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Notify sender
    other_id = match["recruiter_id"] if current_user["id"] == match["seeker_id"] else match["seeker_id"]
    if result.modified_count > 0:
        await manager.send_to_user(other_id, {
            "type": "messages_read",
            "match_id": match_id,
            "read_by": current_user["id"]
        })

    return {"marked_read": result.modified_count}


# ==================== PRE-MATCH MESSAGING (Enterprise) ====================

@router.post("/messages/pre-match")
async def send_pre_match_message(body: dict, current_user: dict = Depends(get_current_user)):
    """Send a message to a candidate before matching (Enterprise recruiter only).
    Creates an intro conversation the seeker sees in their messages."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can send pre-match messages")

    # Verify Enterprise subscription
    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc).isoformat()
    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now
            and sub.get("tier_id") == "recruiter_enterprise"):
        raise HTTPException(status_code=403, detail="Enterprise subscription required to message before matching")

    seeker_id = body.get("seeker_id")
    content = body.get("content", "").strip()
    job_id = body.get("job_id")

    if not seeker_id or not content:
        raise HTTPException(status_code=400, detail="seeker_id and content are required")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Message must be 500 characters or less")

    # Content moderation
    is_clean, violations = check_text(content)
    if not is_clean and is_severe(violations):
        raise HTTPException(status_code=400, detail="Message contains prohibited content.")

    # Check blocked
    blocked_ids = await get_all_blocked_ids(current_user["id"])
    if seeker_id in blocked_ids:
        raise HTTPException(status_code=403, detail="Cannot message this user")

    # Verify seeker exists
    seeker = await db.users.find_one({"id": seeker_id, "role": "seeker"}, {"_id": 0, "name": 1, "photo_url": 1, "avatar": 1})
    if not seeker:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Rate limit: max 10 pre-match messages per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    sent_today = await db.messages.count_documents({
        "sender_id": current_user["id"],
        "is_pre_match": True,
        "created_at": {"$gte": today_start},
    })
    if sent_today >= 10:
        raise HTTPException(status_code=429, detail="Daily pre-match message limit reached (10/day)")

    # Find or create a pre-match conversation thread (uses a pseudo-match)
    existing_thread = await db.matches.find_one({
        "recruiter_id": current_user["id"],
        "seeker_id": seeker_id,
        "is_pre_match": True,
    })

    if existing_thread:
        thread_id = existing_thread["id"]
    else:
        # Get job info if provided
        job_title = None
        company = current_user.get("company", "Unknown Company")
        if job_id:
            job = await db.jobs.find_one({"id": job_id, "recruiter_id": current_user["id"]}, {"_id": 0, "title": 1, "company": 1})
            if job:
                job_title = job.get("title")
                company = job.get("company", company)

        thread_id = str(uuid.uuid4())
        thread_doc = {
            "id": thread_id,
            "seeker_id": seeker_id,
            "seeker_name": seeker.get("name", ""),
            "seeker_avatar": seeker.get("avatar"),
            "seeker_photo": seeker.get("photo_url"),
            "recruiter_id": current_user["id"],
            "recruiter_name": current_user["name"],
            "recruiter_avatar": current_user.get("avatar"),
            "job_id": job_id,
            "job_title": job_title or "Direct Outreach",
            "company": company,
            "is_pre_match": True,
            "created_at": now,
        }
        await db.matches.insert_one(thread_doc)

    # Send the message
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "match_id": thread_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "sender_avatar": current_user.get("avatar") or current_user.get("photo_url"),
        "receiver_id": seeker_id,
        "content": content,
        "created_at": now,
        "is_read": False,
        "is_pre_match": True,
    }
    await db.messages.insert_one(message_doc)

    # Notify seeker
    await create_notification(
        user_id=seeker_id,
        notif_type="message",
        title="New message from a recruiter",
        message=f"{current_user['name']}: {content[:50]}{'...' if len(content) > 50 else ''}",
        data={"match_id": thread_id, "message_id": message_id, "is_pre_match": True}
    )

    await manager.send_to_user(seeker_id, {
        "type": "new_message",
        "message": {k: v for k, v in message_doc.items() if k != "_id"},
    })

    return {"message": "Message sent!", "thread_id": thread_id}
