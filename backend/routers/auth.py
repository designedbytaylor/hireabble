"""
Authentication routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import uuid
import asyncio

from database import (
    db, security, logger, RESEND_API_KEY,
    hash_password, verify_password, create_token, get_current_user,
    send_email_notification, manager,
    UserCreate, UserLogin, UserResponse, ForgotPasswordRequest, 
    ResetPasswordRequest, ChangePasswordRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ==================== REGISTRATION & LOGIN ====================

@router.post("/register")
async def register(user: UserCreate):
    try:
        logger.info(f"Registration attempt for email: {user.email}")

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
    
    if update_data:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user
