"""
Payments, Boosts, and Monetization routes for Hireabble API
Supports:
  - Apple In-App Purchase (StoreKit 2) for iOS App Store
  - Stripe as web fallback
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import os
import json

from database import db, get_current_user, create_notification, logger
from cache import invalidate_user

router = APIRouter(prefix="/payments", tags=["Payments & Boosts"])

# ==================== CONFIG ====================

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Apple IAP Config
APPLE_SHARED_SECRET = os.getenv("APPLE_SHARED_SECRET", "")  # From App Store Connect
APPLE_BUNDLE_ID = os.getenv("APPLE_BUNDLE_ID", "com.hireabble.app")
# Set to True for production, False for sandbox testing
APPLE_PRODUCTION = os.getenv("APPLE_ENVIRONMENT", "sandbox") == "production"
APPLE_VERIFY_URL_PRODUCTION = "https://buy.itunes.apple.com/verifyReceipt"
APPLE_VERIFY_URL_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt"

# Try to import stripe - graceful fallback if not installed
try:
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    STRIPE_AVAILABLE = bool(STRIPE_SECRET_KEY)
except ImportError:
    STRIPE_AVAILABLE = False

# ==================== PRODUCT DEFINITIONS ====================
# These product IDs must match exactly what you configure in App Store Connect

PRODUCTS = {
    # Recruiter Boosts (Consumable IAP)
    "boost_1day": {"name": "Job Boost - 1 Day", "price": 499, "days": 1,
                   "apple_product_id": "com.hireabble.boost.1day"},
    "boost_3day": {"name": "Job Boost - 3 Days", "price": 1199, "days": 3,
                   "apple_product_id": "com.hireabble.boost.3day"},
    "boost_7day": {"name": "Job Boost - 7 Days", "price": 1999, "days": 7,
                   "apple_product_id": "com.hireabble.boost.7day"},
    # Recruiter Super Swipes (Consumable IAP)
    "super_swipes_5": {"name": "5 Recruiter Super Swipes", "price": 999, "count": 5,
                       "apple_product_id": "com.hireabble.recruiter.superswipes.5"},
    "super_swipes_15": {"name": "15 Recruiter Super Swipes", "price": 1999, "count": 15,
                        "apple_product_id": "com.hireabble.recruiter.superswipes.15"},
    "super_swipes_30": {"name": "30 Recruiter Super Swipes", "price": 2999, "count": 30,
                        "apple_product_id": "com.hireabble.recruiter.superswipes.30"},
    # Seeker Super Likes (Consumable IAP)
    "seeker_superlikes_5": {"name": "5 Super Likes", "price": 499, "count": 5,
                            "apple_product_id": "com.hireabble.seeker.superlikes.5"},
    "seeker_superlikes_15": {"name": "15 Super Likes", "price": 999, "count": 15,
                             "apple_product_id": "com.hireabble.seeker.superlikes.15"},
    "seeker_superlikes_30": {"name": "30 Super Likes", "price": 1499, "count": 30,
                             "apple_product_id": "com.hireabble.seeker.superlikes.30"},
}

# ==================== SUBSCRIPTION TIER DEFINITIONS ====================

SUBSCRIPTION_TIERS = {
    # Seeker tiers
    "seeker_plus": {
        "name": "Plus",
        "role": "seeker",
        "tier_level": 1,
        "prices": {
            "weekly": 499,    # $4.99/week
            "monthly": 1499,  # $14.99/month
            "6month": 5999,   # $9.99/month billed as $59.99
        },
        "apple_product_ids": {
            "weekly": "com.hireabble.seeker.plus.weekly",
            "monthly": "com.hireabble.seeker.plus.monthly",
            "6month": "com.hireabble.seeker.plus.6month",
        },
        "features": [
            "10 Super Likes per day (vs 3)",
            "See who viewed your profile",
            "Undo last swipe",
            "Priority application badge",
            "Advanced job filters",
            "1 weekly profile boost",
        ],
        "limits": {"daily_super_likes": 10, "can_see_viewers": True, "can_undo": True,
                   "advanced_filters": True, "weekly_boosts": 1},
    },
    "seeker_premium": {
        "name": "Premium",
        "role": "seeker",
        "tier_level": 2,
        "prices": {
            "weekly": 999,    # $9.99/week
            "monthly": 2999,  # $29.99/month
            "6month": 11999,  # $19.99/month billed as $119.99
        },
        "apple_product_ids": {
            "weekly": "com.hireabble.seeker.premium.weekly",
            "monthly": "com.hireabble.seeker.premium.monthly",
            "6month": "com.hireabble.seeker.premium.6month",
        },
        "features": [
            "Unlimited Super Likes",
            "Everything in Plus",
            "Attach a note to Super Likes",
            "Featured profile in search results",
            "Application read receipts",
            "Application insights (see how you rank)",
            "Incognito mode",
            "3 daily Top Picks",
        ],
        "limits": {"daily_super_likes": -1, "can_see_viewers": True, "can_undo": True,
                   "advanced_filters": True, "weekly_boosts": 1,
                   "superlike_notes": True, "featured_profile": True, "read_receipts": True,
                   "application_insights": True, "incognito_mode": True, "daily_top_picks": 3},
    },
    # Recruiter tiers
    "recruiter_pro": {
        "name": "Pro",
        "role": "recruiter",
        "tier_level": 1,
        "prices": {
            "weekly": 999,    # $9.99/week
            "monthly": 2999,  # $29.99/month
            "6month": 11999,  # $19.99/month billed as $119.99
        },
        "apple_product_ids": {
            "weekly": "com.hireabble.recruiter.pro.weekly",
            "monthly": "com.hireabble.recruiter.pro.monthly",
            "6month": "com.hireabble.recruiter.pro.6month",
        },
        "features": [
            "10 Super Swipes per day (vs 3)",
            "See full applicant list (unblurred)",
            "1 free Boost per month",
            "Priority in candidate feeds",
            "Advanced candidate filters",
        ],
        "limits": {"daily_super_swipes": 10, "can_see_all_applicants": True, "free_monthly_boost": 1,
                   "priority_listing": True, "advanced_filters": True},
    },
    "recruiter_enterprise": {
        "name": "Enterprise",
        "role": "recruiter",
        "tier_level": 2,
        "prices": {
            "weekly": 1999,   # $19.99/week
            "monthly": 5999,  # $59.99/month
            "6month": 23999,  # $39.99/month billed as $239.99
        },
        "apple_product_ids": {
            "weekly": "com.hireabble.recruiter.enterprise.weekly",
            "monthly": "com.hireabble.recruiter.enterprise.monthly",
            "6month": "com.hireabble.recruiter.enterprise.6month",
        },
        "features": [
            "Unlimited Super Swipes",
            "See full applicant list (unblurred)",
            "3 free Boosts per month",
            "Priority in candidate feeds",
            "Advanced candidate filters",
            "Message candidates before matching",
            "Featured job listings",
            "Analytics dashboard",
            "Dedicated support",
        ],
        "limits": {"daily_super_swipes": -1, "can_see_all_applicants": True, "free_monthly_boost": 3,
                   "priority_listing": True, "advanced_filters": True,
                   "can_message_before_match": True, "featured_listings": True},
    },
}

# Reverse lookup: Apple product ID -> our product ID
APPLE_TO_PRODUCT = {v["apple_product_id"]: k for k, v in PRODUCTS.items() if "apple_product_id" in v}


# ==================== MODELS ====================

class BoostCreate(BaseModel):
    job_id: str
    product_id: str  # boost_1day, boost_3day, boost_7day

class CreateCheckoutSession(BaseModel):
    product_id: str
    job_id: Optional[str] = None  # Required for boosts

class SubscriptionCheckout(BaseModel):
    tier_id: str       # seeker_plus, seeker_premium, recruiter_pro, recruiter_enterprise
    duration: str      # weekly, monthly, 6month

class AppleReceiptValidation(BaseModel):
    receipt_data: str  # Base64-encoded receipt from StoreKit
    product_id: str    # Our product ID (e.g., "boost_1day")
    job_id: Optional[str] = None  # For boosts
    transaction_id: Optional[str] = None  # StoreKit transaction ID


# ==================== PRODUCTS & PRICING ====================

@router.get("/products")
async def get_products(current_user: dict = Depends(get_current_user)):
    """Get available products and pricing, including Apple IAP product IDs"""
    role = current_user.get("role", "seeker")
    result = {}

    if role == "recruiter":
        result["boosts"] = [
            {"id": k, **{kk: vv for kk, vv in v.items()}} for k, v in PRODUCTS.items() if k.startswith("boost_")
        ]
        result["super_swipes"] = [
            {"id": k, **{kk: vv for kk, vv in v.items()}} for k, v in PRODUCTS.items() if k.startswith("super_swipes_")
        ]
    else:
        result["super_likes"] = [
            {"id": k, **{kk: vv for kk, vv in v.items()}} for k, v in PRODUCTS.items() if k.startswith("seeker_superlikes_")
        ]

    return result


# ==================== SUBSCRIPTION TIERS ====================

@router.get("/tiers")
async def get_subscription_tiers(current_user: dict = Depends(get_current_user)):
    """Get available subscription tiers for the user's role"""
    role = current_user.get("role", "seeker")
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "subscription": 1})
    current_sub = (user or {}).get("subscription", {})

    tiers = []
    for tier_id, tier in SUBSCRIPTION_TIERS.items():
        if tier["role"] == role:
            tiers.append({
                "id": tier_id,
                "name": tier["name"],
                "tier_level": tier["tier_level"],
                "prices": tier["prices"],
                "features": tier["features"],
                "apple_product_ids": tier.get("apple_product_ids", {}),
            })

    return {
        "tiers": sorted(tiers, key=lambda t: t["tier_level"]),
        "current_tier": current_sub.get("tier_id"),
        "current_period_end": current_sub.get("period_end"),
    }


