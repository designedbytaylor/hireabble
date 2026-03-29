"""
Authentication routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import uuid
import asyncio

import os
import httpx

import secrets
import hashlib

from database import (
    db, security, logger, RESEND_API_KEY, FRONTEND_URL,
    JWT_SECRET, JWT_ALGORITHM,
    hash_password, verify_password, create_token, get_current_user,
    blacklist_token,
    send_email_notification, get_email_template, escape_html, manager,
    encrypt_value, decrypt_value,
    UserCreate, UserLogin, UserResponse, ForgotPasswordRequest,
    ResetPasswordRequest, ChangePasswordRequest
)
from cachetools import TTLCache
from content_filter import check_fields, is_severe


def _decrypt_totp_secret(stored_value: str) -> str:
    """Decrypt TOTP secret from DB. Handles both encrypted and legacy plaintext values."""
    try:
        return decrypt_value(stored_value)
    except Exception:
        return stored_value  # Legacy unencrypted value
from cache import invalidate_user, _get_redis

# Track failed login attempts — Redis-backed for multi-worker consistency
_login_attempts_local = TTLCache(maxsize=10000, ttl=900)
_LOCKOUT_THRESHOLD = 10
_LOCKOUT_DURATION = 900  # seconds

def _get_login_attempts(email_key: str) -> int:
    """Get failed login attempt count, using Redis if available."""
    r = _get_redis()
    if r:
        try:
            val = r.get(f"login_attempts:{email_key}")
            return int(val) if val else 0
        except Exception:
            pass
    return _login_attempts_local.get(email_key, 0)

def _incr_login_attempts(email_key: str):
    """Increment failed login attempt count."""
    r = _get_redis()
    if r:
        try:
            pipe = r.pipeline()
            pipe.incr(f"login_attempts:{email_key}")
            pipe.expire(f"login_attempts:{email_key}", _LOCKOUT_DURATION)
            pipe.execute()
            return
        except Exception:
            pass
    _login_attempts_local[email_key] = _login_attempts_local.get(email_key, 0) + 1

def _clear_login_attempts(email_key: str):
    """Clear failed login attempts on successful login."""
    r = _get_redis()
    if r:
        try:
            r.delete(f"login_attempts:{email_key}")
        except Exception:
            pass
    _login_attempts_local.pop(email_key, None)

# OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')
LINKEDIN_CLIENT_ID = os.environ.get('LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = os.environ.get('LINKEDIN_CLIENT_SECRET', '')
FACEBOOK_APP_ID = os.environ.get('FACEBOOK_APP_ID', '')
FACEBOOK_APP_SECRET = os.environ.get('FACEBOOK_APP_SECRET', '')

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Fields to always exclude from user API responses
_SENSITIVE_USER_FIELDS = {'_id', 'password', 'totp_secret', 'totp_backup_codes', 'apple_refresh_token'}

def _safe_user_response(user: dict) -> dict:
    """Return user dict with sensitive fields stripped."""
    return {k: v for k, v in user.items() if k not in _SENSITIVE_USER_FIELDS}

# ==================== REGISTRATION & LOGIN ====================

@router.post("/register")
@limiter.limit("10/minute")
async def register(user: UserCreate, request: Request):
    try:
        logger.info(f"Registration attempt for email: {user.email}")

        # Age verification: must be at least 16 years old
        if user.dob:
            from datetime import date
            try:
                dob = date.fromisoformat(user.dob)
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 16:
                    raise HTTPException(status_code=400, detail="You must be at least 16 years old to use Hireabble")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date of birth format")

        # Password strength validation
        if len(user.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        import re as _re
        if not _re.search(r'[A-Z]', user.password):
            raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
        if not _re.search(r'[0-9]', user.password):
            raise HTTPException(status_code=400, detail="Password must contain at least one number")
        if not _re.search(r'[^A-Za-z0-9]', user.password):
            raise HTTPException(status_code=400, detail="Password must contain at least one special character")

        # Content moderation on registration fields
        is_clean, violations = check_fields({"name": user.name, "company": user.company or ""})
        if not is_clean and is_severe(violations):
            raise HTTPException(status_code=400, detail="Registration contains prohibited content.")

        # Check if user exists - use generic message to prevent email enumeration
        existing = await db.users.find_one({"email": user.email})
        if existing:
            raise HTTPException(status_code=409, detail="Unable to create account. Please try again or use a different email.")

        user_id = str(uuid.uuid4())
        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={user_id}"

        user_doc = {
            "id": user_id,
            "email": user.email,
            "password": hash_password(user.password),
            "name": user.name,
            "role": user.role,
            "company": user.company,
            "date_of_birth": user.dob,
            "avatar": avatar,
            "photo_url": None,
            "video_url": None,
            "title": None,
            "bio": None,
            "skills": [],
            "experience_years": None,
            "location": None,
            "current_employer": None,
            "previous_employers": [],
            "school": None,
            "degree": None,
            "certifications": [],
            "work_preference": None,
            "desired_salary": None,
            "available_immediately": True,
            "onboarding_complete": False,
            "email_verified": False,
            "push_subscription": None,
            "blocked_users": [],
            "marketing_emails_opt_in": getattr(user, 'marketing_emails_opt_in', False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Store referral code if provided
        if user.referral_code:
            user_doc["referred_by_code"] = user.referral_code.strip().upper()

        await db.users.insert_one(user_doc)
        logger.info(f"User created successfully: {user_id}")

        # Process referral reward in background
        if user.referral_code:
            async def _process_referral(uid, code, name):
                try:
                    referrer = await db.users.find_one({"referral_code": code}, {"_id": 0, "id": 1, "role": 1})
                    if referrer and referrer["id"] != uid:
                        from routers.users import _generate_referral_code
                        now = datetime.now(timezone.utc).isoformat()
                        await db.referrals.insert_one({
                            "id": str(uuid.uuid4()), "referrer_id": referrer["id"],
                            "referred_id": uid, "code": code, "status": "completed", "created_at": now,
                        })
                        swipe_field = "seeker_purchased_superlikes" if referrer.get("role") == "seeker" else "recruiter_purchased_superlikes"
                        await db.users.update_one({"id": referrer["id"]}, {"$inc": {swipe_field: 5}})
                        await db.users.update_one({"id": uid}, {"$set": {"referral_redeemed": True}})
                        await create_notification(referrer["id"], "referral", "Referral Reward!", f"{name} joined using your referral code! You earned 5 Super Swipes.")
                        from cache import invalidate_user
                        invalidate_user(referrer["id"])
                except Exception as e:
                    logger.error(f"Referral processing failed: {e}")
            asyncio.create_task(_process_referral(user_id, user.referral_code.strip().upper(), user.name))

        # Apply promo code if provided
        promo_result = None
        if user.promo_code:
            promo_result = await _apply_signup_promo(user_id, user.role, user.promo_code.strip().upper())
            if promo_result:
                # Reload user doc to include subscription
                updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
                if updated:
                    user_doc = {**user_doc, **updated}

        # Send verification email
        asyncio.create_task(_send_verification_email(user_id, user.email, user.name))

        token = create_token(user_id, user.role)
        user_response = _safe_user_response(user_doc)

        result = {"token": token, "user": user_response}
        if promo_result:
            result["promo"] = promo_result
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

async def _apply_signup_promo(user_id: str, role: str, code: str):
    """Apply a promo code during registration. Returns promo info or None."""
    try:
        from routers.payments import fulfill_subscription, SUBSCRIPTION_TIERS

        promo = await db.promo_codes.find_one({"code": code})
        if not promo or not promo.get("active", False):
            return None

        # Check expiry
        if promo.get("expires_at") and promo["expires_at"] < datetime.now(timezone.utc).isoformat():
            return None

        # Check max uses
        if promo.get("max_uses") is not None and promo.get("uses", 0) >= promo["max_uses"]:
            return None

        # Check role restriction
        if promo.get("role_restriction") and promo["role_restriction"] != role:
            return None

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
        await db.promo_codes.update_one({"id": promo["id"]}, {"$inc": {"uses": 1}})

        tier = SUBSCRIPTION_TIERS.get(tier_id, {})
        logger.info(f"Signup promo redeemed: user={user_id} code={code} tier={tier_id}")
        return {
            "tier_name": tier.get("name", tier_id),
            "duration_days": promo["duration_days"],
        }
    except Exception as e:
        logger.error(f"Failed to apply signup promo code: {e}")
        return None


async def _send_verification_email(user_id: str, email: str, name: str):
    """Send email verification link"""
    import hashlib
    verification_token = str(uuid.uuid4())
    token_hash = hashlib.sha256(verification_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    await db.email_verification_tokens.delete_many({"user_id": user_id})
    await db.email_verification_tokens.insert_one({
        "token": token_hash,
        "user_id": user_id,
        "email": email,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    verify_link = f"{FRONTEND_URL}/verify-email?token={verification_token}"
    html = get_email_template(
        title="Verify Your Email",
        body_html=f"<p>Hi {escape_html(name)},</p><p>Welcome to Hireabble! Please verify your email address to get full access to all features.</p>",
        cta_text="Verify Email",
        cta_url=verify_link,
    )
    await send_email_notification(email, "Verify your Hireabble email", html)


@router.post("/verify-email")
async def verify_email(body: dict):
    """Verify email using token from email link"""
    import hashlib
    token_str = body.get("token")
    if not token_str:
        raise HTTPException(status_code=400, detail="Missing verification token")

    token_hash = hashlib.sha256(token_str.encode()).hexdigest()
    token_doc = await db.email_verification_tokens.find_one({"token": token_hash})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.email_verification_tokens.delete_one({"token": token_hash})
        raise HTTPException(status_code=400, detail="Verification token has expired")

    await db.users.update_one(
        {"id": token_doc["user_id"]},
        {"$set": {"email_verified": True}}
    )
    await db.email_verification_tokens.delete_many({"user_id": token_doc["user_id"]})
    invalidate_user(token_doc["user_id"])

    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, current_user: dict = Depends(get_current_user)):
    """Resend verification email for the current user"""
    if current_user.get("email_verified"):
        return {"message": "Email already verified"}

    asyncio.create_task(_send_verification_email(
        current_user["id"], current_user["email"], current_user["name"]
    ))
    return {"message": "Verification email sent"}


def _create_2fa_token(user_id: str) -> str:
    """Create a short-lived token for 2FA verification (5 min TTL)."""
    import jwt as _jwt
    payload = {
        "user_id": user_id,
        "role": "__2fa_pending",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "jti": str(uuid.uuid4()),  # unique ID to prevent reuse
    }
    return _jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@router.post("/login")
@limiter.limit("5/minute")
async def login(credentials: UserLogin, request: Request):
    email_key = credentials.email.lower()

    # Check if account is locked out
    attempts = _get_login_attempts(email_key)
    if attempts >= _LOCKOUT_THRESHOLD:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again in 15 minutes."
        )

    # Always perform a password check to prevent timing-based user enumeration
    _DUMMY_HASH = "$2b$12$LJ3m4ys3Lg7E90Sv7RnKruYSfFnMKHbTFAOBqSTbSuPaFStKiVKxe"
    user = await db.users.find_one({"email": credentials.email})
    password_valid = verify_password(credentials.password, user["password"] if user else _DUMMY_HASH)

    if not user or not password_valid:
        _incr_login_attempts(email_key)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Successful login - clear failed attempts
    _clear_login_attempts(email_key)

    # Check if 2FA is enabled
    if user.get("totp_enabled") and user.get("totp_secret"):
        totp_code = credentials.totp_code if hasattr(credentials, 'totp_code') else None

        # If no TOTP code provided, return a challenge response
        if not totp_code:
            # Return partial auth — client must re-submit with TOTP code
            return {
                "requires_2fa": True,
                "two_fa_type": "totp",
                "message": "Two-factor authentication code required",
                "temp_token": _create_2fa_token(user["id"])
            }

        import pyotp
        totp = pyotp.TOTP(_decrypt_totp_secret(user["totp_secret"]))

        # Check TOTP code
        if not totp.verify(totp_code, valid_window=1):
            # Check backup codes
            backup_valid = False
            if user.get("totp_backup_codes"):
                for i, hashed_code in enumerate(user["totp_backup_codes"]):
                    if verify_password(totp_code, hashed_code):
                        backup_valid = True
                        # Atomically remove used backup code to prevent reuse in race conditions
                        await db.users.update_one(
                            {"id": user["id"]},
                            {"$pull": {"totp_backup_codes": hashed_code}}
                        )
                        break

            if not backup_valid:
                raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # Check email-based 2FA (separate from TOTP)
    if user.get("email_2fa_enabled") and not user.get("totp_enabled"):
        code = f"{secrets.randbelow(1000000):06d}"
        code_hash = hashlib.sha256(code.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        await db.user_2fa_codes.delete_many({"user_id": user["id"]})
        await db.user_2fa_codes.insert_one({
            "user_id": user["id"],
            "code_hash": code_hash,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        html = get_email_template(
            "Login Verification",
            f"<p>Your login verification code is:</p>"
            f"<p style='font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;'>{code}</p>"
            f"<p style='color: #999;'>This code expires in 10 minutes. If you didn't attempt to log in, please secure your account immediately.</p>",
        )
        await send_email_notification(user["email"], "Hireabble - Login Verification Code", html)

        return {
            "requires_2fa": True,
            "two_fa_type": "email",
            "message": "Verification code sent to your email",
            "temp_token": _create_2fa_token(user["id"]),
        }

    # Block banned/suspended users from logging in
    user_status = user.get("status", "active")
    if user_status == "banned":
        raise HTTPException(status_code=403, detail="Your account has been banned. Contact support for more info.")
    if user_status == "suspended":
        raise HTTPException(status_code=403, detail="Your account is temporarily suspended. Contact support for more info.")

    token = create_token(user["id"], user["role"], remember_me=credentials.remember_me)
    user_response = _safe_user_response(user)

    return {"token": token, "user": user_response}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Server-side logout — blacklists the current JWT so it cannot be reused."""
    try:
        import jwt as pyjwt
        payload = pyjwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        jti = payload.get("jti")
        if jti:
            await blacklist_token(jti)
    except Exception:
        pass  # Token may be expired/invalid — still return success
    return {"message": "Logged out"}

