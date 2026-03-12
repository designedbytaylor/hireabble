"""
User management routes for Hireabble API (blocking, etc.)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from database import db, get_current_user, logger

router = APIRouter(tags=["Users"])


async def get_all_blocked_ids(user_id: str) -> list:
    """Get all user IDs that should be excluded due to blocking (bidirectional).
    Returns IDs that the user has blocked + IDs of users who blocked the user."""
    user_doc = await db.users.find_one({"id": user_id}, {"blocked_users": 1})
    blocked_by_me = (user_doc or {}).get("blocked_users", [])

    blocked_me_docs = await db.users.find(
        {"blocked_users": user_id}, {"id": 1}
    ).to_list(500)
    blocked_me = [u["id"] for u in blocked_me_docs]

    return list(set(blocked_by_me + blocked_me))


@router.post("/users/block/{blocked_user_id}")
async def block_user(blocked_user_id: str, current_user: dict = Depends(get_current_user)):
    """Block a user — hides them from matches, messages, and discovery"""
    if blocked_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Verify blocked user exists
    blocked_user = await db.users.find_one({"id": blocked_user_id}, {"id": 1})
    if not blocked_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Add to blocked list (no-op if already blocked)
    result = await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"blocked_users": blocked_user_id}}
    )

    logger.info(f"User {current_user['id']} blocked {blocked_user_id}")
    return {"status": "blocked", "blocked_user_id": blocked_user_id}


@router.delete("/users/block/{blocked_user_id}")
async def unblock_user(blocked_user_id: str, current_user: dict = Depends(get_current_user)):
    """Unblock a previously blocked user"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"blocked_users": blocked_user_id}}
    )

    logger.info(f"User {current_user['id']} unblocked {blocked_user_id}")
    return {"status": "unblocked", "blocked_user_id": blocked_user_id}


@router.get("/users/blocked")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """List users that the current user has blocked"""
    user_doc = await db.users.find_one(
        {"id": current_user["id"]}, {"blocked_users": 1}
    )
    blocked_ids = (user_doc or {}).get("blocked_users", [])

    if not blocked_ids:
        return []

    blocked_users = await db.users.find(
        {"id": {"$in": blocked_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "photo_url": 1, "role": 1}
    ).to_list(len(blocked_ids))

    return blocked_users