@router.get("/subscription")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status and tier limits"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "subscription": 1})
    sub = (user or {}).get("subscription", {})

    tier_id = sub.get("tier_id")
    tier = SUBSCRIPTION_TIERS.get(tier_id)

    if tier and sub.get("status") == "active":
        period_end = sub.get("period_end", "")
        if period_end and period_end < datetime.now(timezone.utc).isoformat():
            # Subscription expired
            return {"subscribed": False, "tier": None, "tier_name": "Free", "limits": {}}

        return {
            "subscribed": True,
            "tier": tier_id,
            "tier_name": tier["name"],
            "tier_level": tier["tier_level"],
            "limits": tier["limits"],
            "period_end": period_end,
        }

    return {"subscribed": False, "tier": None, "tier_name": "Free", "limits": {}}


@router.post("/subscribe")
async def subscribe(data: SubscriptionCheckout, current_user: dict = Depends(get_current_user)):
    """Subscribe to a tier (creates Stripe checkout or processes Apple IAP)"""
    tier = SUBSCRIPTION_TIERS.get(data.tier_id)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier")

    if tier["role"] != current_user.get("role"):
        raise HTTPException(status_code=403, detail="This tier is not available for your role")

    price = tier["prices"].get(data.duration)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid duration")

    duration_days = {"weekly": 7, "monthly": 30, "6month": 180}[data.duration]
    period_end = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()

    # For now, activate immediately (in production, this would go through Stripe/Apple payment first)
    subscription = {
        "tier_id": data.tier_id,
        "tier_name": tier["name"],
        "duration": data.duration,
        "status": "active",
        "price_paid": price,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "period_end": period_end,
    }

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"subscription": subscription}}
    )

    # Invalidate all caches so dashboard/stats reflect new subscription limits
    invalidate_user(current_user["id"])

    # Record transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "product_id": data.tier_id,
        "amount": price,
        "source": "direct",
        "status": "completed",
        "description": f"{tier['name']} - {data.duration}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await create_notification(
        user_id=current_user["id"],
        notif_type="payment",
        title=f"Welcome to {tier['name']}!",
        message=f"Your {tier['name']} subscription is now active. Enjoy your premium features!",
        data={"tier_id": data.tier_id}
    )

    return {"status": "active", "subscription": subscription}