# ==================== PROMO CODE CHECK (PUBLIC) ====================

@router.get("/check-promo")
async def check_promo(code: str, role: str = "seeker"):
    """Public endpoint to validate a promo code before registration."""
    from routers.payments import SUBSCRIPTION_TIERS
    code = code.strip().upper()
    promo = await db.promo_codes.find_one({"code": code})

    if not promo or not promo.get("active", False):
        return {"valid": False, "reason": "Invalid promo code."}

    if promo.get("expires_at") and promo["expires_at"] < datetime.now(timezone.utc).isoformat():
        return {"valid": False, "reason": "This promo code has expired."}

    if promo.get("max_uses") is not None and promo.get("uses", 0) >= promo["max_uses"]:
        return {"valid": False, "reason": "This promo code is no longer available."}

    if promo.get("role_restriction") and promo["role_restriction"] != role:
        return {"valid": False, "reason": f"This code is for {promo['role_restriction']}s only."}

    tier = SUBSCRIPTION_TIERS.get(promo["tier_id"], {})
    return {
        "valid": True,
        "tier_name": tier.get("name", promo["tier_id"]),
        "duration_days": promo["duration_days"],
    }

# ==================== FORGOT PASSWORD ====================

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(body: ForgotPasswordRequest, request: Request):
    """Send password reset email"""
    user = await db.users.find_one({"email": body.email})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset link has been sent."}
    
    # Generate unique reset token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    import hashlib
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()

    # Store token in database (delete any existing tokens for this user first)
    await db.password_reset_tokens.delete_many({"user_id": user["id"]})
    await db.password_reset_tokens.insert_one({
        "token": token_hash,
        "user_id": user["id"],
        "email": body.email,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get frontend URL from environment or use default
    import os
    frontend_url = os.environ.get('FRONTEND_URL', 'https://hireabble.com')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Send email
    if RESEND_API_KEY:
        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #6366f1; margin: 0;">Hireabble</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 16px; border-left: 4px solid #6366f1;">
                <h2 style="margin: 0 0 15px 0; color: #333;">Reset Your Password</h2>
                <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                    You requested to reset your password. Click the button below to create a new password.
                </p>
                <p style="color: #999; font-size: 14px;">
                    This link will expire in 1 hour.
                </p>
            </div>
            <div style="padding: 25px 0; text-align: center;">
                <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #d946ef 100%); color: white; padding: 14px 40px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
            <div style="text-align: center; color: #999; font-size: 13px; margin-top: 20px;">
                <p>If you didn't request this reset, you can safely ignore this email.</p>
                <p style="margin-top: 10px;">Or copy this link: <br/><span style="color: #6366f1; word-break: break-all;">{reset_link}</span></p>
            </div>
        </div>
        """
        asyncio.create_task(send_email_notification(
            body.email,
            "Reset Your Hireabble Password",
            email_html
        ))
    else:
        logger.warning(f"RESEND_API_KEY not configured — password reset email not sent for {body.email}")
    
    return {"message": "If an account exists with this email, a reset link has been sent."}

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(body: ResetPasswordRequest, request: Request):
    """Reset password using token"""
    # Hash the incoming token before lookup
    import hashlib
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    token_doc = await db.password_reset_tokens.find_one({"token": token_hash})

    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Check expiration
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.password_reset_tokens.delete_one({"token": token_hash})
        raise HTTPException(status_code=400, detail="Reset token has expired")

    # Validate password strength (same rules as change-password)
    import re as _re
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not _re.search(r'[A-Z]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not _re.search(r'[0-9]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not _re.search(r'[^A-Za-z0-9]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

    # Update password
    hashed_password = hash_password(body.password)
    await db.users.update_one(
        {"id": token_doc["user_id"]},
        {"$set": {"password": hashed_password, "password_changed_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Delete used token and invalidate 2FA backup codes (force re-setup for security)
    await db.password_reset_tokens.delete_one({"token": token_hash})
    await db.totp_backup_codes.delete_many({"user_id": token_doc["user_id"]})

    return {"message": "Password has been reset successfully"}

# ==================== CHANGE PASSWORD ====================

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change password for logged-in user"""
    # Get user with password
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(request.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    import re as _re
    if not _re.search(r'[A-Z]', request.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not _re.search(r'[0-9]', request.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not _re.search(r'[^A-Za-z0-9]', request.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")
    
    # Update password and record change timestamp for token invalidation
    hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": hashed_password, "password_changed_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Invalidate 2FA backup codes (force re-generation for security)
    await db.totp_backup_codes.delete_many({"user_id": current_user["id"]})

    return {"message": "Password changed successfully"}

# ==================== TWO-FACTOR AUTHENTICATION ====================

@router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    """Generate a TOTP secret and provisioning URI for authenticator app setup."""
    import pyotp

    # Check if already enabled
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "totp_secret": 1, "totp_enabled": 1})
    if user and user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled. Disable it first to reconfigure.")

    # Generate new secret
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user["email"],
        issuer_name="Hireabble"
    )

    # Store secret encrypted at rest (not yet enabled — user must verify first)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"totp_secret": encrypt_value(secret), "totp_enabled": False}}
    )

    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "message": "Scan the QR code with your authenticator app, then verify with a code."
    }


@router.post("/2fa/verify")
async def verify_2fa_setup(body: dict, current_user: dict = Depends(get_current_user)):
    """Verify TOTP code to complete 2FA setup. Generates backup codes."""
    import pyotp
    import secrets

    code = body.get("code", "").strip()
    if not code or len(code) != 6:
        raise HTTPException(status_code=400, detail="A 6-digit verification code is required")

    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "totp_secret": 1})
    if not user or not user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA setup not started. Call /2fa/setup first.")

    totp = pyotp.TOTP(_decrypt_totp_secret(user["totp_secret"]))
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid verification code. Please try again.")

    # Generate backup codes (128-bit entropy each)
    backup_codes = [secrets.token_hex(8) for _ in range(8)]
    hashed_backups = [hash_password(c) for c in backup_codes]

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "totp_enabled": True,
            "totp_backup_codes": hashed_backups,
        }}
    )
    invalidate_user(current_user["id"])

    return {
        "enabled": True,
        "backup_codes": backup_codes,
        "message": "2FA enabled successfully. Save your backup codes in a safe place."
    }


