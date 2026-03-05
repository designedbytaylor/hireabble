from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
import json
import io

# PDF Generation
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Email
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'jobswipe_secret_key_2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Create the main app
app = FastAPI(title="Hireabble API")

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # 'seeker' or 'recruiter'
    company: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    company: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    experience_years: Optional[int] = None
    location: Optional[str] = None
    avatar: Optional[str] = None
    photo_url: Optional[str] = None
    current_employer: Optional[str] = None
    previous_employers: List[str] = []
    school: Optional[str] = None
    degree: Optional[str] = None
    certifications: List[str] = []
    work_preference: Optional[str] = None
    desired_salary: Optional[int] = None
    available_immediately: bool = True
    onboarding_complete: bool = False
    created_at: str

class JobCreate(BaseModel):
    title: str
    company: str
    description: str
    requirements: List[str] = []
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    location: str
    job_type: str  # 'remote', 'onsite', 'hybrid'
    experience_level: str  # 'entry', 'mid', 'senior', 'lead'

class JobResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    company: str
    description: str
    requirements: List[str] = []
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    location: str
    job_type: str
    experience_level: str
    recruiter_id: str
    recruiter_name: str
    company_logo: Optional[str] = None
    background_image: Optional[str] = None
    created_at: str
    is_active: bool = True

class SwipeAction(BaseModel):
    job_id: str
    action: str  # 'like', 'pass', 'superlike'

class ApplicationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    job_id: str
    seeker_id: str
    seeker_name: str
    seeker_title: Optional[str] = None
    seeker_skills: List[str] = []
    seeker_avatar: Optional[str] = None
    seeker_photo: Optional[str] = None
    seeker_experience: Optional[int] = None
    seeker_school: Optional[str] = None
    seeker_degree: Optional[str] = None
    seeker_location: Optional[str] = None
    seeker_current_employer: Optional[str] = None
    action: str
    is_matched: bool = False
    recruiter_action: Optional[str] = None
    created_at: str

class RecruiterAction(BaseModel):
    application_id: str
    action: str  # 'accept' or 'reject'

class MatchResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    job_id: str
    job_title: str
    company: str
    seeker_id: str
    seeker_name: str
    seeker_avatar: Optional[str] = None
    recruiter_id: str
    recruiter_name: str
    created_at: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user: UserCreate):
    # Check if email exists
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
        "title": None,
        "bio": None,
        "skills": [],
        "experience_years": None,
        "location": None,
        "avatar": avatar,
        "photo_url": None,
        "current_employer": None,
        "previous_employers": [],
        "school": None,
        "degree": None,
        "certifications": [],
        "work_preference": None,
        "desired_salary": None,
        "available_immediately": True,
        "onboarding_complete": user.role == "recruiter",  # Recruiters skip onboarding
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user.role)
    
    del user_doc["password"]
    if "_id" in user_doc:
        del user_doc["_id"]
    
    return {"token": token, "user": user_doc}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    
    user_response = {k: v for k, v in user.items() if k not in ["_id", "password"]}
    return {"token": token, "user": user_response}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== FORGOT PASSWORD ====================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

@api_router.post("/auth/forgot-password")
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
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
                <p>© Hireabble - Your career starts with a swipe</p>
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

@api_router.post("/auth/reset-password")
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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
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

# ==================== NOTIFICATIONS ====================

