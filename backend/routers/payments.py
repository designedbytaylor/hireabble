"""
Payments, Boosts, and Monetization routes for Hireabble API
Supports Stripe + Apple Pay for in-app purchases.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import os

from database import db, get_current_user, create_notification, logger

router = APIRouter(prefix="/payments", tags=["Payments & Boosts"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Try to import stripe - graceful fallback if not installed
try:
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    STRIPE_AVAILABLE = bool(STRIPE_SECRET_KEY)
except ImportError:
    STRIPE_AVAILABLE = False

# ==================== PRICING ====================

PRODUCTS = {
    "boost_1day": {"name": "Job Boost - 1 Day", "price": 500, "days": 1},       # $5.00
    "boost_3day": {"name": "Job Boost - 3 Days", "price": 1200, "days": 3},     # $12.00
    "boost_7day": {"name": "Job Boost - 7 Days", "price": 2000, "days": 7},     # $20.00
    "super_swipes_5": {"name": "5 Super Swipes", "price": 999, "count": 5},     # $9.99
    "super_swipes_15": {"name": "15 Super Swipes", "price": 1999, "count": 15}, # $19.99
    "super_swipes_30": {"name": "30 Super Swipes", "price": 2999, "count": 30}, # $29.99
}


# ==================== MODELS ====================

class BoostCreate(BaseModel):
    job_id: str
    product_id: str  # boost_1day, boost_3day, boost_7day

class SuperSwipePurchase(BaseModel):
    product_id: str  # super_swipes_5, super_swipes_15, super_swipes_30

class CreateCheckoutSession(BaseModel):
    product_id: str
    job_id: Optional[str] = None  # Required for boosts


# ==================== PRODUCTS & PRICING ====================

@router.get("/products")
async def get_products():
    """Get available products and pricing"""
    return {
        "boosts": [
            {"id": "boost_1day", **PRODUCTS["boost_1day"]},
            {"id": "boost_3day", **PRODUCTS["boost_3day"]},
            {"id": "boost_7day", **PRODUCTS["boost_7day"]},
        ],
        "super_swipes": [
            {"id": "super_swipes_5", **PRODUCTS["super_swipes_5"]},
            {"id": "super_swipes_15", **PRODUCTS["super_swipes_15"]},
            {"id": "super_swipes_30", **PRODUCTS["super_swipes_30"]},
        ]
    }


# ==================== STRIPE CHECKOUT ====================

@router.post("/create-checkout-session")
async def create_checkout_session(
    data: CreateCheckoutSession,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe Checkout session (supports Apple Pay, Google Pay, cards)"""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payment processing is not configured yet. Set STRIPE_SECRET_KEY to enable payments.")

    product = PRODUCTS.get(data.product_id)
    if not product:
        raise HTTPException(status_code=400, detail="Invalid product")

    # For boosts, verify job ownership
    if data.product_id.startswith("boost_"):
        if current_user.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Only recruiters can boost jobs")
        if not data.job_id:
            raise HTTPException(status_code=400, detail="job_id is required for boosts")
        job = await db.jobs.find_one({"id": data.job_id, "recruiter_id": current_user["id"]})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

    # For super swipes, verify recruiter
    if data.product_id.startswith("super_swipes_"):
        if current_user.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Only recruiters can purchase super swipes")

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],  # Apple Pay/Google Pay auto-enabled via card
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": product["name"]},
                    "unit_amount": product["price"],
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{frontend_url}/recruiter?payment=success&product={data.product_id}",
            cancel_url=f"{frontend_url}/recruiter?payment=cancelled",
            metadata={
                "user_id": current_user["id"],
                "product_id": data.product_id,
                "job_id": data.job_id or "",
            },
            payment_intent_data={
                "metadata": {
                    "user_id": current_user["id"],
                    "product_id": data.product_id,
                    "job_id": data.job_id or "",
                }
            }
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


# ==================== STRIPE WEBHOOK ====================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events to fulfill purchases"""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payments not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        await fulfill_purchase(metadata)

    return {"status": "ok"}


