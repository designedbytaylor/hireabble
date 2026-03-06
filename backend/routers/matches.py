"""
Matches and Messages routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from database import (
    db, get_current_user, manager, create_notification,
    MatchResponse, MessageCreate, MessageResponse
)
from content_filter import check_text, is_severe

router = APIRouter(tags=["Matches & Messages"])

# ==================== MATCHES ====================

@router.get("/matches", response_model=List[MatchResponse])
async def get_matches(current_user: dict = Depends(get_current_user)):
    """Get user's matches"""
    query = {
        "$or": [
            {"seeker_id": current_user["id"]},
            {"recruiter_id": current_user["id"]}
        ]
    }
    matches = await db.matches.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
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

# ==================== MESSAGES ====================

@router.post("/messages", response_model=MessageResponse)
async def send_message(message: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message in a match"""
    # Verify match exists and user is part of it
    match = await db.matches.find_one({"id": message.match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if match["seeker_id"] != current_user["id"] and match["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to message in this match")
    
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
    
    # Mark messages as read
    await db.messages.update_many(
        {"match_id": match_id, "receiver_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return messages