class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str  # 'match', 'message', 'application'
    title: str
    message: str
    data: Optional[dict] = None
    is_read: bool = False
    created_at: str

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user), limit: int = 20):
    """Get notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications

@api_router.get("/notifications/unread/count")
async def get_unread_notifications_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"unread_count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

async def create_notification(user_id: str, notif_type: str, title: str, message: str, data: dict = None):
    """Helper function to create a notification"""
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "data": data or {},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send via WebSocket if user is connected
    await manager.send_to_user(user_id, {
        "type": "notification",
        "notification": {k: v for k, v in notification_doc.items() if k != "_id"}
    })
    
    return notification_doc

@api_router.put("/auth/profile")
async def update_profile(updates: dict, current_user: dict = Depends(get_current_user)):
    allowed_fields = [
        "name", "title", "bio", "skills", "experience_years", "location", "company",
        "photo_url", "current_employer", "previous_employers", "school", "degree",
        "certifications", "work_preference", "desired_salary", "available_immediately",
        "onboarding_complete"
    ]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user

# ==================== JOB ROUTES ====================

BACKGROUND_IMAGES = [
    "https://images.unsplash.com/photo-1765366417031-60bc8543189c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNoJTIwb2ZmaWNlJTIwc3RhcnR1cCUyMGludGVyaW9yfGVufDB8fHx8MTc3MjYyOTg0OXww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1652498196118-4577d5f6abd5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjB0ZWNoJTIwb2ZmaWNlJTIwc3RhcnR1cCUyMGludGVyaW9yfGVufDB8fHx8MTc3MjYyOTg0OXww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1559310415-1e164ccd653a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjB0ZWNoJTIwb2ZmaWNlJTIwc3RhcnR1cCUyMGludGVyaW9yfGVufDB8fHx8MTc3MjYyOTg0OXww&ixlib=rb-4.1.0&q=85"
]

@api_router.post("/jobs", response_model=JobResponse)
async def create_job(job: JobCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can post jobs")
    
    import random
    job_id = str(uuid.uuid4())
    company_logo = f"https://ui-avatars.com/api/?background=6366f1&color=fff&name={job.company.replace(' ', '+')}"
    
    job_doc = {
        "id": job_id,
        "title": job.title,
        "company": job.company,
        "description": job.description,
        "requirements": job.requirements,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "location": job.location,
        "job_type": job.job_type,
        "experience_level": job.experience_level,
        "recruiter_id": current_user["id"],
        "recruiter_name": current_user["name"],
        "company_logo": company_logo,
        "background_image": random.choice(BACKGROUND_IMAGES),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.jobs.insert_one(job_doc)
    return {k: v for k, v in job_doc.items() if k != "_id"}

@api_router.get("/jobs", response_model=List[JobResponse])
async def get_jobs(
    current_user: dict = Depends(get_current_user),
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    location: Optional[str] = None
):
    """Get jobs for job seekers (excluding already swiped jobs) with optional filters"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="This endpoint is for job seekers")
    
    # Get jobs already swiped by this user
    swiped = await db.applications.find({"seeker_id": current_user["id"]}, {"job_id": 1}).to_list(1000)
    swiped_job_ids = [s["job_id"] for s in swiped]
    
    # Build query with filters
    query = {"is_active": True}
    if swiped_job_ids:
        query["id"] = {"$nin": swiped_job_ids}
    
    # Apply filters
    if job_type:
        query["job_type"] = job_type
    if experience_level:
        query["experience_level"] = experience_level
    if salary_min:
        query["$or"] = [
            {"salary_max": {"$gte": salary_min}},
            {"salary_min": {"$gte": salary_min}}
        ]
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return jobs

@api_router.get("/jobs/recruiter", response_model=List[JobResponse])
async def get_recruiter_jobs(current_user: dict = Depends(get_current_user)):
    """Get jobs posted by current recruiter"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="This endpoint is for recruiters")
    
    jobs = await db.jobs.find({"recruiter_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return jobs

@api_router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.jobs.update_one({"id": job_id}, {"$set": {"is_active": False}})
    return {"message": "Job deleted"}

@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    """Update a job posting"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can edit jobs")
    
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_fields = [
        "title", "company", "description", "requirements", "salary_min", "salary_max",
        "location", "job_type", "experience_level", "is_active"
    ]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if update_data:
        await db.jobs.update_one({"id": job_id}, {"$set": update_data})
    
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return updated_job

# ==================== APPLICATION/SWIPE ROUTES ====================

DAILY_SUPERLIKE_LIMIT = 3

