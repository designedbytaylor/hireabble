"""
User management routes for Hireabble API (blocking, verification, referrals, etc.)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
import secrets
import string

from database import db, get_current_user, create_notification, send_web_push, logger

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


# ==================== PROFILE VERIFICATION ====================

@router.post("/users/verification/request")
async def request_verification(current_user: dict = Depends(get_current_user)):
    """Request profile verification. Submitted for admin review."""
    uid = current_user["id"]
    user = await db.users.find_one({"id": uid}, {"_id": 0, "verified": 1, "verification_status": 1})

    if (user or {}).get("verified"):
        raise HTTPException(status_code=400, detail="Your profile is already verified")

    status = (user or {}).get("verification_status")
    if status == "pending":
        raise HTTPException(status_code=400, detail="You already have a pending verification request")

    now = datetime.now(timezone.utc).isoformat()
    request_doc = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "user_name": current_user.get("name", ""),
        "user_email": current_user.get("email", ""),
        "user_role": current_user.get("role", ""),
        "user_photo": current_user.get("photo_url", ""),
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    await db.verification_requests.insert_one(request_doc)
    await db.users.update_one({"id": uid}, {"$set": {"verification_status": "pending"}})

    return {"message": "Verification request submitted! An admin will review your profile."}


@router.get("/users/verification/status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    """Check the current user's verification status."""
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "verified": 1, "verification_status": 1},
    )
    return {
        "verified": (user or {}).get("verified", False),
        "status": (user or {}).get("verification_status"),  # pending, approved, rejected, or None
    }


# ==================== REFERRAL SYSTEM ====================

def _generate_referral_code():
    """Generate a short, unique referral code like 'AB3K7X'."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(6))


@router.get("/users/referral")
async def get_referral_info(current_user: dict = Depends(get_current_user)):
    """Get the current user's referral code and stats."""
    uid = current_user["id"]
    user = await db.users.find_one({"id": uid}, {"_id": 0, "referral_code": 1})
    code = (user or {}).get("referral_code")

    # Generate code on first access
    if not code:
        code = _generate_referral_code()
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": code}):
            code = _generate_referral_code()
        await db.users.update_one({"id": uid}, {"$set": {"referral_code": code}})

    # Count successful referrals
    referral_count = await db.referrals.count_documents({"referrer_id": uid, "status": "completed"})
    total_swipes_earned = referral_count * 5

    return {
        "referral_code": code,
        "referral_count": referral_count,
        "total_swipes_earned": total_swipes_earned,
    }


@router.post("/users/referral/redeem")
async def redeem_referral_code(current_user: dict = Depends(get_current_user)):
    """Called internally after signup when a user registered with a referral code.
    The referral code is stored on the user during registration; this endpoint
    processes the reward for the referrer."""
    uid = current_user["id"]
    user = await db.users.find_one({"id": uid}, {"_id": 0, "referred_by_code": 1, "referral_redeemed": 1})

    if not user or not user.get("referred_by_code"):
        raise HTTPException(status_code=400, detail="No referral code to redeem")
    if user.get("referral_redeemed"):
        raise HTTPException(status_code=400, detail="Referral already redeemed")

    code = user["referred_by_code"]
    referrer = await db.users.find_one({"referral_code": code}, {"_id": 0, "id": 1, "name": 1})
    if not referrer:
        raise HTTPException(status_code=400, detail="Invalid referral code")
    if referrer["id"] == uid:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")

    now = datetime.now(timezone.utc).isoformat()

    # Record the referral
    await db.referrals.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_id": referrer["id"],
        "referred_id": uid,
        "code": code,
        "status": "completed",
        "created_at": now,
    })

    # Award 5 super swipes to referrer
    role = (await db.users.find_one({"id": referrer["id"]}, {"role": 1}) or {}).get("role", "seeker")
    swipe_field = "seeker_purchased_superlikes" if role == "seeker" else "recruiter_purchased_superlikes"
    await db.users.update_one(
        {"id": referrer["id"]},
        {"$inc": {swipe_field: 5}},
    )

    # Mark as redeemed
    await db.users.update_one({"id": uid}, {"$set": {"referral_redeemed": True}})

    # Notify the referrer
    referred_name = current_user.get("name", "Someone")
    await create_notification(
        referrer["id"], "referral",
        "Referral Reward!",
        f"{referred_name} joined using your referral code! You earned 5 Super Swipes.",
    )
    await send_web_push(
        referrer["id"],
        "Referral Reward!",
        f"{referred_name} joined using your code! +5 Super Swipes",
        {"type": "referral"},
    )

    # Invalidate referrer's cache
    from cache import invalidate_user
    invalidate_user(referrer["id"])

    return {"message": "Referral redeemed! Referrer awarded 5 Super Swipes."}