@router.post("/2fa/disable")
@limiter.limit("5/minute")
async def disable_2fa(body: dict, request: Request, current_user: dict = Depends(get_current_user)):
    """Disable 2FA. Requires password confirmation."""
    password = body.get("password", "")

    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"totp_enabled": False}, "$unset": {"totp_secret": "", "totp_backup_codes": ""}}
    )
    invalidate_user(current_user["id"])

    return {"enabled": False, "message": "2FA has been disabled"}


@router.post("/2fa/login")
@limiter.limit("3/minute")
async def complete_2fa_login(body: dict, request: Request):
    """Complete login with 2FA code after receiving requires_2fa response."""
    import pyotp
    temp_token = body.get("temp_token", "")
    totp_code = body.get("code", "").strip()

    if not temp_token or not totp_code:
        raise HTTPException(status_code=400, detail="Token and code are required")

    # Verify temp token
    import jwt as pyjwt
    try:
        payload = pyjwt.decode(temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "__2fa_pending":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload.get("user_id")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("totp_enabled"):
        raise HTTPException(status_code=401, detail="Invalid request")

    totp = pyotp.TOTP(_decrypt_totp_secret(user["totp_secret"]))
    code_valid = totp.verify(totp_code, valid_window=1)

    # Check backup codes if TOTP fails
    if not code_valid and user.get("totp_backup_codes"):
        for i, hashed_code in enumerate(user["totp_backup_codes"]):
            if verify_password(totp_code, hashed_code):
                code_valid = True
                # Atomically remove used backup code to prevent reuse in race conditions
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$pull": {"totp_backup_codes": hashed_code}}
                )
                break

    if not code_valid:
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # Check banned/suspended
    if user.get("status") == "banned":
        raise HTTPException(status_code=403, detail="Your account has been banned.")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Your account is temporarily suspended.")

    token = create_token(user["id"], user["role"])
    user_response = _safe_user_response(user)

    return {"token": token, "user": user_response}


