"""
Payments, Boosts, and Monetization routes for Hireabble API
Supports:
  - Apple In-App Purchase (StoreKit 2) for iOS App Store
  - Stripe as web fallback
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import os
import json

from database import db, get_current_user, create_notification, logger
from cache import invalidate_user

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/payments", tags=["Payments & Boosts"])

# ==================== CONFIG ====================

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Apple IAP Config
APPLE_SHARED_SECRET = os.getenv("APPLE_SHARED_SECRET", "")  # From App Store Connect
APPLE_BUNDLE_ID = os.getenv("APPLE_BUNDLE_ID", "com.hireabble.app")

# Google Play Billing Config
GOOGLE_PLAY_PACKAGE_NAME = os.getenv("GOOGLE_PLAY_PACKAGE_NAME", "com.hireabble.app")
# Path to the Google Play service account JSON key file (for server-side verification)
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY = os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY", "")
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
                   "apple_product_id": "com.hireabble.boost.1day",
                   "google_product_id": "com.hireabble.boost.1day"},
    "boost_3day": {"name": "Job Boost - 3 Days", "price": 1199, "days": 3,
                   "apple_product_id": "com.hireabble.boost.3day",
                   "google_product_id": "com.hireabble.boost.3day"},
    "boost_7day": {"name": "Job Boost - 7 Days", "price": 1999, "days": 7,
                   "apple_product_id": "com.hireabble.boost.7day",
                   "google_product_id": "com.hireabble.boost.7day"},
    # Recruiter Super Swipes (Consumable IAP)
    "super_swipes_5": {"name": "5 Recruiter Super Swipes", "price": 999, "count": 5,
                       "apple_product_id": "com.hireabble.recruiter.superswipes.5",
                       "google_product_id": "com.hireabble.recruiter.superswipes.5"},
    "super_swipes_15": {"name": "15 Recruiter Super Swipes", "price": 1999, "count": 15,
                        "apple_product_id": "com.hireabble.recruiter.superswipes.15",
                        "google_product_id": "com.hireabble.recruiter.superswipes.15"},
    "super_swipes_30": {"name": "30 Recruiter Super Swipes", "price": 2999, "count": 30,
                        "apple_product_id": "com.hireabble.recruiter.superswipes.30",
                        "google_product_id": "com.hireabble.recruiter.superswipes.30"},
    # Seeker Super Likes (Consumable IAP)
    "seeker_superlikes_5": {"name": "5 Super Likes", "price": 499, "count": 5,
                            "apple_product_id": "com.hireabble.seeker.superlikes.5",
                            "google_product_id": "com.hireabble.seeker.superlikes.5"},
    "seeker_superlikes_15": {"name": "15 Super Likes", "price": 999, "count": 15,
                             "apple_product_id": "com.hireabble.seeker.superlikes.15",
                             "google_product_id": "com.hireabble.seeker.superlikes.15"},
    "seeker_superlikes_30": {"name": "30 Super Likes", "price": 1499, "count": 30,
                             "apple_product_id": "com.hireabble.seeker.superlikes.30",
                             "google_product_id": "com.hireabble.seeker.superlikes.30"},
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
        "google_product_ids": {
            "weekly": "com.hireabble.seeker.plus.weekly",
            "monthly": "com.hireabble.seeker.plus.monthly",
            "6month": "com.hireabble.seeker.plus.6month",
        },
        "features": [
            "10 Super Likes per day (vs 3)",
            "See who viewed your profile",
            "Unlimited undo swipes (free: 1/day)",
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
        "google_product_ids": {
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
            "3 daily Top Picks",
        ],
        "limits": {"daily_super_likes": -1, "can_see_viewers": True, "can_undo": True,
                   "advanced_filters": True, "weekly_boosts": 1,
                   "superlike_notes": True, "featured_profile": True, "read_receipts": True,
                   "application_insights": True, "daily_top_picks": 3},
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
        "google_product_ids": {
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
            "Analytics dashboard",
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
        "google_product_ids": {
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
        ],
        "limits": {"daily_super_swipes": -1, "can_see_all_applicants": True, "free_monthly_boost": 3,
                   "priority_listing": True, "advanced_filters": True,
                   "can_message_before_match": True, "featured_listings": True},
    },
}

# Reverse lookup: Apple/Google product ID -> our product ID
APPLE_TO_PRODUCT = {v["apple_product_id"]: k for k, v in PRODUCTS.items() if "apple_product_id" in v}
GOOGLE_TO_PRODUCT = {v["google_product_id"]: k for k, v in PRODUCTS.items() if "google_product_id" in v}


async def _get_pricing_overrides(country: str = ""):
    """Load admin-configured pricing overrides from the database.
    Falls back to default overrides if no country-specific ones exist."""
    if country and country != "CA":
        # Try country-specific first
        doc = await db.site_settings.find_one({"key": f"pricing_overrides_{country}"})
        if doc:
            return doc.get("value", {})
    # Fall back to default (CA / base)
    doc = await db.site_settings.find_one({"key": "pricing_overrides"})
    return doc.get("value", {}) if doc else {}


def _apply_tier_overrides(tier_id, tier_data, overrides):
    """Apply admin pricing overrides to a tier definition (returns a copy)."""
    tier_overrides = overrides.get("tiers", {}).get(tier_id)
    if not tier_overrides:
        return tier_data
    result = {**tier_data, "prices": {**tier_data["prices"]}}
    for duration in ("weekly", "monthly", "6month"):
        if duration in (tier_overrides.get("prices") or {}):
            result["prices"][duration] = tier_overrides["prices"][duration]
    return result


def _apply_product_overrides(product_id, product_data, overrides):
    """Apply admin pricing overrides to a product definition (returns a copy)."""
    prod_overrides = overrides.get("products", {}).get(product_id)
    if not prod_overrides:
        return product_data
    result = {**product_data}
    if "price" in prod_overrides:
        result["price"] = prod_overrides["price"]
    return result


# ==================== MODELS ====================

class BoostCreate(BaseModel):
    job_id: str
    product_id: str  # boost_1day, boost_3day, boost_7day

class CreateCheckoutSession(BaseModel):
    product_id: Optional[str] = None
    job_id: Optional[str] = None  # Required for boosts
    tier_id: Optional[str] = None  # For subscriptions
    duration: Optional[str] = None  # weekly, monthly, 6month

class SubscriptionCheckout(BaseModel):
    tier_id: str       # seeker_plus, seeker_premium, recruiter_pro, recruiter_enterprise
    duration: str      # weekly, monthly, 6month

class AppleReceiptValidation(BaseModel):
    receipt_data: str  # Base64-encoded receipt from StoreKit
    product_id: str    # Our product ID (e.g., "boost_1day")
    job_id: Optional[str] = None  # For boosts
    transaction_id: Optional[str] = None  # StoreKit transaction ID

class GooglePlayPurchaseValidation(BaseModel):
    purchase_token: str  # Token from Google Play BillingClient
    product_id: str      # Google Play product ID
    order_id: Optional[str] = None  # Google Play order ID
    tier_id: Optional[str] = None   # Our tier ID for subscriptions
    duration: Optional[str] = None  # weekly, monthly, 6month
    job_id: Optional[str] = None    # For boosts


# ==================== PRODUCTS & PRICING ====================

@router.get("/products")
async def get_products(country: str = "", current_user: dict = Depends(get_current_user)):
    """Get available products and pricing, including Apple IAP product IDs"""
    role = current_user.get("role", "seeker")
    overrides = await _get_pricing_overrides(country)
    result = {}

    if role == "recruiter":
        result["boosts"] = [
            {"id": k, **{kk: vv for kk, vv in _apply_product_overrides(k, v, overrides).items()}}
            for k, v in PRODUCTS.items() if k.startswith("boost_")
        ]
        result["super_swipes"] = [
            {"id": k, **{kk: vv for kk, vv in _apply_product_overrides(k, v, overrides).items()}}
            for k, v in PRODUCTS.items() if k.startswith("super_swipes_")
        ]
    else:
        result["super_likes"] = [
            {"id": k, **{kk: vv for kk, vv in _apply_product_overrides(k, v, overrides).items()}}
            for k, v in PRODUCTS.items() if k.startswith("seeker_superlikes_")
        ]

    return result


# ==================== SUBSCRIPTION TIERS ====================

@router.get("/tiers")
async def get_subscription_tiers(country: str = "", current_user: dict = Depends(get_current_user)):
    """Get available subscription tiers for the user's role"""
    role = current_user.get("role", "seeker")
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "subscription": 1})
    current_sub = (user or {}).get("subscription", {})
    overrides = await _get_pricing_overrides(country)

    tiers = []
    for tier_id, tier in SUBSCRIPTION_TIERS.items():
        if tier["role"] == role:
            effective = _apply_tier_overrides(tier_id, tier, overrides)
            tiers.append({
                "id": tier_id,
                "name": effective["name"],
                "tier_level": effective["tier_level"],
                "prices": effective["prices"],
                "features": effective["features"],
                "apple_product_ids": effective.get("apple_product_ids", {}),
            })

    return {
        "tiers": sorted(tiers, key=lambda t: t["tier_level"]),
        "current_tier": current_sub.get("tier_id"),
        "current_duration": current_sub.get("duration"),
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


@router.post("/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel the current subscription. Subscription remains active until period end."""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "subscription": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sub = user.get("subscription")
    if not sub or sub.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    # If it was a Stripe subscription, cancel via Stripe API
    stripe_sub_id = sub.get("stripe_subscription_id")
    if stripe_sub_id and STRIPE_AVAILABLE:
        try:
            stripe.Subscription.modify(
                stripe_sub_id,
                cancel_at_period_end=True
            )
        except Exception as e:
            logger.error(f"Stripe cancellation failed: {e}")
            # Continue anyway — mark as cancelled locally

    # Mark subscription as cancelled (still active until period_end)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "subscription.cancel_at_period_end": True,
            "subscription.cancelled_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    invalidate_user(current_user["id"])

    return {
        "message": "Subscription will be cancelled at the end of the current billing period",
        "active_until": sub.get("period_end"),
    }


@router.post("/subscription/reactivate")
async def reactivate_subscription(current_user: dict = Depends(get_current_user)):
    """Reactivate a cancelled subscription before it expires."""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "subscription": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sub = user.get("subscription")
    if not sub or sub.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active subscription found")

    if not sub.get("cancel_at_period_end"):
        raise HTTPException(status_code=400, detail="Subscription is not pending cancellation")

    # Check if still within period
    now = datetime.now(timezone.utc).isoformat()
    if sub.get("period_end", "") < now:
        raise HTTPException(status_code=400, detail="Subscription has already expired")

    # Reactivate on Stripe if applicable
    stripe_sub_id = sub.get("stripe_subscription_id")
    if stripe_sub_id and STRIPE_AVAILABLE:
        try:
            stripe.Subscription.modify(
                stripe_sub_id,
                cancel_at_period_end=False
            )
        except Exception as e:
            logger.error(f"Stripe reactivation failed: {e}")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "subscription.cancel_at_period_end": False,
        }, "$unset": {
            "subscription.cancelled_at": ""
        }}
    )
    invalidate_user(current_user["id"])

    return {"message": "Subscription reactivated successfully"}


