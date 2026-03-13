"""
Authentication routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
import uuid
import asyncio

import os
import httpx

from database import (
    db, security, logger, RESEND_API_KEY, FRONTEND_URL,
    hash_password, verify_password, create_token, get_current_user,
    send_email_notification, get_email_template, manager,
    UserCreate, UserLogin, UserResponse, ForgotPasswordRequest,
    ResetPasswordRequest, ChangePasswordRequest
)
from content_filter import check_fields, is_severe
from cache import invalidate_user

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

        # Content moderation on registration fields
        is_clean, violations = check_fields({"name": user.name, "company": user.company or ""})
        if not is_clean and is_severe(violations):
            raise HTTPException(status_code=400, detail="Registration contains prohibited content.")

        # Check if user exists
        existing = await db.users.find_one({"email": user.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

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
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        await db.users.insert_one(user_doc)
        logger.info(f"User created successfully: {user_id}")

        # Send verification email
        asyncio.create_task(_send_verification_email(user_id, user.email, user.name))

        token = create_token(user_id, user.role)
        user_response = {k: v for k, v in user_doc.items() if k not in ['_id', 'password']}

        return {"token": token, "user": user_response}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

async def _send_verification_email(user_id: str, email: str, name: str):
    """Send email verification link"""
    verification_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    await db.email_verification_tokens.delete_many({"user_id": user_id})
    await db.email_verification_tokens.insert_one({
        "token": verification_token,
        "user_id": user_id,
        "email": email,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    verify_link = f"{FRONTEND_URL}/verify-email?token={verification_token}"
    html = get_email_template(
        title="Verify Your Email",
        body_html=f"<p>Hi {name},</p><p>Welcome to Hireabble! Please verify your email address to get full access to all features.</p>",
        cta_text="Verify Email",
        cta_url=verify_link,
    )
    await send_email_notification(email, "Verify your Hireabble email", html)


@router.post("/verify-email")
async def verify_email(body: dict):
    """Verify email using token from email link"""
    token_str = body.get("token")
    if not token_str:
        raise HTTPException(status_code=400, detail="Missing verification token")

    token_doc = await db.email_verification_tokens.find_one({"token": token_str})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.email_verification_tokens.delete_one({"token": token_str})
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


@router.post("/login")
@limiter.limit("15/minute")
async def login(credentials: UserLogin, request: Request):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Block banned/suspended users from logging in
    user_status = user.get("status", "active")
    if user_status == "banned":
        raise HTTPException(status_code=403, detail="Your account has been banned. Contact support for more info.")
    if user_status == "suspended":
        raise HTTPException(status_code=403, detail="Your account is temporarily suspended. Contact support for more info.")

    token = create_token(user["id"], user["role"])
    user_response = {k: v for k, v in user.items() if k not in ['_id', 'password']}
    
    return {"token": token, "user": user_response}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

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
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store token in database (delete any existing tokens for this user first)
    await db.password_reset_tokens.delete_many({"user_id": user["id"]})
    await db.password_reset_tokens.insert_one({
        "token": reset_token,
        "user_id": user["id"],
        "email": body.email,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get frontend URL from environment or use default
    import os
    frontend_url = os.environ.get('FRONTEND_URL', 'https://password-reset-47.preview.emergentagent.com')
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
        logger.warning(f"RESEND_API_KEY not configured. Reset link: {reset_link}")
    
    return {"message": "If an account exists with this email, a reset link has been sent."}

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(body: ResetPasswordRequest, request: Request):
    """Reset password using token"""
    # Find token
    token_doc = await db.password_reset_tokens.find_one({"token": body.token})
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check expiration
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.password_reset_tokens.delete_one({"token": body.token})
        raise HTTPException(status_code=400, detail="Reset token has expired")

    # Update password
    hashed_password = hash_password(body.password)
    await db.users.update_one(
        {"id": token_doc["user_id"]},
        {"$set": {"password": hashed_password}}
    )

    # Delete used token
    await db.password_reset_tokens.delete_one({"token": body.token})
    
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
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}

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
        "references", "references_hidden"
    ]
    
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}

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
        user_response = {k: v for k, v in existing.items() if k not in ['_id', 'password']}
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, role)
    user_response = {k: v for k, v in user_doc.items() if k not in ['_id', 'password']}
    return {"token": token, "user": user_response}


@router.post("/oauth/google")
async def google_oauth(body: dict):
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
async def github_oauth(body: dict):
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
async def linkedin_oauth(body: dict):
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

        return await _find_or_create_oauth_user(email, name or email.split("@")[0], "linkedin", role, photo_url=picture_url)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LinkedIn OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail="LinkedIn authentication failed")


# ==================== FACEBOOK OAUTH ====================

@router.post("/oauth/facebook")
async def facebook_oauth(body: dict):
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


@router.post("/oauth/apple")
async def apple_oauth(body: dict):
    """Authenticate with Apple Sign In. Expects {code, id_token, redirect_uri, role?}"""
    id_token = body.get("id_token")
    code = body.get("code")
    role = body.get("role", "seeker")

    if not id_token and not code:
        raise HTTPException(status_code=400, detail="Missing id_token or code")

    try:
        import jwt as pyjwt
        import requests as http_requests

        if id_token:
            # Fetch Apple's public keys and verify the JWT signature
            try:
                apple_keys_response = http_requests.get("https://appleid.apple.com/auth/keys", timeout=10)
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

        return await _find_or_create_oauth_user(email, name, "apple", role)

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
        # Delete all user data across collections
        await db.users.delete_one({"id": user_id})
        await db.support_tickets.delete_many({"user_id": user_id})
        await db.notifications.delete_many({"user_id": user_id})
        await db.password_reset_tokens.delete_many({"user_id": user_id})
        await db.moderation_queue.delete_many({"user_id": user_id})
        await db.profile_views.delete_many({"$or": [{"viewer_id": user_id}, {"viewed_id": user_id}]})

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