# ==================== APPLE IN-APP PURCHASE ====================

@router.post("/apple/verify-receipt")
async def verify_apple_receipt(
    data: AppleReceiptValidation,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify an Apple IAP receipt and fulfill the purchase.

    The iOS app sends the receipt after a successful StoreKit purchase.
    We validate it with Apple's servers, then grant the product.

    Flow:
    1. iOS app calls StoreKit to purchase product
    2. StoreKit returns receipt
    3. iOS app sends receipt to this endpoint
    4. We verify with Apple's servers
    5. If valid, we fulfill the purchase (activate boost, add super swipes, etc.)
    """
    import requests

    # Check for duplicate transaction
    if data.transaction_id:
        existing = await db.transactions.find_one({"apple_transaction_id": data.transaction_id})
        if existing:
            return {"status": "already_fulfilled", "message": "This purchase has already been processed"}

    # Verify with Apple
    verify_url = APPLE_VERIFY_URL_PRODUCTION if APPLE_PRODUCTION else APPLE_VERIFY_URL_SANDBOX
    verify_payload = {
        "receipt-data": data.receipt_data,
        "password": APPLE_SHARED_SECRET,
        "exclude-old-transactions": True,
    }

    try:
        response = requests.post(verify_url, json=verify_payload, timeout=30)
        result = response.json()
    except Exception as e:
        logger.error(f"Apple receipt verification failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to verify receipt with Apple")

    status = result.get("status")

    # Status 21007 means sandbox receipt sent to production - retry with sandbox
    if status == 21007:
        try:
            response = requests.post(APPLE_VERIFY_URL_SANDBOX, json=verify_payload, timeout=30)
            result = response.json()
            status = result.get("status")
        except Exception as e:
            logger.error(f"Apple sandbox verification failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to verify receipt with Apple")

    if status != 0:
        logger.warning(f"Apple receipt invalid, status: {status}")
        raise HTTPException(status_code=400, detail=f"Invalid receipt (Apple status: {status})")

    # Find the matching in_app purchase in the receipt
    in_app = result.get("receipt", {}).get("in_app", [])
    latest_receipt_info = result.get("latest_receipt_info", in_app)

    # Look for our product in the receipt
    product = PRODUCTS.get(data.product_id)
    if not product:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    apple_pid = product.get("apple_product_id")
    found_transaction = None
    for txn in latest_receipt_info:
        if txn.get("product_id") == apple_pid:
            found_transaction = txn
            break

    if not found_transaction and data.transaction_id:
        # Accept if the transaction_id matches even if product_id didn't
        for txn in latest_receipt_info:
            if txn.get("transaction_id") == data.transaction_id:
                found_transaction = txn
                break

    if not found_transaction:
        raise HTTPException(status_code=400, detail="Product not found in receipt")

    apple_txn_id = found_transaction.get("transaction_id", data.transaction_id or str(uuid.uuid4()))

    # Check duplicate again with Apple's transaction ID
    existing = await db.transactions.find_one({"apple_transaction_id": apple_txn_id})
    if existing:
        return {"status": "already_fulfilled", "message": "This purchase has already been processed"}

    # Fulfill the purchase
    metadata = {
        "user_id": current_user["id"],
        "product_id": data.product_id,
        "job_id": data.job_id or "",
    }
    await fulfill_purchase(metadata, source="apple_iap", apple_transaction_id=apple_txn_id)

    return {
        "status": "success",
        "message": f"Purchase fulfilled: {product['name']}",
        "product_id": data.product_id,
    }


@router.post("/apple/app-store-notification")
async def apple_server_notification(request: Request):
    """
    Handle Apple App Store Server Notifications (v2).
    Apple sends these when subscriptions renew, refunds happen, etc.

    Configure this URL in App Store Connect:
    Settings > App Information > App Store Server Notifications URL
    Set to: https://your-api-domain.com/api/payments/apple/app-store-notification
    """
    try:
        body = await request.json()
        # In production, verify the JWS signed notification
        # For now, log it
        notification_type = body.get("notificationType", "")
        logger.info(f"Apple notification: {notification_type}")

        if notification_type == "REFUND":
            # Handle refund - revoke the purchase
            data = body.get("data", {})
            transaction_id = data.get("transactionId")
            if transaction_id:
                await db.transactions.update_one(
                    {"apple_transaction_id": transaction_id},
                    {"$set": {"status": "refunded"}}
                )
    except Exception as e:
        logger.error(f"Apple notification error: {e}")

    return {"status": "ok"}


# ==================== STRIPE CHECKOUT (Web Fallback) ====================

@router.post("/create-checkout-session")
async def create_checkout_session(
    data: CreateCheckoutSession,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe Checkout session (web only - iOS must use Apple IAP)"""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payment processing is not configured. Set STRIPE_SECRET_KEY.")

    product = PRODUCTS.get(data.product_id)
    if not product:
        raise HTTPException(status_code=400, detail="Invalid product")

    # Validate role/ownership
    if data.product_id.startswith("boost_"):
        if current_user.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Only recruiters can boost jobs")
        if not data.job_id:
            raise HTTPException(status_code=400, detail="job_id is required for boosts")
        job = await db.jobs.find_one({"id": data.job_id, "recruiter_id": current_user["id"]})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

    if data.product_id.startswith("super_swipes_"):
        if current_user.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Only recruiters can purchase super swipes")

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    success_path = "/recruiter" if current_user.get("role") == "recruiter" else "/dashboard"

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": product["name"]},
                    "unit_amount": product["price"],
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{frontend_url}{success_path}?payment=success&product={data.product_id}",
            cancel_url=f"{frontend_url}{success_path}?payment=cancelled",
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


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
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
        await fulfill_purchase(metadata, source="stripe")

    return {"status": "ok"}


# ==================== FULFILLMENT ====================

async def fulfill_purchase(metadata: dict, source: str = "unknown", apple_transaction_id: str = None):
    """Fulfill a purchase after successful payment (works for both Stripe and Apple IAP)"""
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
        "source": source,  # "apple_iap" or "stripe"
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if apple_transaction_id:
        transaction["apple_transaction_id"] = apple_transaction_id

    await db.transactions.insert_one(transaction)

    if product_id.startswith("boost_"):
        await activate_boost(user_id, job_id, product)
    elif product_id.startswith("super_swipes_"):
        await add_super_swipes(user_id, product, role="recruiter")
    elif product_id.startswith("seeker_superlikes_"):
        await add_super_swipes(user_id, product, role="seeker")


# ==================== BOOSTS ====================

async def activate_boost(user_id: str, job_id: str, product: dict):
    """Activate a job boost"""
    boost_end = datetime.now(timezone.utc) + timedelta(days=product["days"])

    boost_doc = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "user_id": user_id,
        "boost_until": boost_end.isoformat(),
        "multiplier": 3,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.boosts.insert_one(boost_doc)

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
    """Activate a boost (for testing or when payment is handled externally)"""
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


# ==================== SUPER SWIPES / SUPER LIKES ====================

@router.get("/super-swipes/balance")
async def get_super_swipe_balance(current_user: dict = Depends(get_current_user)):
    """Get user's remaining purchased super swipes/likes"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_super_swipes": 1, "seeker_purchased_superlikes": 1})

    if current_user.get("role") == "recruiter":
        balance = (user or {}).get("recruiter_super_swipes", 3)
    else:
        balance = (user or {}).get("seeker_purchased_superlikes", 0)

    return {"balance": balance, "role": current_user.get("role")}


async def add_super_swipes(user_id: str, product: dict, role: str = "recruiter"):
    """Add purchased super swipes/likes to user's balance"""
    count = product.get("count", 0)
    field = "recruiter_super_swipes" if role == "recruiter" else "seeker_purchased_superlikes"

    await db.users.update_one(
        {"id": user_id},
        {"$inc": {field: count}}
    )

    label = "Super Swipes" if role == "recruiter" else "Super Likes"
    await create_notification(
        user_id=user_id,
        notif_type="payment",
        title=f"{label} Added!",
        message=f"{count} {label} have been added to your account.",
        data={"count": count}
    )


@router.post("/super-swipes/use")
async def use_super_swipe(current_user: dict = Depends(get_current_user)):
    """Use a recruiter super swipe"""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can use super swipes")

    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "recruiter_super_swipes": 1})
    balance = (user or {}).get("recruiter_super_swipes", 3)

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