# ==================== EMAIL-BASED 2FA (user toggle) ====================

@router.post("/email-2fa/verify")
@limiter.limit("3/minute")
async def verify_email_2fa_login(body: dict, request: Request):
    """Verify email 2FA code during login."""
    import jwt as pyjwt

    temp_token = body.get("temp_token", "")
    code = body.get("code", "").strip()

    if not temp_token or not code:
        raise HTTPException(status_code=400, detail="Token and code are required")

    try:
        payload = pyjwt.decode(temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "__2fa_pending":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload.get("user_id")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Verification expired. Please log in again.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    stored = await db.user_2fa_codes.find_one({"user_id": user_id})
    if not stored:
        raise HTTPException(status_code=401, detail="No verification code found. Please log in again.")

    if stored["expires_at"] < datetime.now(timezone.utc).isoformat():
        await db.user_2fa_codes.delete_many({"user_id": user_id})
        raise HTTPException(status_code=401, detail="Verification code expired. Please log in again.")

    code_hash = hashlib.sha256(code.encode()).hexdigest()
    if not secrets.compare_digest(code_hash, stored["code_hash"]):
        raise HTTPException(status_code=401, detail="Invalid verification code")

    await db.user_2fa_codes.delete_many({"user_id": user_id})

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.get("status") == "banned":
        raise HTTPException(status_code=403, detail="Your account has been banned.")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Your account is temporarily suspended.")

    token = create_token(user["id"], user["role"])
    user_response = _safe_user_response(user)

    return {"token": token, "user": user_response}


@router.get("/email-2fa/status")
async def get_email_2fa_status(current_user: dict = Depends(get_current_user)):
    """Get whether email 2FA is enabled for the current user."""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "email_2fa_enabled": 1})
    return {"enabled": bool(user.get("email_2fa_enabled", False)) if user else False}


@router.put("/email-2fa/toggle")
async def toggle_email_2fa(body: dict, current_user: dict = Depends(get_current_user)):
    """Enable or disable email-based 2FA for the current user."""
    enabled = bool(body.get("enabled", False))

    # If user has TOTP enabled, don't allow email 2FA (they already have stronger 2FA)
    if enabled and current_user.get("totp_enabled"):
        raise HTTPException(
            status_code=400,
            detail="You already have authenticator app 2FA enabled. Disable it first to use email verification instead."
        )

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"email_2fa_enabled": enabled}}
    )
    invalidate_user(current_user["id"])

    return {
        "enabled": enabled,
        "message": f"Email two-factor authentication {'enabled' if enabled else 'disabled'}",
    }


# ==================== EMAIL CHANGE ====================

