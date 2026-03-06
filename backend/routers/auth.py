"""
Authentication routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import uuid
import asyncio

import os
import requests as http_requests

from database import (
    db, security, logger, RESEND_API_KEY,
    hash_password, verify_password, create_token, get_current_user,
    send_email_notification, manager,
    UserCreate, UserLogin, UserResponse, ForgotPasswordRequest,
    ResetPasswordRequest, ChangePasswordRequest
)
from content_filter import check_fields, is_severe

# OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ==================== REGISTRATION & LOGIN ====================

@router.post("/register")
async def register(user: UserCreate):
    try:
        logger.info(f"Registration attempt for email: {user.email}")

        # Content moderation on registration fields
        is_clean, violations = check_fields({"name": user.name, "company": user.company or ""})
        if not is_clean and is_severe(violations):
            raise HTTPException(status_code=400, detail="Registration contains prohibited content.")

        # Check if user exists
        existing = await db.users.find_one({"email": user.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        user_id = str(uuid.uuid4())
        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}"

        user_doc = {
            "id": user_id,
            "email": user.email,
            "password": hash_password(user.password),
            "name": user.name,
            "role": user.role,
            "company": user.company,
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
            "push_subscription": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        await db.users.insert_one(user_doc)
        logger.info(f"User created successfully: {user_id}")

        token = create_token(user_id, user.role)
        user_response = {k: v for k, v in user_doc.items() if k not in ['_id', 'password']}

        return {"token": token, "user": user_response}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

@router.post("/login")
async def login(credentials: UserLogin):
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
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email"""
    user = await db.users.find_one({"email": request.email})
    
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
        "email": request.email,
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
            request.email,
            "Reset Your Hireabble Password",
            email_html
        ))
    else:
        logger.warning(f"RESEND_API_KEY not configured. Reset link: {reset_link}")
    
    return {"message": "If an account exists with this email, a reset link has been sent."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    # Find token
    token_doc = await db.password_reset_tokens.find_one({"token": request.token})
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check expiration
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.password_reset_tokens.delete_one({"token": request.token})
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Update password
    hashed_password = hash_password(request.password)
    await db.users.update_one(
        {"id": token_doc["user_id"]},
        {"$set": {"password": hashed_password}}
    )
    
    # Delete used token
    await db.password_reset_tokens.delete_one({"token": request.token})
    
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
        "onboarding_complete", "push_subscription"
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
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user


# ==================== OAUTH / SSO ====================

async def _find_or_create_oauth_user(email: str, name: str, provider: str, role: str = "seeker"):
    """Find existing user by email or create a new one from OAuth data"""
    existing = await db.users.find_one({"email": email})
    if existing:
        # Link OAuth provider if not already linked
        providers = existing.get("oauth_providers", [])
        if provider not in providers:
            providers.append(provider)
            await db.users.update_one({"email": email}, {"$set": {"oauth_providers": providers}})
        token = create_token(existing["id"], existing["role"])
        user_response = {k: v for k, v in existing.items() if k not in ['_id', 'password']}
        return {"token": token, "user": user_response}

    # Create new user
    user_id = str(uuid.uuid4())
    avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}"
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(str(uuid.uuid4())),  # Random password for OAuth users
        "name": name,
        "role": role,
        "company": None,
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
        token_resp = http_requests.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }, timeout=10)
        token_data = token_resp.json()

        if "error" in token_data:
            raise HTTPException(status_code=400, detail=token_data.get("error_description", "Google auth failed"))

        # Get user info
        userinfo_resp = http_requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
            "Authorization": f"Bearer {token_data['access_token']}"
        }, timeout=10)
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
        token_resp = http_requests.post("https://github.com/login/oauth/access_token", json={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
        }, headers={"Accept": "application/json"}, timeout=10)
        token_data = token_resp.json()

        if "error" in token_data:
            raise HTTPException(status_code=400, detail=token_data.get("error_description", "GitHub auth failed"))

        access_token = token_data.get("access_token")

        # Get user info
        user_resp = http_requests.get("https://api.github.com/user", headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        }, timeout=10)
        github_user = user_resp.json()

        # Get primary email (may need separate call if email is private)
        email = github_user.get("email")
        if not email:
            emails_resp = http_requests.get("https://api.github.com/user/emails", headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"
            }, timeout=10)
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
        }
    }