async def fulfill_purchase(metadata: dict):
    """Fulfill a purchase after successful payment"""
    user_id = metadata.get("user_id")
    product_id = metadata.get("product_id")
    job_id = metadata.get("job_id")

    if not user_id or not product_id:
        return

    product = PRODUCTS.get(product_id)
    if not product:
        return

    # Record the transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": product_id,
        "job_id": job_id or None,
        "amount": product["price"],
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(transaction)

    if product_id.startswith("boost_"):
        await activate_boost(user_id, job_id, product)
    elif product_id.startswith("super_swipes_"):
        await add_super_swipes(user_id, product)


# ==================== BOOSTS ====================

async def activate_boost(user_id: str, job_id: str, product: dict):
    """Activate a job boost"""
    boost_end = datetime.now(timezone.utc) + timedelta(days=product["days"])

    boost_doc = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "user_id": user_id,
        "boost_until": boost_end.isoformat(),
        "multiplier": 3,  # 3x more visibility
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.boosts.insert_one(boost_doc)

    # Mark the job as boosted
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"is_boosted": True, "boost_until": boost_end.isoformat()}}
    )

    await create_notification(
        user_id=user_id,
        notif_type="payment",
        title="Job Boosted!",
        message=f"Your job is now boosted for {product['days']} day(s). It will appear more often in candidate swipe stacks.",
        data={"job_id": job_id}
    )


@router.get("/boosts")
async def get_active_boosts(current_user: dict = Depends(get_current_user)):
    """Get active boosts for the current recruiter"""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view boosts")

    now = datetime.now(timezone.utc).isoformat()
    boosts = await db.boosts.find(
        {"user_id": current_user["id"], "boost_until": {"$gte": now}},
        {"_id": 0}
    ).to_list(50)
    return boosts


@router.post("/boosts/activate")
async def activate_boost_direct(
    data: BoostCreate,
    current_user: dict = Depends(get_current_user)
):
    """Activate a boost (for testing or when payment is handled externally).
    In production, boosts are activated via Stripe webhook after payment."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can boost jobs")

    job = await db.jobs.find_one({"id": data.job_id, "recruiter_id": current_user["id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    product = PRODUCTS.get(data.product_id)
    if not product or not data.product_id.startswith("boost_"):
        raise HTTPException(status_code=400, detail="Invalid boost product")

    await activate_boost(current_user["id"], data.job_id, product)
    return {"message": f"Job boosted for {product['days']} day(s)"}


# ==================== RECRUITER SUPER SWIPES ====================

@router.get("/super-swipes/balance")
async def get_super_swipe_balance(current_user: dict = Depends(get_current_user)):
    """Get recruiter's remaining purchased super swipes"""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")

    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_super_swipes": 1})
    balance = user.get("recruiter_super_swipes", 3)  # 3 free per month
    return {"balance": balance}


async def add_super_swipes(user_id: str, product: dict):
    """Add purchased super swipes to recruiter's balance"""
    count = product.get("count", 0)
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"recruiter_super_swipes": count}}
    )
    await create_notification(
        user_id=user_id,
        notif_type="payment",
        title="Super Swipes Added!",
        message=f"{count} Super Swipes have been added to your account.",
        data={"count": count}
    )


@router.post("/super-swipes/use")
async def use_super_swipe(
    current_user: dict = Depends(get_current_user)
):
    """Use a recruiter super swipe (marks an application with priority)"""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can use super swipes")

    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_super_swipes": 1})
    balance = user.get("recruiter_super_swipes", 3)

    if balance <= 0:
        raise HTTPException(status_code=400, detail="No super swipes remaining. Purchase more to continue.")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"recruiter_super_swipes": -1}}
    )

    return {"remaining": balance - 1}


# ==================== TRANSACTION HISTORY ====================

@router.get("/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    """Get purchase history"""
    transactions = await db.transactions.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return transactions