@router.post("/change-email")
@limiter.limit("3/minute")
async def request_email_change(body: dict, request: Request, current_user: dict = Depends(get_current_user)):
    """Request email change — sends verification to new email address."""
    new_email = (body.get("new_email") or "").strip().lower()
    password = body.get("password", "")

    if not new_email:
        raise HTTPException(status_code=400, detail="New email is required")

    # Basic email validation
    import re as _re
    if not _re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', new_email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    if new_email == current_user.get("email", "").lower():
        raise HTTPException(status_code=400, detail="New email must be different from current email")

    # Verify password for security
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")

    # Check if new email is already taken
    existing = await db.users.find_one({"email": new_email})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered")

    # Generate verification token (hash before storage — same pattern as password reset)
    import hashlib
    change_token = str(uuid.uuid4())
    token_hash = hashlib.sha256(change_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    # Store the pending email change (hashed token)
    await db.email_change_tokens.delete_many({"user_id": current_user["id"]})
    await db.email_change_tokens.insert_one({
        "token": token_hash,
        "user_id": current_user["id"],
        "old_email": current_user["email"],
        "new_email": new_email,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Send verification to new email (raw token in link, hash in DB)
    confirm_link = f"{FRONTEND_URL}/verify-email?token={change_token}&type=email-change"
    html = get_email_template(
        title="Confirm Email Change",
        body_html=f"<p>Hi {escape_html(current_user.get('name', ''))},</p><p>You requested to change your Hireabble email to this address. Click below to confirm.</p><p style='color: #999; font-size: 13px;'>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>",
        cta_text="Confirm Email Change",
        cta_url=confirm_link,
    )
    asyncio.create_task(send_email_notification(new_email, "Confirm your new Hireabble email", html))

    return {"message": "Verification email sent to your new address. Please check your inbox."}


@router.post("/confirm-email-change")
async def confirm_email_change(body: dict):
    """Confirm email change using token from verification email."""
    import hashlib
    token_str = body.get("token")
    if not token_str:
        raise HTTPException(status_code=400, detail="Missing verification token")

    # Hash the incoming token before DB lookup (tokens stored as hashes)
    token_hash = hashlib.sha256(token_str.encode()).hexdigest()
    token_doc = await db.email_change_tokens.find_one({"token": token_hash})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Check expiration
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.email_change_tokens.delete_one({"token": token_hash})
        raise HTTPException(status_code=400, detail="Token has expired")

    # Atomically update email only if no other user has claimed it.
    # The unique index on 'email' prevents race conditions.
    from pymongo.errors import DuplicateKeyError
    try:
        result = await db.users.update_one(
            {"id": token_doc["user_id"]},
            {"$set": {"email": token_doc["new_email"], "email_verified": True}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Email change failed")
    except DuplicateKeyError:
        await db.email_change_tokens.delete_one({"token": token_hash})
        raise HTTPException(status_code=400, detail="This email is already registered")

    # Clean up
    await db.email_change_tokens.delete_many({"user_id": token_doc["user_id"]})
    invalidate_user(token_doc["user_id"])

    return {"message": "Email changed successfully"}

# ==================== PROFILE ====================

@router.put("/profile")
async def update_profile(updates: dict, current_user: dict = Depends(get_current_user)):
    """Update user profile"""
    allowed_fields = [
        "name", "title", "bio", "skills", "experience_years", "location",
        "company", "avatar", "photo_url", "video_url", "current_employer",
        "previous_employers", "school", "degree", "certifications",
        "work_preference", "desired_salary", "available_immediately",
        "onboarding_complete", "push_subscription",
        "job_type_preference", "work_history", "education",
        "references", "references_hidden", "show_contact_on_resume",
        "interests", "resume_theme", "include_photo_on_resume",
        "company_logo", "company_address", "company_website", "company_about",
        "company_size", "company_industry",
        "location_lat", "location_lng",
        "company_address_lat", "company_address_lng",
        "work_style",
    ]
    
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}

    # Type validation for profile fields
    _FIELD_TYPES = {
        "name": str, "title": str, "bio": str, "location": str,
        "company": str, "avatar": str, "photo_url": str, "video_url": str,
        "current_employer": str, "school": str, "degree": str,
        "work_preference": str, "job_type_preference": str,
        "experience_years": (int, type(None)),
        "desired_salary": (int, type(None)),
        "available_immediately": bool, "onboarding_complete": bool,
        "references_hidden": bool, "show_contact_on_resume": bool,
        "skills": list, "previous_employers": list, "certifications": list,
        "interests": list,
        "resume_theme": str,
        "include_photo_on_resume": bool,
        "company_logo": str, "company_address": str, "company_website": str,
        "company_about": str, "company_size": str, "company_industry": str,
        "location_lat": (float, int, type(None)),
        "location_lng": (float, int, type(None)),
        "company_address_lat": (float, int, type(None)),
        "company_address_lng": (float, int, type(None)),
        "work_style": dict,
    }
    for field, expected_type in _FIELD_TYPES.items():
        if field in update_data and update_data[field] is not None:
            if not isinstance(update_data[field], expected_type):
                del update_data[field]

    # Validate work_style: each key must be int 1-5
    if "work_style" in update_data and update_data["work_style"]:
        _WS_KEYS = ["team_preference", "social_style", "work_pace", "decision_style",
                     "learning_style", "management_pref", "problem_approach", "change_comfort"]
        ws = update_data["work_style"]
        cleaned = {}
        for key in _WS_KEYS:
            val = ws.get(key)
            if isinstance(val, int) and 1 <= val <= 5:
                cleaned[key] = val
            else:
                cleaned[key] = 3
        update_data["work_style"] = cleaned

    # Validate URL fields — must be valid HTTPS URLs from trusted domains (or relative paths from local uploads)
    _TRUSTED_URL_DOMAINS = {"dicebear.com", "googleapis.com", "hireabble.com", "localhost"}
    for url_field in ("photo_url", "video_url", "avatar", "company_logo"):
        if url_field in update_data and update_data[url_field]:
            url_val = str(update_data[url_field])
            # Allow relative paths from local uploads (e.g. /uploads/photos/...)
            if url_val.startswith("/uploads/"):
                continue
            if not (url_val.startswith("https://") or url_val.startswith("http://")):
                del update_data[url_field]
            else:
                from urllib.parse import urlparse
                try:
                    parsed = urlparse(url_val)
                    host = parsed.hostname or ""
                    # Allow URLs from trusted domains only
                    if not any(host == d or host.endswith(f".{d}") for d in _TRUSTED_URL_DOMAINS):
                        del update_data[url_field]
                except Exception:
                    del update_data[url_field]

    # Reject nested dicts in scalar fields to prevent NoSQL operator injection
    for key, val in list(update_data.items()):
        if isinstance(val, dict) and key not in ("push_subscription",):
            del update_data[key]
        # Also reject dicts inside arrays (e.g. skills: [{"$gt": ""}])
        if isinstance(val, list):
            update_data[key] = [item for item in val if not isinstance(item, dict)]

    # Validate push_subscription structure
    if "push_subscription" in update_data and update_data["push_subscription"] is not None:
        ps = update_data["push_subscription"]
        if not isinstance(ps, dict) or "endpoint" not in ps or "keys" not in ps:
            del update_data["push_subscription"]
        elif not isinstance(ps.get("endpoint"), str) or not ps["endpoint"].startswith("https://"):
            del update_data["push_subscription"]

    # Content moderation on text fields
    text_keys = ("name", "title", "bio", "skills", "company", "current_employer", "school", "degree", "certifications")
    text_fields = {k: v for k, v in update_data.items() if k in text_keys and v}
    if text_fields:
        is_clean, violations = check_fields(text_fields)
        if not is_clean and is_severe(violations):
            raise HTTPException(status_code=400, detail="Profile update contains prohibited content.")
        if not is_clean:
            update_data["is_flagged"] = True
            await db.moderation_queue.insert_one({
                "id": str(uuid.uuid4()),
                "content_type": "user",
                "content_id": current_user["id"],
                "user_id": current_user["id"],
                "violations": violations,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    if update_data:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_data}
        )
        # Invalidate auth cache so subsequent requests use fresh profile data
        invalidate_user(current_user["id"])

    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user


# ==================== OAUTH / SSO ====================

async def _find_or_create_oauth_user(email: str, name: str, provider: str, role: str = "seeker", photo_url: str = None):
    """Find existing user by email or create a new one from OAuth data"""
    existing = await db.users.find_one({"email": email})
    if existing:
        # Link OAuth provider if not already linked
        updates = {}
        providers = existing.get("oauth_providers", [])
        if provider not in providers:
            providers.append(provider)
            updates["oauth_providers"] = providers
        # Set photo from OAuth if user has no photo yet
        if photo_url and not existing.get("photo_url"):
            updates["photo_url"] = photo_url
        if updates:
            await db.users.update_one({"email": email}, {"$set": updates})
            existing.update(updates)
        token = create_token(existing["id"], existing["role"])
        user_response = _safe_user_response(existing)
        return {"token": token, "user": user_response}

    # Create new user
    user_id = str(uuid.uuid4())
    avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={user_id}"
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(str(uuid.uuid4())),  # Random password for OAuth users
        "name": name,
        "role": role,
        "company": None,
        "avatar": avatar,
        "photo_url": photo_url,
        "video_url": None,
        "title": None,
        "bio": None,
        "skills": [],
        "experience_years": None,
        "location": None,
        "current_employer": None,
        "previous_employers": [],
        "school": None,
        "degree": None,
        "certifications": [],
        "work_preference": None,
        "desired_salary": None,
        "available_immediately": True,
        "onboarding_complete": False,
        "email_verified": True,  # OAuth emails are pre-verified by the provider
        "push_subscription": None,
        "oauth_providers": [provider],
        "marketing_emails_opt_in": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, role)
    user_response = _safe_user_response(user_doc)
    return {"token": token, "user": user_response}


@router.post("/oauth/google")
@limiter.limit("10/minute")
async def google_oauth(body: dict, request: Request):
    """Authenticate with Google OAuth. Expects {code, redirect_uri, role?}"""
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    role = body.get("role", "seeker")

    if not code or not redirect_uri:
        raise HTTPException(status_code=400, detail="Missing code or redirect_uri")

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post("https://oauth2.googleapis.com/token", data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })
            token_data = token_resp.json()

            if "error" in token_data:
                raise HTTPException(status_code=400, detail=token_data.get("error_description", "Google auth failed"))

            # Get user info
            userinfo_resp = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
                "Authorization": f"Bearer {token_data['access_token']}"
            })
            userinfo = userinfo_resp.json()

        email = userinfo.get("email")
        name = userinfo.get("name", email.split("@")[0])

        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Google")

        return await _find_or_create_oauth_user(email, name, "google", role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Google authentication failed")


@router.post("/oauth/github")
@limiter.limit("10/minute")
async def github_oauth(body: dict, request: Request):
    """Authenticate with GitHub OAuth. Expects {code, role?}"""
    code = body.get("code")
    role = body.get("role", "seeker")

    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")

    try:
        # Exchange code for access token
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post("https://github.com/login/oauth/access_token", json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            }, headers={"Accept": "application/json"})
            token_data = token_resp.json()

            if "error" in token_data:
                raise HTTPException(status_code=400, detail=token_data.get("error_description", "GitHub auth failed"))

            access_token = token_data.get("access_token")

            # Get user info
            user_resp = await client.get("https://api.github.com/user", headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"
            })
            github_user = user_resp.json()

            # Get primary email (may need separate call if email is private)
            email = github_user.get("email")
            if not email:
                emails_resp = await client.get("https://api.github.com/user/emails", headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                })
                emails = emails_resp.json()
                primary = next((e for e in emails if e.get("primary")), None)
                email = primary["email"] if primary else None

        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from GitHub")

        name = github_user.get("name") or github_user.get("login", email.split("@")[0])

        return await _find_or_create_oauth_user(email, name, "github", role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GitHub OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail="GitHub authentication failed")


