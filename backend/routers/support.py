"""
Support ticket system for Hireabble.

User endpoints: create/view/reply to their own tickets.
Admin endpoints: list all tickets, reply, update status/priority/assignee.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

from database import db, get_current_user, get_current_admin, create_notification, manager

router = APIRouter(tags=["Support"])

# ==================== MODELS ====================

class TicketCreate(BaseModel):
    category: str  # 'account', 'billing', 'technical', 'report_bug', 'feature_request', 'other'
    subject: str
    message: str

class TicketReply(BaseModel):
    message: str

class TicketUpdate(BaseModel):
    status: Optional[str] = None       # 'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'
    priority: Optional[str] = None     # 'low', 'medium', 'high', 'urgent'
    assigned_to: Optional[str] = None  # admin user id

VALID_CATEGORIES = {'account', 'billing', 'technical', 'report_bug', 'feature_request', 'other'}
VALID_STATUSES = {'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'}
VALID_PRIORITIES = {'low', 'medium', 'high', 'urgent'}

# ==================== USER ENDPOINTS ====================

@router.post("/support/tickets")
@limiter.limit("10/minute")
async def create_ticket(request: Request, ticket: TicketCreate, current_user=Depends(get_current_user)):
    """Create a new support ticket."""
    if ticket.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}")
    if not ticket.subject.strip() or not ticket.message.strip():
        raise HTTPException(status_code=400, detail="Subject and message are required")
    if len(ticket.subject) > 200:
        raise HTTPException(status_code=400, detail="Subject must be 200 characters or less")
    if len(ticket.message) > 5000:
        raise HTTPException(status_code=400, detail="Message must be 5000 characters or less")

    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ticket_doc = {
        "id": ticket_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_email": current_user.get("email", ""),
        "user_role": current_user.get("role", ""),
        "category": ticket.category,
        "subject": ticket.subject.strip(),
        "status": "open",
        "priority": "medium",
        "assigned_to": None,
        "assigned_name": None,
        "messages": [{
            "id": str(uuid.uuid4()),
            "sender_type": "user",
            "sender_id": current_user["id"],
            "sender_name": current_user.get("name", "Unknown"),
            "message": ticket.message.strip(),
            "created_at": now,
        }],
        "created_at": now,
        "updated_at": now,
    }
    await db.support_tickets.insert_one(ticket_doc)

    return {"ticket": {k: v for k, v in ticket_doc.items() if k != "_id"}}


@router.get("/support/tickets")
async def list_my_tickets(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    """List current user's support tickets."""
    query = {"user_id": current_user["id"]}
    if status and status in VALID_STATUSES:
        query["status"] = status

    total = await db.support_tickets.count_documents(query)
    skip = (page - 1) * limit
    tickets = await db.support_tickets.find(
        query, {"_id": 0, "messages": {"$slice": -1}}
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/support/tickets/{ticket_id}")
async def get_my_ticket(ticket_id: str, current_user=Depends(get_current_user)):
    """Get a specific ticket with full message history (user must own it)."""
    ticket = await db.support_tickets.find_one(
        {"id": ticket_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"ticket": ticket}


@router.post("/support/tickets/{ticket_id}/reply")
@limiter.limit("10/minute")
async def reply_to_ticket(request: Request, ticket_id: str, reply: TicketReply, current_user=Depends(get_current_user)):
    """User replies to their own ticket."""
    if not reply.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    if len(reply.message) > 5000:
        raise HTTPException(status_code=400, detail="Message must be 5000 characters or less")

    ticket = await db.support_tickets.find_one(
        {"id": ticket_id, "user_id": current_user["id"]}, {"_id": 0, "status": 1}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["status"] == "closed":
        raise HTTPException(status_code=400, detail="Cannot reply to a closed ticket")

    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "id": str(uuid.uuid4()),
        "sender_type": "user",
        "sender_id": current_user["id"],
        "sender_name": current_user.get("name", "Unknown"),
        "message": reply.message.strip(),
        "created_at": now,
    }

    await db.support_tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"messages": message_doc},
            "$set": {"updated_at": now, "status": "open"},
        },
    )

    return {"message": message_doc}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/support/tickets")