@router.post("/subscribe")
async def subscribe(data: SubscriptionCheckout, current_user: dict = Depends(get_current_user)):
    """Subscribe to a tier — redirects to payment. Direct activation is disabled in production."""
    tier = SUBSCRIPTION_TIERS.get(data.tier_id)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier")

    if tier["role"] != current_user.get("role"):
        raise HTTPException(status_code=403, detail="This tier is not available for your role")

    price = tier["prices"].get(data.duration)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid duration")

    # Direct activation is only allowed in local development for testing.
    # Requires ENVIRONMENT to be explicitly set to "development".
    _env = os.getenv("ENVIRONMENT", "production")
    if _env != "development":
        raise HTTPException(
            status_code=400,
            detail="Please subscribe through the app (Apple/Google) or web checkout (Stripe)."
        )

    duration_days = {"weekly": 7, "monthly": 30, "6month": 180}[data.duration]
    period_end = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()

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

    invalidate_user(current_user["id"])

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
@limiter.limit("10/minute")
async def verify_apple_receipt(
    request: Request,
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

    # Validate bundle_id matches our app to prevent cross-app receipt reuse
    receipt_bundle_id = result.get("receipt", {}).get("bundle_id", "")
    if receipt_bundle_id and receipt_bundle_id != APPLE_BUNDLE_ID:
        logger.warning(f"Apple receipt bundle_id mismatch: {receipt_bundle_id} != {APPLE_BUNDLE_ID}")
        raise HTTPException(status_code=400, detail="Receipt is not from this application")

    # Validate environment matches (prevent sandbox receipts in production)
    receipt_env = result.get("environment", "")
    if APPLE_PRODUCTION and receipt_env == "Sandbox":
        logger.warning("Sandbox receipt received in production mode")
        raise HTTPException(status_code=400, detail="Sandbox receipts not accepted in production")

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

    # Atomically check-and-insert to prevent race conditions (TOCTOU)
    from pymongo.errors import DuplicateKeyError
    lock_doc = {
        "apple_transaction_id": apple_txn_id,
        "user_id": current_user["id"],
        "product_id": data.product_id,
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.apple_txn_locks.insert_one(lock_doc)
    except DuplicateKeyError:
        return {"status": "already_fulfilled", "message": "This purchase has already been processed"}

    # Double-check transactions collection
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
        import jwt as pyjwt
        import requests as http_requests
        from jwt.algorithms import RSAAlgorithm

        body = await request.json()
        signed_payload = body.get("signedPayload", "")

        if not signed_payload:
            logger.warning("Apple notification missing signedPayload")
            return {"status": "ok"}

        # Verify the JWS signature using Apple's public keys
        try:
            apple_keys_response = http_requests.get("https://appleid.apple.com/auth/keys", timeout=10)
            apple_keys = apple_keys_response.json()
            header = pyjwt.get_unverified_header(signed_payload)
            kid = header.get("kid")

            matching_key = None
            for key in apple_keys.get("keys", []):
                if key.get("kid") == kid:
                    matching_key = key
                    break

            if matching_key:
                public_key = RSAAlgorithm.from_jwk(matching_key)
                payload = pyjwt.decode(signed_payload, public_key, algorithms=["RS256", "ES256"], options={"verify_aud": False})
            else:
                logger.error(f"Apple notification key {kid} not found — rejecting unverified payload")
                return {"status": "error", "reason": "key_not_found"}
        except Exception as decode_err:
            logger.error(f"Apple notification JWS decode error: {decode_err}")
            return {"status": "error", "reason": "signature_verification_failed"}

        notification_type = payload.get("notificationType", "")
        subtype = payload.get("subtype", "")
        logger.info(f"Apple notification: {notification_type} (subtype: {subtype})")

        data = payload.get("data", {})
        transaction_id = data.get("transactionId")

        if notification_type == "REFUND" and transaction_id:
            await db.transactions.update_one(
                {"apple_transaction_id": transaction_id},
                {"$set": {"status": "refunded"}}
            )
            logger.info(f"Refunded Apple transaction: {transaction_id}")

        elif notification_type == "DID_RENEW" and transaction_id:
            # Subscription renewed - extend the period
            txn = await db.transactions.find_one({"apple_transaction_id": transaction_id})
            if txn:
                user_id = txn.get("user_id")
                if user_id:
                    expires_date = data.get("expiresDate")
                    if expires_date:
                        await db.users.update_one(
                            {"id": user_id},
                            {"$set": {"subscription.period_end": expires_date, "subscription.status": "active"}}
                        )
                        logger.info(f"Renewed subscription for user {user_id}")

        elif notification_type in ("EXPIRED", "REVOKE"):
            if transaction_id:
                txn = await db.transactions.find_one({"apple_transaction_id": transaction_id})
                if txn and txn.get("user_id"):
                    await db.users.update_one(
                        {"id": txn["user_id"]},
                        {"$set": {"subscription.status": "expired"}}
                    )
                    logger.info(f"Expired/revoked subscription for user {txn['user_id']}")

    except Exception as e:
        logger.error(f"Apple notification error: {e}")

    return {"status": "ok"}


# ==================== GOOGLE PLAY BILLING ====================

def _get_google_play_service():
    """Lazily build the Google Play Developer API client using a service account."""
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    key_path = GOOGLE_PLAY_SERVICE_ACCOUNT_KEY
    if not key_path:
        return None

    # Support both file path and inline JSON
    if key_path.startswith("{"):
        import json as _json
        info = _json.loads(key_path)
        credentials = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/androidpublisher"]
        )
    else:
        credentials = service_account.Credentials.from_service_account_file(
            key_path, scopes=["https://www.googleapis.com/auth/androidpublisher"]
        )

    return build("androidpublisher", "v3", credentials=credentials)


@router.post("/google/verify-purchase")
@limiter.limit("10/minute")
async def verify_google_purchase(
    request: Request,
    data: GooglePlayPurchaseValidation,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify a Google Play purchase and fulfill it.

    The Android app sends the purchase token after a successful BillingClient purchase.
    We verify it with Google Play Developer API, then grant the product.
    """
    # Check for duplicate order
    if data.order_id:
        existing = await db.transactions.find_one({"google_order_id": data.order_id})
        if existing:
            return {"status": "already_fulfilled", "message": "This purchase has already been processed"}

    # Determine if this is a subscription or one-time product
    is_subscription = data.tier_id and data.tier_id in SUBSCRIPTION_TIERS

    try:
        service = _get_google_play_service()
        if not service:
            raise HTTPException(
                status_code=503,
                detail="Google Play verification not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_KEY."
            )

        if is_subscription:
            result = service.purchases().subscriptions().get(
                packageName=GOOGLE_PLAY_PACKAGE_NAME,
                subscriptionId=data.product_id,
                token=data.purchase_token
            ).execute()

            # Check subscription is active
            # paymentState: 0=pending, 1=received, 2=free trial, 3=deferred
            payment_state = result.get("paymentState")
            if payment_state not in (1, 2):
                raise HTTPException(status_code=400, detail="Subscription payment not completed")

        else:
            result = service.purchases().products().get(
                packageName=GOOGLE_PLAY_PACKAGE_NAME,
                productId=data.product_id,
                token=data.purchase_token
            ).execute()

            # purchaseState: 0=purchased, 1=canceled, 2=pending
            if result.get("purchaseState") != 0:
                raise HTTPException(status_code=400, detail="Purchase not completed")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Play verification failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to verify purchase with Google Play")

    # Prevent duplicate fulfillment with atomic lock
    from pymongo.errors import DuplicateKeyError
    order_id = data.order_id or data.purchase_token[:64]
    lock_doc = {
        "google_order_id": order_id,
        "user_id": current_user["id"],
        "product_id": data.product_id,
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.google_txn_locks.insert_one(lock_doc)
    except DuplicateKeyError:
        return {"status": "already_fulfilled", "message": "This purchase has already been processed"}

    # Fulfill the purchase
    if is_subscription:
        metadata = {
            "user_id": current_user["id"],
            "tier_id": data.tier_id,
            "duration": data.duration or "monthly",
            "price": SUBSCRIPTION_TIERS[data.tier_id]["prices"].get(data.duration or "monthly", 0),
        }
        await fulfill_subscription(metadata, source="google_play", google_order_id=order_id)
    else:
        # Map Google product ID to our internal product ID
        our_product_id = GOOGLE_TO_PRODUCT.get(data.product_id, data.product_id)
        metadata = {
            "user_id": current_user["id"],
            "product_id": our_product_id,
            "job_id": data.job_id or "",
        }
        await fulfill_purchase(metadata, source="google_play", google_order_id=order_id)

    product_name = data.product_id
    if is_subscription:
        product_name = SUBSCRIPTION_TIERS[data.tier_id]["name"]
    elif data.product_id in GOOGLE_TO_PRODUCT:
        our_id = GOOGLE_TO_PRODUCT[data.product_id]
        product_name = PRODUCTS.get(our_id, {}).get("name", data.product_id)

    return {
        "status": "success",
        "message": f"Purchase fulfilled: {product_name}",
        "product_id": data.product_id,
    }


@router.post("/google/play-notification")
async def google_play_notification(request: Request):
    """
    Handle Google Play Real-time Developer Notifications (RTDN).

    Configure Pub/Sub push subscription to point to:
    https://your-api-domain.com/api/payments/google/play-notification
    """
    try:
        body = await request.json()
        message = body.get("message", {})
        import base64
        notification_data = message.get("data", "")
        if notification_data:
            decoded = base64.b64decode(notification_data).decode("utf-8")
            notification = json.loads(decoded)
        else:
            return {"status": "ok"}

        sub_notification = notification.get("subscriptionNotification")
        if sub_notification:
            notification_type = sub_notification.get("notificationType")
            purchase_token = sub_notification.get("purchaseToken")
            subscription_id = sub_notification.get("subscriptionId")

            # Types: 1=RECOVERED, 2=RENEWED, 3=CANCELED, 4=PURCHASED,
            #        5=ON_HOLD, 6=IN_GRACE_PERIOD, 7=RESTARTED,
            #        12=REVOKED, 13=EXPIRED
            if notification_type in (3, 12, 13) and purchase_token:
                # Canceled, revoked, or expired
                txn = await db.transactions.find_one({"google_order_id": {"$exists": True}, "source": "google_play"})
                if txn and txn.get("user_id"):
                    await db.users.update_one(
                        {"id": txn["user_id"]},
                        {"$set": {"subscription.status": "expired"}}
                    )
                    logger.info(f"Google Play subscription expired/canceled for user {txn['user_id']}")

            elif notification_type in (1, 2, 7) and purchase_token:
                # Recovered, renewed, or restarted
                txn = await db.transactions.find_one({"google_order_id": {"$exists": True}, "source": "google_play"})
                if txn and txn.get("user_id"):
                    try:
                        service = _get_google_play_service()
                        if service:
                            result = service.purchases().subscriptions().get(
                                packageName=GOOGLE_PLAY_PACKAGE_NAME,
                                subscriptionId=subscription_id,
                                token=purchase_token
                            ).execute()
                            expiry_ms = int(result.get("expiryTimeMillis", 0))
                            if expiry_ms:
                                from datetime import datetime as dt
                                expiry = dt.fromtimestamp(expiry_ms / 1000, tz=timezone.utc).isoformat()
                                await db.users.update_one(
                                    {"id": txn["user_id"]},
                                    {"$set": {"subscription.period_end": expiry, "subscription.status": "active"}}
                                )
                                logger.info(f"Google Play subscription renewed for user {txn['user_id']}")
                    except Exception as e:
                        logger.error(f"Failed to refresh Google subscription: {e}")

    except Exception as e:
        logger.error(f"Google Play notification error: {e}")

    return {"status": "ok"}


# ==================== STRIPE CHECKOUT (Web Fallback) ====================

@router.post("/create-checkout-session")
@limiter.limit("10/minute")
async def create_checkout_session(
    request: Request,
    data: CreateCheckoutSession,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe Checkout session for consumables or subscriptions (web only - iOS must use Apple IAP)"""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payment processing is not configured. Set STRIPE_SECRET_KEY.")

    frontend_url = os.getenv("FRONTEND_URL", "https://hireabble.com")
    success_path = "/recruiter" if current_user.get("role") == "recruiter" else "/dashboard"

    # ---- Subscription checkout ----
    if data.tier_id and data.duration:
        tier = SUBSCRIPTION_TIERS.get(data.tier_id)
        if not tier:
            raise HTTPException(status_code=400, detail="Invalid tier")
        if tier["role"] != current_user.get("role"):
            raise HTTPException(status_code=403, detail="This tier is not available for your role")
        price = tier["prices"].get(data.duration)
        if not price:
            raise HTTPException(status_code=400, detail="Invalid duration")

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": f"{tier['name']} — {data.duration}"},
                        "unit_amount": price,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=f"{frontend_url}{success_path}?payment=success&tier={data.tier_id}&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{frontend_url}/upgrade?payment=cancelled",
                metadata={
                    "user_id": current_user["id"],
                    "type": "subscription",
                    "tier_id": data.tier_id,
                    "duration": data.duration,
                    "price": str(price),
                },
            )
            return {"checkout_url": session.url, "session_id": session.id}
        except Exception as e:
            logger.error(f"Stripe subscription checkout error: {e}")
            raise HTTPException(status_code=500, detail="Failed to create checkout session")

    # ---- Consumable product checkout ----
    if not data.product_id:
        raise HTTPException(status_code=400, detail="Either product_id or tier_id+duration is required")

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
                "type": "consumable",
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


@router.get("/verify-session/{session_id}")
async def verify_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Verify a Stripe checkout session and fulfill if paid. Called when user returns from Stripe."""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payments not configured")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session")

    # Verify the session belongs to this user
    metadata = session.get("metadata", {})
    if metadata.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Session does not belong to this user")

    if session.get("payment_status") != "paid":
        return {"status": "pending", "message": "Payment not yet completed"}

    # Check if already fulfilled (avoid duplicate transactions)
    existing = await db.transactions.find_one({
        "user_id": current_user["id"],
        "stripe_session_id": session_id,
    })
    if not existing:
        if metadata.get("type") == "subscription":
            await fulfill_subscription(metadata, source="stripe", stripe_session_id=session_id)
        else:
            await fulfill_purchase(metadata, source="stripe", stripe_session_id=session_id)

    # Return updated subscription info
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "subscription": 1})
    return {"status": "paid", "subscription": user.get("subscription")}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payments not configured")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET not configured — rejecting webhook")
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        sid = session.get("id")

        # Defense-in-depth: verify amount_total matches expected price from server-side definitions
        amount_total = session.get("amount_total")
        if metadata.get("type") == "subscription" and metadata.get("tier_id"):
            tier = SUBSCRIPTION_TIERS.get(metadata["tier_id"])
            expected_price = tier["prices"].get(metadata.get("duration")) if tier else None
            if expected_price and amount_total and amount_total != expected_price:
                logger.error(f"Stripe webhook amount mismatch: paid={amount_total} expected={expected_price} session={sid}")
                return {"status": "error", "reason": "amount_mismatch"}
        elif metadata.get("type") == "consumable" and metadata.get("product_id"):
            product = PRODUCTS.get(metadata["product_id"])
            if product and amount_total and amount_total != product["price"]:
                logger.error(f"Stripe webhook amount mismatch: paid={amount_total} expected={product['price']} session={sid}")
                return {"status": "error", "reason": "amount_mismatch"}

        # Skip if already fulfilled by verify-session endpoint
        already = await db.transactions.find_one({
            "user_id": metadata.get("user_id"),
            "stripe_session_id": sid,
        }) if sid else None

        if not already:
            if metadata.get("type") == "subscription":
                await fulfill_subscription(metadata, source="stripe", stripe_session_id=sid)
            else:
                await fulfill_purchase(metadata, source="stripe", stripe_session_id=sid)

    return {"status": "ok"}


async def fulfill_subscription(metadata: dict, source: str = "stripe", promo_code: str = None, custom_duration_days: int = None, stripe_session_id: str = None, google_order_id: str = None):
    """Activate a subscription after successful payment or promo redemption"""
    user_id = metadata.get("user_id")
    tier_id = metadata.get("tier_id")
    duration = metadata.get("duration", "custom")
    price = int(metadata.get("price", 0))

    if not user_id or not tier_id:
        logger.error(f"Missing subscription metadata: {metadata}")
        return

    tier = SUBSCRIPTION_TIERS.get(tier_id)
    if not tier:
        logger.error(f"Invalid tier in webhook: {tier_id}")
        return

    if custom_duration_days:
        duration_days = custom_duration_days
    else:
        duration_days = {"weekly": 7, "monthly": 30, "6month": 180}.get(duration, 30)
    period_end = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()

    subscription = {
        "tier_id": tier_id,
        "tier_name": tier["name"],
        "duration": duration,
        "status": "active",
        "price_paid": price,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "period_end": period_end,
    }

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription": subscription}}
    )

    invalidate_user(user_id)

    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": tier_id,
        "amount": price,
        "source": source,
        "status": "completed",
        "description": f"{tier['name']} - {duration}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if promo_code:
        transaction["promo_code"] = promo_code
    if stripe_session_id:
        transaction["stripe_session_id"] = stripe_session_id
    if google_order_id:
        transaction["google_order_id"] = google_order_id
    await db.transactions.insert_one(transaction)

    await create_notification(
        user_id=user_id,
        notif_type="payment",
        title=f"Welcome to {tier['name']}!",
        message=f"Your {tier['name']} subscription is now active. Enjoy your premium features!",
        data={"tier_id": tier_id}
    )

    logger.info(f"Subscription fulfilled: user={user_id} tier={tier_id} duration={duration} source={source}{f' promo={promo_code}' if promo_code else ''}")


# ==================== PROMO CODES ====================

class PromoRedeemRequest(BaseModel):
    code: str

@router.post("/redeem-promo")
@limiter.limit("5/minute")
async def redeem_promo(body: PromoRedeemRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Redeem a promo code to activate a free subscription."""
    user_id = current_user["id"]
    user_role = current_user.get("role", "seeker")
    code = body.code.strip().upper()

    # Look up promo code
    promo = await db.promo_codes.find_one({"code": code})
    if not promo or not promo.get("active", False):
        raise HTTPException(status_code=400, detail="Invalid or expired promo code.")

    # Check expiry
    if promo.get("expires_at"):
        if promo["expires_at"] < datetime.now(timezone.utc).isoformat():
            raise HTTPException(status_code=400, detail="This promo code has expired.")

    # Check max uses
    if promo.get("max_uses") is not None and promo.get("uses", 0) >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="This promo code has reached its maximum number of uses.")

    # Check role restriction
    if promo.get("role_restriction") and promo["role_restriction"] != user_role:
        raise HTTPException(status_code=400, detail=f"This promo code is only available for {promo['role_restriction']}s.")

    # Check per-user limit
    per_user_limit = promo.get("per_user_limit", 1)
    existing_redemptions = await db.promo_redemptions.count_documents({
        "code_id": promo["id"],
        "user_id": user_id,
    })
    if existing_redemptions >= per_user_limit:
        raise HTTPException(status_code=400, detail="You have already used this promo code.")

    # Check if user already has an active subscription with a later end date
    sub = current_user.get("subscription", {})
    if sub.get("status") == "active" and sub.get("period_end", ""):
        promo_end = (datetime.now(timezone.utc) + timedelta(days=promo["duration_days"])).isoformat()
        if sub["period_end"] >= promo_end:
            raise HTTPException(status_code=400, detail="You already have an active subscription that extends beyond this promo.")

    # Redeem: activate subscription
    tier_id = promo["tier_id"]
    await fulfill_subscription(
        metadata={"user_id": user_id, "tier_id": tier_id, "duration": "promo", "price": 0},
        source="promo",
        promo_code=code,
        custom_duration_days=promo["duration_days"],
    )

    # Track redemption
    await db.promo_redemptions.insert_one({
        "id": str(uuid.uuid4()),
        "code_id": promo["id"],
        "code": code,
        "user_id": user_id,
        "redeemed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Increment usage count
    await db.promo_codes.update_one({"id": promo["id"]}, {"$inc": {"uses": 1}})

    tier = SUBSCRIPTION_TIERS.get(tier_id, {})
    logger.info(f"Promo redeemed: user={user_id} code={code} tier={tier_id}")
    return {
        "success": True,
        "tier_name": tier.get("name", tier_id),
        "duration_days": promo["duration_days"],
        "message": f"Promo code applied! You now have {tier.get('name', 'Premium')} for {promo['duration_days']} days.",
    }


@router.get("/validate-promo")
async def validate_promo(code: str, current_user: dict = Depends(get_current_user)):
    """Check if a promo code is valid without redeeming it."""
    code = code.strip().upper()
    promo = await db.promo_codes.find_one({"code": code})

    if not promo or not promo.get("active", False):
        return {"valid": False, "reason": "Invalid promo code."}

    if promo.get("expires_at") and promo["expires_at"] < datetime.now(timezone.utc).isoformat():
        return {"valid": False, "reason": "This promo code has expired."}

    if promo.get("max_uses") is not None and promo.get("uses", 0) >= promo["max_uses"]:
        return {"valid": False, "reason": "This promo code is no longer available."}

    user_role = current_user.get("role", "seeker")
    if promo.get("role_restriction") and promo["role_restriction"] != user_role:
        return {"valid": False, "reason": f"This code is for {promo['role_restriction']}s only."}

    tier = SUBSCRIPTION_TIERS.get(promo["tier_id"], {})
    return {
        "valid": True,
        "tier_name": tier.get("name", promo["tier_id"]),
        "duration_days": promo["duration_days"],
    }


# ==================== FULFILLMENT ====================

async def fulfill_purchase(metadata: dict, source: str = "unknown", apple_transaction_id: str = None, stripe_session_id: str = None, google_order_id: str = None):
    """Fulfill a purchase after successful payment (works for Stripe, Apple IAP, and Google Play)"""
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
    if stripe_session_id:
        transaction["stripe_session_id"] = stripe_session_id
    if google_order_id:
        transaction["google_order_id"] = google_order_id

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


@router.post("/boosts/free")
async def use_free_monthly_boost(data: BoostCreate, current_user: dict = Depends(get_current_user)):
    """Use a free monthly boost included with Pro/Enterprise subscription.
    Pro gets 1/month, Enterprise gets 3/month."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can boost jobs")

    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    tier_id = sub.get("tier_id", "")

    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now_iso
            and tier_id in ("recruiter_pro", "recruiter_enterprise")):
        raise HTTPException(status_code=403, detail="Pro or Enterprise subscription required")

    monthly_limit = 1 if tier_id == "recruiter_pro" else 3

    # Count free boosts used this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    free_boosts_used = await db.boosts.count_documents({
        "user_id": current_user["id"],
        "is_free_boost": True,
        "created_at": {"$gte": month_start},
    })

    if free_boosts_used >= monthly_limit:
        raise HTTPException(status_code=400, detail=f"All {monthly_limit} free monthly boost(s) used. Resets next month.")

    job = await db.jobs.find_one({"id": data.job_id, "recruiter_id": current_user["id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    boost_end = now + timedelta(days=1)
    boost_doc = {
        "id": str(uuid.uuid4()),
        "job_id": data.job_id,
        "user_id": current_user["id"],
        "boost_until": boost_end.isoformat(),
        "multiplier": 3,
        "is_free_boost": True,
        "created_at": now_iso,
    }
    await db.boosts.insert_one(boost_doc)
    await db.jobs.update_one(
        {"id": data.job_id},
        {"$set": {"is_boosted": True, "boost_until": boost_end.isoformat()}}
    )

    remaining = monthly_limit - free_boosts_used - 1
    return {
        "message": f"Job boosted for 1 day! {remaining} free boost(s) remaining this month.",
        "remaining_free_boosts": remaining,
    }


@router.get("/boosts/free/remaining")
async def get_free_boosts_remaining(current_user: dict = Depends(get_current_user)):
    """Get how many free monthly boosts the recruiter has remaining."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view boosts")

    sub = current_user.get("subscription") or {}
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    tier_id = sub.get("tier_id", "")

    if not (sub.get("status") == "active" and sub.get("period_end", "") >= now_iso
            and tier_id in ("recruiter_pro", "recruiter_enterprise")):
        return {"monthly_limit": 0, "used": 0, "remaining": 0}

    monthly_limit = 1 if tier_id == "recruiter_pro" else 3
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    used = await db.boosts.count_documents({
        "user_id": current_user["id"],
        "is_free_boost": True,
        "created_at": {"$gte": month_start},
    })

    return {"monthly_limit": monthly_limit, "used": used, "remaining": max(0, monthly_limit - used)}


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