@router.get("/oauth/config")
async def get_oauth_config():
    """Return available OAuth providers and their client IDs (public info only)"""
    return {
        "google": {
            "enabled": bool(GOOGLE_CLIENT_ID),
            "client_id": GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None,
        },
        "github": {
            "enabled": bool(GITHUB_CLIENT_ID),
            "client_id": GITHUB_CLIENT_ID if GITHUB_CLIENT_ID else None,
        },
        "apple": {
            "enabled": bool(APPLE_CLIENT_ID),
            "client_id": APPLE_CLIENT_ID if APPLE_CLIENT_ID else None,
        },
        "linkedin": {
            "enabled": bool(LINKEDIN_CLIENT_ID),
            "client_id": LINKEDIN_CLIENT_ID if LINKEDIN_CLIENT_ID else None,
        },
        "facebook": {
            "enabled": bool(FACEBOOK_APP_ID),
            "client_id": FACEBOOK_APP_ID if FACEBOOK_APP_ID else None,
        }
    }


# ==================== LINKEDIN OAUTH ====================

@router.post("/oauth/linkedin")
@limiter.limit("10/minute")
async def linkedin_oauth(body: dict, request: Request):
    """Authenticate with LinkedIn OAuth. Expects {code, redirect_uri, role?}"""
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    role = body.get("role", "seeker")

    if not code or not redirect_uri:
        raise HTTPException(status_code=400, detail="Missing code or redirect_uri")

    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="LinkedIn OAuth not configured")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Exchange code for access token
            token_resp = await client.post("https://www.linkedin.com/oauth/v2/accessToken", data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
            }, headers={"Content-Type": "application/x-www-form-urlencoded"})
            token_data = token_resp.json()

            if "error" in token_data:
                raise HTTPException(status_code=400, detail=token_data.get("error_description", "LinkedIn auth failed"))

            access_token = token_data.get("access_token")

            # Get user info from LinkedIn userinfo endpoint (OpenID Connect)
            userinfo_resp = await client.get("https://api.linkedin.com/v2/userinfo", headers={
                "Authorization": f"Bearer {access_token}"
            })
            userinfo = userinfo_resp.json()

        email = userinfo.get("email")
        name = userinfo.get("name") or f"{userinfo.get('given_name', '')} {userinfo.get('family_name', '')}".strip()
        picture_url = userinfo.get("picture")

        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from LinkedIn")

        # LinkedIn profile photos are too low-res for swipe cards; skip them
        # and let the user upload a proper photo during onboarding instead
        return await _find_or_create_oauth_user(email, name or email.split("@")[0], "linkedin", role, photo_url=None)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LinkedIn OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail="LinkedIn authentication failed")


# ==================== FACEBOOK OAUTH ====================

