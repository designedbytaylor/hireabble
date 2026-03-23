"""
Notifications routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import HTMLResponse
from typing import List, Optional
from pydantic import BaseModel
import jwt as pyjwt

from database import (
    db, get_current_user,
    NotificationResponse,
    JWT_SECRET, JWT_ALGORITHM,
    get_user_email_prefs,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user), limit: int = 20):
    """Get notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications

@router.get("/unread/count")
async def get_unread_notifications_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"unread_count": count}

@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@router.put("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}


# ==================== EMAIL NOTIFICATION PREFERENCES ====================

class EmailPreferences(BaseModel):
    matches: Optional[bool] = None
    interviews: Optional[bool] = None
    messages: Optional[bool] = None
    status_updates: Optional[bool] = None
    saved_job_reminders: Optional[bool] = None
    marketing_emails_opt_in: Optional[bool] = None

@router.get("/preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get email notification preferences"""
    prefs = await get_user_email_prefs(current_user["id"])
    # Include marketing opt-in from user doc
    user = await db.users.find_one({"id": current_user["id"]}, {"marketing_emails_opt_in": 1})
    prefs["marketing_emails_opt_in"] = user.get("marketing_emails_opt_in", False) if user else False
    return prefs

@router.put("/preferences")
async def update_notification_preferences(data: EmailPreferences, current_user: dict = Depends(get_current_user)):
    """Update email notification preferences"""
    update = {}
    for field in ("matches", "interviews", "messages", "status_updates", "saved_job_reminders"):
        val = getattr(data, field)
        if val is not None:
            update[f"email_notifications.{field}"] = val
    if data.marketing_emails_opt_in is not None:
        update["marketing_emails_opt_in"] = data.marketing_emails_opt_in
    if update:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update})
    return await get_notification_preferences(current_user)

@router.get("/unsubscribe")
async def unsubscribe_from_emails(token: str = Query(...), type: str = Query(...)):
    """One-click unsubscribe from email notifications (no auth required)"""
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("action") != "unsubscribe":
            raise HTTPException(status_code=400, detail="Invalid token")
        user_id = payload["user_id"]
        notif_type = payload.get("type", type)
        valid_types = ("matches", "interviews", "messages", "status_updates")
        if notif_type not in valid_types:
            raise HTTPException(status_code=400, detail="Invalid notification type")
        await db.users.update_one({"id": user_id}, {"$set": {f"email_notifications.{notif_type}": False}})
        return HTMLResponse(content="""
        <html><body style="font-family: Arial; text-align: center; padding: 60px;">
            <h2>Unsubscribed</h2>
            <p>You've been unsubscribed from these email notifications.</p>
            <p>You can re-enable them anytime in your Profile settings.</p>
        </body></html>
        """)
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