@api_router.get("/superlikes/remaining")
async def get_remaining_superlikes(current_user: dict = Depends(get_current_user)):
    """Get remaining super likes for today"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can access this")
    
    # Get today's date range
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Count super likes used today
    superlikes_today = await db.applications.count_documents({
        "seeker_id": current_user["id"],
        "action": "superlike",
        "created_at": {
            "$gte": today_start.isoformat(),
            "$lt": today_end.isoformat()
        }
    })
    
    return {
        "remaining": max(0, DAILY_SUPERLIKE_LIMIT - superlikes_today),
        "used_today": superlikes_today,
        "daily_limit": DAILY_SUPERLIKE_LIMIT
    }

@api_router.post("/swipe")
async def swipe(action: SwipeAction, current_user: dict = Depends(get_current_user)):
    """Job seeker swipes on a job"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can swipe")
    
    # Check if already swiped
    existing = await db.applications.find_one({
        "job_id": action.job_id,
        "seeker_id": current_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already swiped on this job")
    
    # Check super like limit for today
    if action.action == "superlike":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        superlikes_today = await db.applications.count_documents({
            "seeker_id": current_user["id"],
            "action": "superlike",
            "created_at": {
                "$gte": today_start.isoformat(),
                "$lt": today_end.isoformat()
            }
        })
        
        if superlikes_today >= DAILY_SUPERLIKE_LIMIT:
            raise HTTPException(
                status_code=400, 
                detail=f"Daily Super Like limit reached ({DAILY_SUPERLIKE_LIMIT}/day). Try again tomorrow!"
            )
    
    # Get job details
    job = await db.jobs.find_one({"id": action.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    application_id = str(uuid.uuid4())
    application_doc = {
        "id": application_id,
        "job_id": action.job_id,
        "seeker_id": current_user["id"],
        "seeker_name": current_user["name"],
        "seeker_title": current_user.get("title"),
        "seeker_skills": current_user.get("skills", []),
        "seeker_avatar": current_user.get("avatar"),
        "seeker_photo": current_user.get("photo_url"),
        "seeker_experience": current_user.get("experience_years"),
        "seeker_school": current_user.get("school"),
        "seeker_degree": current_user.get("degree"),
        "seeker_location": current_user.get("location"),
        "seeker_current_employer": current_user.get("current_employer"),
        "recruiter_id": job["recruiter_id"],
        "action": action.action,
        "is_matched": False,
        "recruiter_action": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.applications.insert_one(application_doc)
    
    # Return remaining super likes if it was a superlike action
    remaining_superlikes = None
    if action.action == "superlike":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        superlikes_today = await db.applications.count_documents({
            "seeker_id": current_user["id"],
            "action": "superlike",
            "created_at": {
                "$gte": today_start.isoformat(),
                "$lt": today_end.isoformat()
            }
        })
        remaining_superlikes = DAILY_SUPERLIKE_LIMIT - superlikes_today
    
    return {
        "message": f"Swiped {action.action}", 
        "application_id": application_id,
        "remaining_superlikes": remaining_superlikes
    }

@api_router.get("/applications", response_model=List[ApplicationResponse])
async def get_applications(current_user: dict = Depends(get_current_user)):
    """Get applications - for seekers: their applications, for recruiters: applications to their jobs"""
    if current_user["role"] == "seeker":
        applications = await db.applications.find(
            {"seeker_id": current_user["id"], "action": {"$in": ["like", "superlike"]}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    else:
        applications = await db.applications.find(
            {"recruiter_id": current_user["id"], "action": {"$in": ["like", "superlike"]}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    
    return applications

@api_router.get("/applications/job/{job_id}", response_model=List[ApplicationResponse])
async def get_job_applications(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get applications for a specific job (recruiter only)"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view job applications")
    
    job = await db.jobs.find_one({"id": job_id})
    if not job or job["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    applications = await db.applications.find(
        {"job_id": job_id, "action": {"$in": ["like", "superlike"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return applications

@api_router.post("/applications/respond")
async def respond_to_application(response: RecruiterAction, current_user: dict = Depends(get_current_user)):
    """Recruiter accepts or rejects an application"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can respond to applications")
    
    application = await db.applications.find_one({"id": response.application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if application["recruiter_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_matched = response.action == "accept"
    
    await db.applications.update_one(
        {"id": response.application_id},
        {"$set": {"recruiter_action": response.action, "is_matched": is_matched}}
    )
    
    # If matched, create a match record and send notifications
    if is_matched:
        job = await db.jobs.find_one({"id": application["job_id"]}, {"_id": 0})
        match_doc = {
            "id": str(uuid.uuid4()),
            "application_id": response.application_id,
            "job_id": application["job_id"],
            "job_title": job["title"] if job else "Unknown",
            "company": job["company"] if job else "Unknown",
            "seeker_id": application["seeker_id"],
            "seeker_name": application["seeker_name"],
            "seeker_avatar": application.get("seeker_avatar"),
            "recruiter_id": current_user["id"],
            "recruiter_name": current_user["name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.matches.insert_one(match_doc)
        
        # Create in-app notification for seeker
        await create_notification(
            user_id=application["seeker_id"],
            notif_type="match",
            title="It's a Match!",
            message=f"{job['company'] if job else 'A company'} accepted your application for {job['title'] if job else 'a position'}!",
            data={"match_id": match_doc["id"], "job_id": application["job_id"]}
        )
        
        # Send WebSocket notification to seeker
        await manager.send_to_user(application["seeker_id"], {
            "type": "new_match",
            "match": {k: v for k, v in match_doc.items() if k != "_id"}
        })
        
        # Send email notification to seeker
        seeker = await db.users.find_one({"id": application["seeker_id"]}, {"_id": 0, "email": 1})
        if seeker and seeker.get("email"):
            asyncio.create_task(send_email_notification(
                seeker["email"],
                f"You matched with {job['company'] if job else 'a company'} on Hireabble!",
                get_match_email_html(
                    job["title"] if job else "Unknown",
                    job["company"] if job else "Unknown",
                    current_user["name"],
                    is_seeker=True
                )
            ))
    
    return {"message": "Response recorded", "is_matched": is_matched}

# ==================== MATCH ROUTES ====================

@api_router.get("/matches", response_model=List[MatchResponse])
async def get_matches(current_user: dict = Depends(get_current_user)):
    """Get all matches for current user"""
    if current_user["role"] == "seeker":
        matches = await db.matches.find({"seeker_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        matches = await db.matches.find({"recruiter_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return matches

# ==================== STATS ROUTES ====================

@api_router.get("/stats/recruiter")
async def get_recruiter_stats(current_user: dict = Depends(get_current_user)):
    """Get stats for recruiter dashboard"""
    if current_user["role"] != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access this")
    
    jobs_count = await db.jobs.count_documents({"recruiter_id": current_user["id"], "is_active": True})
    applications_count = await db.applications.count_documents({
        "recruiter_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    })
    superlikes_count = await db.applications.count_documents({
        "recruiter_id": current_user["id"],
        "action": "superlike"
    })
    matches_count = await db.matches.count_documents({"recruiter_id": current_user["id"]})
    
    return {
        "active_jobs": jobs_count,
        "total_applications": applications_count,
        "super_likes": superlikes_count,
        "matches": matches_count
    }

@api_router.get("/stats/seeker")
async def get_seeker_stats(current_user: dict = Depends(get_current_user)):
    """Get stats for job seeker dashboard"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can access this")
    
    applications_count = await db.applications.count_documents({
        "seeker_id": current_user["id"],
        "action": {"$in": ["like", "superlike"]}
    })
    superlikes_count = await db.applications.count_documents({
        "seeker_id": current_user["id"],
        "action": "superlike"
    })
    matches_count = await db.matches.count_documents({"seeker_id": current_user["id"]})
    
    return {
        "applications_sent": applications_count,
        "super_likes_used": superlikes_count,
        "matches": matches_count
    }

@api_router.get("/users/{user_id}")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a user's public profile"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "email": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ==================== PHOTO UPLOAD ====================

@api_router.post("/upload/photo")
async def upload_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload a profile photo"""
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Limit file size (5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Update user's photo_url - use API route for serving
    photo_url = f"/api/photos/{filename}"
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"photo_url": photo_url}})
    
    return {"photo_url": photo_url, "message": "Photo uploaded successfully"}

@api_router.get("/photos/{filename}")
async def get_photo(filename: str):
    """Serve uploaded photos"""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    content_type = content_types.get(ext, 'image/jpeg')
    
    return StreamingResponse(
        open(filepath, "rb"),
        media_type=content_type
    )

# ==================== MESSAGING ====================

class MessageCreate(BaseModel):
    match_id: str
    content: str

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    match_id: str
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    content: str
    created_at: str
    is_read: bool = False

@api_router.post("/messages")
async def send_message(message: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message in a match conversation"""
    # Verify match exists and user is part of it
    match = await db.matches.find_one({"id": message.match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user["id"] not in [match["seeker_id"], match["recruiter_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized to message in this match")
    
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "match_id": message.match_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "sender_avatar": current_user.get("photo_url") or current_user.get("avatar"),
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    
    await db.messages.insert_one(message_doc)
    
    # Update last_message on match for preview
    await db.matches.update_one(
        {"id": message.match_id},
        {"$set": {
            "last_message": message.content[:100],
            "last_message_at": message_doc["created_at"],
            "last_message_sender": current_user["id"]
        }}
    )
    
    return {k: v for k, v in message_doc.items() if k != "_id"}

@api_router.get("/messages/{match_id}", response_model=List[MessageResponse])
async def get_messages(match_id: str, current_user: dict = Depends(get_current_user)):
    """Get all messages for a match conversation"""
    # Verify match exists and user is part of it
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user["id"] not in [match["seeker_id"], match["recruiter_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    # Mark messages as read
    await db.messages.update_many(
        {"match_id": match_id, "sender_id": {"$ne": current_user["id"]}, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return messages

@api_router.get("/messages/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread messages across all matches"""
    # Get user's matches
    if current_user["role"] == "seeker":
        match_query = {"seeker_id": current_user["id"]}
    else:
        match_query = {"recruiter_id": current_user["id"]}
    
    matches = await db.matches.find(match_query, {"id": 1}).to_list(100)
    match_ids = [m["id"] for m in matches]
    
    if not match_ids:
        return {"unread_count": 0}
    
    unread_count = await db.messages.count_documents({
        "match_id": {"$in": match_ids},
        "sender_id": {"$ne": current_user["id"]},
        "is_read": False
    })
    
    return {"unread_count": unread_count}

# ==================== EMAIL HELPERS ====================

async def send_email_notification(to_email: str, subject: str, html_content: str):
    """Send email notification asynchronously"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return None
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {result.get('id')}")
        return result
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return None

def get_match_email_html(job_title: str, company: str, other_name: str, is_seeker: bool):
    """Generate match notification email HTML"""
    if is_seeker:
        message = f"Great news! {company} has accepted your application for <strong>{job_title}</strong>."
        cta = "Log in to Hireabble to start chatting with the recruiter."
    else:
        message = f"<strong>{other_name}</strong> has matched with your job posting for <strong>{job_title}</strong>."
        cta = "Log in to Hireabble to view their profile and start a conversation."
    
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">Hireabble</h1>
        </div>
        <div style="background: linear-gradient(135deg, #6366f1 0%, #d946ef 100%); padding: 30px; border-radius: 16px; text-align: center; color: white;">
            <h2 style="margin: 0 0 10px 0;">It's a Match! 🎉</h2>
            <p style="margin: 0; font-size: 18px;">{message}</p>
        </div>
        <div style="padding: 30px 0; text-align: center;">
            <p style="color: #666; font-size: 16px;">{cta}</p>
            <a href="https://hireabble.com/matches" style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; margin-top: 15px;">View Match</a>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>You received this email because you have notifications enabled on Hireabble.</p>
        </div>
    </div>
    """

def get_message_email_html(sender_name: str, message_preview: str, job_title: str):
    """Generate new message notification email HTML"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">Hireabble</h1>
        </div>
        <div style="background: #f8f9fa; padding: 25px; border-radius: 16px; border-left: 4px solid #6366f1;">
            <h3 style="margin: 0 0 10px 0; color: #333;">New message from {sender_name}</h3>
            <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">Regarding: {job_title}</p>
            <p style="margin: 0; color: #333; font-style: italic;">"{message_preview[:150]}{'...' if len(message_preview) > 150 else ''}"</p>
        </div>
        <div style="padding: 25px 0; text-align: center;">
            <a href="https://hireabble.com/matches" style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">Reply Now</a>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>You received this email because you have notifications enabled on Hireabble.</p>
        </div>
    </div>
    """

# ==================== PDF RESUME GENERATION ====================

@api_router.get("/resume/download")
async def download_resume(current_user: dict = Depends(get_current_user)):
    """Generate and download PDF resume for job seeker"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can download resumes")
    
    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=0.75*inch, leftMargin=0.75*inch, topMargin=0.75*inch, bottomMargin=0.75*inch)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#6366f1'), alignment=TA_CENTER, spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, textColor=colors.gray, alignment=TA_CENTER, spaceAfter=20)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#6366f1'), spaceBefore=15, spaceAfter=8, borderPadding=(0, 0, 3, 0))
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, textColor=colors.black, spaceAfter=6)
    
    elements = []
    
    # Header - Name and Title
    elements.append(Paragraph(current_user.get("name", ""), title_style))
    
    title_parts = []
    if current_user.get("title"):
        title_parts.append(current_user["title"])
    if current_user.get("location"):
        title_parts.append(current_user["location"])
    if title_parts:
        elements.append(Paragraph(" | ".join(title_parts), subtitle_style))
    
    # Contact
    contact_info = []
    if current_user.get("email"):
        contact_info.append(current_user["email"])
    if contact_info:
        elements.append(Paragraph(" • ".join(contact_info), ParagraphStyle('Contact', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, spaceAfter=20)))
    
    elements.append(Spacer(1, 10))
    
    # Professional Summary / Bio
    if current_user.get("bio"):
        elements.append(Paragraph("PROFESSIONAL SUMMARY", section_style))
        elements.append(Paragraph(current_user["bio"], body_style))
    
    # Experience
    if current_user.get("current_employer") or current_user.get("previous_employers"):
        elements.append(Paragraph("EXPERIENCE", section_style))
        if current_user.get("current_employer"):
            exp_years = current_user.get("experience_years", "")
            exp_text = f"<b>Current:</b> {current_user['current_employer']}"
            if exp_years:
                exp_text += f" ({exp_years}+ years)"
            elements.append(Paragraph(exp_text, body_style))
        if current_user.get("previous_employers"):
            for employer in current_user["previous_employers"]:
                elements.append(Paragraph(f"• {employer}", body_style))
    
    # Education
    if current_user.get("school") or current_user.get("degree"):
        elements.append(Paragraph("EDUCATION", section_style))
        edu_text = ""
        if current_user.get("degree"):
            degree_map = {
                "high_school": "High School Diploma",
                "some_college": "Some College",
                "associates": "Associate's Degree",
                "bachelors": "Bachelor's Degree",
                "masters": "Master's Degree",
                "phd": "PhD / Doctorate",
                "bootcamp": "Professional Certification",
                "self_taught": "Self-Taught",
                "no_degree": ""
            }
            edu_text = degree_map.get(current_user["degree"], current_user["degree"])
        if current_user.get("school"):
            if edu_text:
                edu_text += f" - {current_user['school']}"
            else:
                edu_text = current_user["school"]
        if edu_text:
            elements.append(Paragraph(edu_text, body_style))
    
    # Skills
    if current_user.get("skills"):
        elements.append(Paragraph("SKILLS", section_style))
        skills_text = " • ".join(current_user["skills"])
        elements.append(Paragraph(skills_text, body_style))
    
    # Certifications
    if current_user.get("certifications"):
        elements.append(Paragraph("CERTIFICATIONS", section_style))
        for cert in current_user["certifications"]:
            elements.append(Paragraph(f"• {cert}", body_style))
    
    # Preferences
    prefs = []
    if current_user.get("work_preference"):
        pref_map = {"remote": "Remote", "onsite": "On-site", "hybrid": "Hybrid", "flexible": "Flexible"}
        prefs.append(f"Work Style: {pref_map.get(current_user['work_preference'], current_user['work_preference'])}")
    if current_user.get("available_immediately"):
        prefs.append("Available Immediately")
    if prefs:
        elements.append(Paragraph("PREFERENCES", section_style))
        elements.append(Paragraph(" | ".join(prefs), body_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Generate filename
    filename = f"{current_user.get('name', 'resume').replace(' ', '_')}_Resume.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== PROFILE COMPLETENESS ====================

@api_router.get("/profile/completeness")
async def get_profile_completeness(current_user: dict = Depends(get_current_user)):
    """Calculate profile completeness percentage"""
    if current_user["role"] != "seeker":
        return {"percentage": 100, "missing_fields": []}
    
    # Define fields and their weights
    fields = {
        "photo_url": {"weight": 15, "label": "Profile Photo"},
        "title": {"weight": 20, "label": "Job Title"},
        "experience_years": {"weight": 15, "label": "Years of Experience"},
        "current_employer": {"weight": 10, "label": "Current Employer"},
        "school": {"weight": 10, "label": "Education"},
        "skills": {"weight": 20, "label": "Skills"},
        "location": {"weight": 10, "label": "Location"},
    }
    
    total = 0
    missing = []
    
    for field, info in fields.items():
        value = current_user.get(field)
        if value and (not isinstance(value, list) or len(value) > 0):
            total += info["weight"]
        else:
            missing.append(info["label"])
    
    return {
        "percentage": total,
        "missing_fields": missing,
        "is_complete": total >= 80
    }

# ==================== WEBSOCKET ====================

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time messaging"""
    try:
        # Verify token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            await websocket.close(code=4001)
            return
        
        await manager.connect(websocket, user_id)
        logger.info(f"WebSocket connected for user {user_id}")
        
        try:
            while True:
                # Keep connection alive and handle incoming messages
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                if message_data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message_data.get("type") == "message":
                    # Handle new message
                    match_id = message_data.get("match_id")
                    content = message_data.get("content")
                    
                    if not match_id or not content:
                        continue
                    
                    # Verify match and get recipient
                    match = await db.matches.find_one({"id": match_id})
                    if not match or user_id not in [match["seeker_id"], match["recruiter_id"]]:
                        continue
                    
                    # Get sender info
                    sender = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "avatar": 1, "photo_url": 1})
                    
                    # Create message
                    message_id = str(uuid.uuid4())
                    message_doc = {
                        "id": message_id,
                        "match_id": match_id,
                        "sender_id": user_id,
                        "sender_name": sender.get("name", "Unknown"),
                        "sender_avatar": sender.get("photo_url") or sender.get("avatar"),
                        "content": content,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "is_read": False
                    }
                    await db.messages.insert_one(message_doc)
                    
                    # Update match last_message
                    await db.matches.update_one(
                        {"id": match_id},
                        {"$set": {
                            "last_message": content[:100],
                            "last_message_at": message_doc["created_at"],
                            "last_message_sender": user_id
                        }}
                    )
                    
                    # Get recipient ID
                    recipient_id = match["recruiter_id"] if user_id == match["seeker_id"] else match["seeker_id"]
                    
                    # Send to recipient via WebSocket
                    await manager.send_to_user(recipient_id, {
                        "type": "new_message",
                        "message": {k: v for k, v in message_doc.items() if k != "_id"}
                    })
                    
                    # Send confirmation to sender
                    await websocket.send_json({
                        "type": "message_sent",
                        "message": {k: v for k, v in message_doc.items() if k != "_id"}
                    })
                    
                    # Send email notification (non-blocking)
                    recipient = await db.users.find_one({"id": recipient_id}, {"_id": 0, "email": 1, "name": 1})
                    if recipient and recipient.get("email"):
                        asyncio.create_task(send_email_notification(
                            recipient["email"],
                            f"New message from {sender.get('name', 'Someone')} on Hireabble",
                            get_message_email_html(sender.get("name", "Someone"), content, match.get("job_title", "your match"))
                        ))
                        
        except WebSocketDisconnect:
            manager.disconnect(websocket, user_id)
            logger.info(f"WebSocket disconnected for user {user_id}")
    except jwt.InvalidTokenError:
        await websocket.close(code=4001)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close(code=4000)

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Hireabble API", "version": "1.0.0"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