@router.post("/oauth/facebook")
@limiter.limit("10/minute")
async def facebook_oauth(body: dict, request: Request):
    """Authenticate with Facebook OAuth. Expects {code, redirect_uri, role?}"""
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    role = body.get("role", "seeker")

    if not code or not redirect_uri:
        raise HTTPException(status_code=400, detail="Missing code or redirect_uri")

    if not FACEBOOK_APP_ID or not FACEBOOK_APP_SECRET:
        raise HTTPException(status_code=501, detail="Facebook OAuth not configured")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Exchange code for access token
            token_resp = await client.get("https://graph.facebook.com/v19.0/oauth/access_token", params={
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "redirect_uri": redirect_uri,
                "code": code,
            })
            token_data = token_resp.json()

            if "error" in token_data:
                raise HTTPException(status_code=400, detail=token_data.get("error", {}).get("message", "Facebook auth failed"))

            access_token = token_data.get("access_token")

            # Get user info
            userinfo_resp = await client.get("https://graph.facebook.com/me", params={
                "fields": "id,name,email",
                "access_token": access_token,
            })
            userinfo = userinfo_resp.json()

        email = userinfo.get("email")
        name = userinfo.get("name")

        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Facebook. Make sure email permission is granted.")

        return await _find_or_create_oauth_user(email, name or email.split("@")[0], "facebook", role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Facebook OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Facebook authentication failed")


# ==================== SIGN IN WITH APPLE ====================

APPLE_CLIENT_ID = os.environ.get('APPLE_CLIENT_ID', '')
APPLE_TEAM_ID = os.environ.get('APPLE_TEAM_ID', '')
APPLE_KEY_ID = os.environ.get('APPLE_KEY_ID', '')
APPLE_PRIVATE_KEY = os.environ.get('APPLE_PRIVATE_KEY', '')

# Warn at import time if Apple Sign In is partially configured (missing private key)
if APPLE_CLIENT_ID and not APPLE_PRIVATE_KEY:
    logger.warning("APPLE_CLIENT_ID is set but APPLE_PRIVATE_KEY is missing — Apple Sign In token exchange will fail")


def _generate_apple_client_secret():
    """Generate a client secret JWT for Apple Sign In API calls (token exchange, revocation)."""
    if not APPLE_PRIVATE_KEY:
        raise ValueError("APPLE_PRIVATE_KEY is not configured — cannot generate Apple client secret")
    import jwt as pyjwt
    now = datetime.now(timezone.utc)
    payload = {
        "iss": APPLE_TEAM_ID,
        "iat": now,
        "exp": now + timedelta(minutes=10),
        "aud": "https://appleid.apple.com",
        "sub": APPLE_CLIENT_ID,
    }
    return pyjwt.encode(payload, APPLE_PRIVATE_KEY, algorithm="ES256", headers={"kid": APPLE_KEY_ID})


@router.post("/oauth/apple")
@limiter.limit("10/minute")
async def apple_oauth(body: dict, request: Request):
    """Authenticate with Apple Sign In. Expects {code, id_token, redirect_uri, role?}"""
    id_token = body.get("id_token")
    code = body.get("code")
    role = body.get("role", "seeker")

    if not id_token and not code:
        raise HTTPException(status_code=400, detail="Missing id_token or code")

    try:
        import jwt as pyjwt

        if id_token:
            # Fetch Apple's public keys and verify the JWT signature
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    apple_keys_response = await client.get("https://appleid.apple.com/auth/keys")
                apple_keys = apple_keys_response.json()

                # Decode the JWT header to find the key ID
                header = pyjwt.get_unverified_header(id_token)
                kid = header.get("kid")

                # Find the matching key
                matching_key = None
                for key in apple_keys.get("keys", []):
                    if key.get("kid") == kid:
                        matching_key = key
                        break

                if not matching_key:
                    raise HTTPException(status_code=400, detail="Apple public key not found")

                # Build the public key and verify the token
                from jwt.algorithms import RSAAlgorithm
                public_key = RSAAlgorithm.from_jwk(matching_key)

                decoded = pyjwt.decode(
                    id_token,
                    public_key,
                    algorithms=["RS256"],
                    audience=APPLE_CLIENT_ID,
                    issuer="https://appleid.apple.com",
                )
            except pyjwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Apple token has expired")
            except pyjwt.InvalidTokenError as jwt_err:
                logger.error(f"Apple JWT verification failed: {jwt_err}")
                raise HTTPException(status_code=400, detail="Invalid Apple token")

            email = decoded.get("email")
            # Apple only sends name on first sign-in, so we may not have it
            name = body.get("user_name") or email.split("@")[0] if email else "Apple User"
        else:
            raise HTTPException(status_code=400, detail="id_token is required for Apple Sign In")

        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Apple")

        # Validate redirect_uri against allowed origins
        allowed_origins = [FRONTEND_URL]
        redirect_uri = body.get("redirect_uri", "")
        if redirect_uri and not any(redirect_uri.startswith(origin) for origin in allowed_origins):
            raise HTTPException(status_code=400, detail="Invalid redirect URI")

        # Exchange authorization code for refresh token (needed for account deletion revocation per Apple guideline 5.1.1)
        apple_refresh_token = None
        if code and APPLE_PRIVATE_KEY and APPLE_TEAM_ID and APPLE_KEY_ID:
            try:
                client_secret = _generate_apple_client_secret()
                async with httpx.AsyncClient(timeout=10) as client:
                    token_resp = await client.post(
                        "https://appleid.apple.com/auth/token",
                        data={
                            "client_id": APPLE_CLIENT_ID,
                            "client_secret": client_secret,
                            "code": code,
                            "grant_type": "authorization_code",
                            "redirect_uri": body.get("redirect_uri", ""),
                        },
                    )
                if token_resp.status_code == 200:
                    token_data = token_resp.json()
                    apple_refresh_token = token_data.get("refresh_token")
            except Exception as token_err:
                logger.warning(f"Failed to exchange Apple auth code for refresh token: {token_err}")

        result = await _find_or_create_oauth_user(email, name, "apple", role)

        # Store the Apple refresh token encrypted for future revocation on account deletion
        if apple_refresh_token:
            from database import encrypt_value
            await db.users.update_one(
                {"email": email},
                {"$set": {"apple_refresh_token": encrypt_value(apple_refresh_token)}}
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apple OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Apple authentication failed")


# ==================== ACCOUNT DELETION ====================

@router.delete("/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Permanently delete user account and all associated data."""
    user_id = current_user["id"]
    user_role = current_user.get("role", "seeker")

    try:
        # Revoke Sign in with Apple token if user signed in with Apple (required by Apple guideline 5.1.1)
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "oauth_providers": 1, "apple_refresh_token": 1})
        if user_doc and "apple" in (user_doc.get("oauth_providers") or []):
            encrypted_token = user_doc.get("apple_refresh_token")
            if encrypted_token and APPLE_CLIENT_ID:
                try:
                    from database import decrypt_value
                    try:
                        apple_refresh_token = decrypt_value(encrypted_token)
                    except Exception as e:
                        logger.warning(f"Could not decrypt Apple refresh token for user {user_id}, skipping revocation: {e}")
                        apple_refresh_token = None
                    if apple_refresh_token:
                        client_secret = _generate_apple_client_secret()
                        async with httpx.AsyncClient(timeout=10) as client:
                            revoke_resp = await client.post(
                                "https://appleid.apple.com/auth/revoke",
                                data={
                                    "client_id": APPLE_CLIENT_ID,
                                    "client_secret": client_secret,
                                    "token": apple_refresh_token,
                                    "token_type_hint": "refresh_token",
                                },
                            )
                        if revoke_resp.status_code == 200:
                            logger.info(f"Revoked Apple token for user {user_id}")
                        else:
                            logger.warning(f"Apple token revocation returned {revoke_resp.status_code} for user {user_id}")
                except Exception as apple_err:
                    logger.warning(f"Apple token revocation failed for {user_id}: {apple_err}")

        # Delete all user data across collections
        await db.users.delete_one({"id": user_id})
        await db.support_tickets.delete_many({"user_id": user_id})
        await db.notifications.delete_many({"user_id": user_id})
        await db.password_reset_tokens.delete_many({"user_id": user_id})
        await db.email_verification_tokens.delete_many({"user_id": user_id})
        await db.moderation_queue.delete_many({"user_id": user_id})
        await db.candidate_notes.delete_many({"$or": [{"recruiter_id": user_id}, {"seeker_id": user_id}]})
        await db.saved_jobs.delete_many({"user_id": user_id})
        await db.transactions.delete_many({"user_id": user_id})
        await db.boosts.delete_many({"user_id": user_id})
        await db.profile_views.delete_many({"$or": [{"viewer_id": user_id}, {"viewed_id": user_id}]})
        # Clean up auth tokens, 2FA, referrals, promos, and verification data
        await db.email_change_tokens.delete_many({"user_id": user_id})
        await db.user_2fa_codes.delete_many({"user_id": user_id})
        await db.totp_backup_codes.delete_many({"user_id": user_id})
        await db.referrals.delete_many({"$or": [{"referrer_id": user_id}, {"referred_id": user_id}]})
        await db.promo_redemptions.delete_many({"user_id": user_id})
        await db.verification_requests.delete_many({"user_id": user_id})
        await db.recruiter_invites.delete_many({"$or": [{"recruiter_id": user_id}, {"seeker_id": user_id}]})
        await db.reference_requests.delete_many({"$or": [{"requester_id": user_id}, {"referee_id": user_id}]})

        if user_role == "seeker":
            # Delete seeker-specific data
            await db.applications.delete_many({"seeker_id": user_id})
            await db.swipes.delete_many({"seeker_id": user_id})
        else:
            # Delete recruiter-specific data: jobs, applications to those jobs
            jobs = await db.jobs.find({"recruiter_id": user_id}, {"id": 1}).to_list(None)
            job_ids = [j["id"] for j in jobs]
            if job_ids:
                await db.applications.delete_many({"job_id": {"$in": job_ids}})
            await db.jobs.delete_many({"recruiter_id": user_id})
            await db.swipes.delete_many({"recruiter_id": user_id})

        # Delete matches and messages involving this user
        matches = await db.matches.find(
            {"$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]},
            {"id": 1}
        ).to_list(None)
        match_ids = [m["id"] for m in matches]
        if match_ids:
            await db.messages.delete_many({"match_id": {"$in": match_ids}})
        await db.matches.delete_many({"$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]})

        # Delete interviews
        await db.interviews.delete_many({"$or": [{"requester_id": user_id}, {"recipient_id": user_id}]})

        # Invalidate cache
        invalidate_user(user_id)

        logger.info(f"Account deleted: {user_id} ({user_role})")
        return {"success": True, "message": "Account permanently deleted"}

    except Exception as e:
        logger.error(f"Account deletion failed for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete account. Please try again or contact support.")


# ==================== DATA EXPORT ====================

@router.get("/account/export")
async def export_account_data(current_user: dict = Depends(get_current_user)):
    """Export all user data as JSON (GDPR / privacy compliance)."""
    user_id = current_user["id"]
    user_role = current_user.get("role", "seeker")

    try:
        # Core user profile (exclude internal fields)
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})

        # Common data
        notifications = await db.notifications.find(
            {"user_id": user_id}, {"_id": 0}
        ).to_list(None)

        support_tickets = await db.support_tickets.find(
            {"user_id": user_id}, {"_id": 0}
        ).to_list(None)

        profile_views = await db.profile_views.find(
            {"$or": [{"viewer_id": user_id}, {"viewed_id": user_id}]}, {"_id": 0}
        ).to_list(None)

        export = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "profile": user_doc,
            "notifications": notifications,
            "support_tickets": support_tickets,
            "profile_views": profile_views,
        }

        # Role-specific data
        if user_role == "seeker":
            export["applications"] = await db.applications.find(
                {"seeker_id": user_id}, {"_id": 0}
            ).to_list(None)
            export["swipes"] = await db.swipes.find(
                {"seeker_id": user_id}, {"_id": 0}
            ).to_list(None)
        else:
            jobs = await db.jobs.find(
                {"recruiter_id": user_id}, {"_id": 0}
            ).to_list(None)
            job_ids = [j["id"] for j in jobs]
            applications = []
            if job_ids:
                applications = await db.applications.find(
                    {"job_id": {"$in": job_ids}}, {"_id": 0}
                ).to_list(None)
            export["jobs"] = jobs
            export["applications_received"] = applications
            export["swipes"] = await db.swipes.find(
                {"recruiter_id": user_id}, {"_id": 0}
            ).to_list(None)

        # Matches, messages, interviews
        matches = await db.matches.find(
            {"$or": [{"seeker_id": user_id}, {"recruiter_id": user_id}]}, {"_id": 0}
        ).to_list(None)
        match_ids = [m["id"] for m in matches]
        messages = []
        if match_ids:
            messages = await db.messages.find(
                {"match_id": {"$in": match_ids}}, {"_id": 0}
            ).to_list(None)

        interviews = await db.interviews.find(
            {"$or": [{"requester_id": user_id}, {"recipient_id": user_id}]}, {"_id": 0}
        ).to_list(None)

        export["matches"] = matches
        export["messages"] = messages
        export["interviews"] = interviews

        logger.info(f"Data exported for user: {user_id}")
        return export

    except Exception as e:
        logger.error(f"Data export failed for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export data. Please try again.")