async def admin_list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    admin=Depends(get_current_admin),
):
    """List all support tickets with filters."""
    query = {}
    if status and status in VALID_STATUSES:
        query["status"] = status
    if priority and priority in VALID_PRIORITIES:
        query["priority"] = priority
    if category and category in VALID_CATEGORIES:
        query["category"] = category
    if assigned_to:
        query["assigned_to"] = assigned_to if assigned_to != "unassigned" else None
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"subject": {"$regex": safe_search, "$options": "i"}},
            {"user_name": {"$regex": safe_search, "$options": "i"}},
            {"user_email": {"$regex": safe_search, "$options": "i"}},
        ]

    total = await db.support_tickets.count_documents(query)
    skip = (page - 1) * limit
    tickets = await db.support_tickets.find(
        query, {"_id": 0, "messages": {"$slice": -1}}
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/admin/support/tickets/{ticket_id}")
async def admin_get_ticket(ticket_id: str, admin=Depends(get_current_admin)):
    """Get full ticket detail with all messages."""
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"ticket": ticket}


@router.post("/admin/support/tickets/{ticket_id}/reply")
async def admin_reply_to_ticket(ticket_id: str, reply: TicketReply, admin=Depends(get_current_admin)):
    """Admin/support agent replies to a ticket."""
    if not reply.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0, "user_id": 1, "subject": 1, "status": 1})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "id": str(uuid.uuid4()),
        "sender_type": "admin",
        "sender_id": admin["id"],
        "sender_name": admin.get("name", "Support"),
        "message": reply.message.strip(),
        "created_at": now,
    }

    new_status = "in_progress" if ticket["status"] == "open" else ticket["status"]
    if ticket["status"] == "waiting_on_user":
        new_status = "in_progress"

    await db.support_tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"messages": message_doc},
            "$set": {
                "updated_at": now,
                "status": new_status,
                "assigned_to": admin["id"] if not ticket.get("assigned_to") else ticket.get("assigned_to"),
                "assigned_name": admin.get("name") if not ticket.get("assigned_to") else ticket.get("assigned_name"),
            },
        },
    )

    # Notify the user
    await create_notification(
        user_id=ticket["user_id"],
        notif_type="support_reply",
        title="Support Reply",
        message=f"New reply on your ticket: {ticket['subject'][:50]}",
        data={"ticket_id": ticket_id},
    )

    return {"message": message_doc}


@router.put("/admin/support/tickets/{ticket_id}")
async def admin_update_ticket(ticket_id: str, update: TicketUpdate, admin=Depends(get_current_admin)):
    """Update ticket status, priority, or assignment."""
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0, "user_id": 1, "subject": 1})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    changes = {}
    if update.status:
        if update.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")
        changes["status"] = update.status
    if update.priority:
        if update.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {', '.join(VALID_PRIORITIES)}")
        changes["priority"] = update.priority
    if update.assigned_to is not None:
        if update.assigned_to == "":
            changes["assigned_to"] = None
            changes["assigned_name"] = None
        else:
            assignee = await db.admin_users.find_one({"id": update.assigned_to}, {"_id": 0, "name": 1})
            if not assignee:
                raise HTTPException(status_code=400, detail="Assignee not found")
            changes["assigned_to"] = update.assigned_to
            changes["assigned_name"] = assignee.get("name", "Unknown")

    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")

    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.support_tickets.update_one({"id": ticket_id}, {"$set": changes})

    # Add automated message and notify user on resolve/close
    if update.status and update.status in ("resolved", "closed"):
        status_label = "resolved" if update.status == "resolved" else "closed"
        system_message = {
            "id": str(uuid.uuid4()),
            "sender_type": "system",
            "sender_id": admin["id"],
            "sender_name": "System",
            "message": f"This ticket has been marked as {status_label}. If you need further help, you can reply to reopen it.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.support_tickets.update_one(
            {"id": ticket_id},
            {"$push": {"messages": system_message}},
        )
        await create_notification(
            user_id=ticket["user_id"],
            notif_type="support_update",
            title="Ticket Updated",
            message=f"Your ticket '{ticket['subject'][:50]}' has been {status_label}",
            data={"ticket_id": ticket_id},
        )

    return {"success": True, "changes": changes}


@router.get("/admin/support/stats")
async def admin_support_stats(admin=Depends(get_current_admin)):
    """Get support ticket statistics."""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = {}
    async for doc in db.support_tickets.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]

    priority_pipeline = [
        {"$match": {"status": {"$nin": ["resolved", "closed"]}}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]
    priority_counts = {}
    async for doc in db.support_tickets.aggregate(priority_pipeline):
        priority_counts[doc["_id"]] = doc["count"]

    total = sum(status_counts.values())
    open_count = status_counts.get("open", 0) + status_counts.get("in_progress", 0) + status_counts.get("waiting_on_user", 0)

    return {
        "total": total,
        "open": open_count,
        "resolved": status_counts.get("resolved", 0),
        "closed": status_counts.get("closed", 0),
        "by_status": status_counts,
        "by_priority": priority_counts,
    }
