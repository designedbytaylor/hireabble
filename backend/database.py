"""
Shared database connection and utilities for Hireabble API
"""
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException, WebSocket
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
import os
import jwt
import bcrypt
import uuid
import logging
import asyncio

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection with connection pool tuning
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=200,          # max connections per worker (default 100)
    minPoolSize=10,           # keep 10 warm connections
    maxIdleTimeMS=45000,      # close idle connections after 45s
    connectTimeoutMS=5000,    # 5s connect timeout
    serverSelectionTimeoutMS=5000,
)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'jobswipe_secret_key_2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Supabase Storage Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')  # service_role key for storage uploads

# Security
security = HTTPBearer()

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== WEBSOCKET MANAGER ====================

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
                except Exception:
                    pass

manager = ConnectionManager()

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
    from cache import get_cached_user, set_cached_user
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Check cache first to avoid DB hit on every request
        user = get_cached_user(user_id)
        if not user:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            set_cached_user(user_id, user)

        # Block banned/suspended users from making API calls
        if user.get("status") == "banned":
            raise HTTPException(status_code=403, detail="Your account has been banned. Contact support for more info.")
        if user.get("status") == "suspended":
            raise HTTPException(status_code=403, detail="Your account is temporarily suspended. Contact support for more info.")

        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== EMAIL HELPERS ====================

async def send_email_notification(to_email: str, subject: str, html_content: str):
    """Send email notification asynchronously"""
    import resend
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return None
    
    try:
        resend.api_key = RESEND_API_KEY
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

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://hireabble.com')

def get_email_template(title: str, body_html: str, cta_text: str = None, cta_url: str = None, unsubscribe_url: str = None):
    """Generate branded HTML email template"""
    cta_block = ""
    if cta_text and cta_url:
        cta_block = f'<a href="{cta_url}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 40px; border-radius: 25px; text-decoration: none; font-weight: bold;">{cta_text}</a>'
    unsub_block = ""
    if unsubscribe_url:
        unsub_block = f'<p style="margin-top: 12px;"><a href="{unsubscribe_url}" style="color: #999; text-decoration: underline; font-size: 12px;">Unsubscribe from these emails</a></p>'
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">Hireabble</h1>
        </div>
        <div style="padding: 30px 20px; text-align: center;">
            <h2 style="color: #333; margin: 0 0 15px 0;">{title}</h2>
            <div style="color: #555; font-size: 16px; margin-bottom: 25px;">{body_html}</div>
            {cta_block}
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>Hireabble - Your career starts with a swipe</p>
            {unsub_block}
        </div>
    </div>
    """

def create_unsubscribe_token(user_id: str, notif_type: str) -> str:
    """Generate a signed JWT for one-click email unsubscribe"""
    payload = {"user_id": user_id, "type": notif_type, "action": "unsubscribe"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_unsubscribe_url(user_id: str, notif_type: str) -> str:
    """Build unsubscribe URL for email footer"""
    token = create_unsubscribe_token(user_id, notif_type)
    return f"{FRONTEND_URL}/api/notifications/unsubscribe?token={token}&type={notif_type}"

async def get_user_email_prefs(user_id: str) -> dict:
    """Get user's email notification preferences (defaults all true)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "email_notifications": 1})
    prefs = (user or {}).get("email_notifications", {})
    return {
        "matches": prefs.get("matches", True),
        "interviews": prefs.get("interviews", True),
        "messages": prefs.get("messages", True),
        "status_updates": prefs.get("status_updates", True),
    }

# ==================== NOTIFICATION HELPER ====================

async def send_web_push(user_id: str, title: str, body: str, push_data: dict = None):
    """Send a web push notification to a user's subscribed devices"""
    try:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "push_subscription": 1})
        subscription = user.get("push_subscription") if user else None
        if not subscription:
            return

        vapid_private_key = os.getenv("VAPID_PRIVATE_KEY", "")
        vapid_email = os.getenv("VAPID_EMAIL", "")
        if not vapid_private_key:
            return

        import json
        try:
            from pywebpush import webpush
            webpush(
                subscription_info=subscription,
                data=json.dumps({
                    "title": title,
                    "body": body,
                    "data": push_data or {},
                    "tag": f"hireabble-{push_data.get('type', 'notification') if push_data else 'notification'}",
                }),
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": f"mailto:{vapid_email}"}
            )
        except ImportError:
            logger.debug("pywebpush not installed, skipping web push")
        except Exception as e:
            logger.error(f"Web push failed: {e}")
    except Exception as e:
        logger.error(f"send_web_push error: {e}")


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

    # Send web push notification (non-blocking)
    import asyncio
    push_data = {**(data or {}), "type": notif_type}
    asyncio.create_task(send_web_push(user_id, title, message, push_data))

    return notification_doc


async def send_system_message(match_id: str, sender_id: str, sender_name: str, content: str, msg_type: str = "system", data: dict = None):
    """Send an auto-generated system message in a match conversation."""
    receiver_match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not receiver_match:
        return None

    receiver_id = receiver_match["recruiter_id"] if sender_id == receiver_match["seeker_id"] else receiver_match["seeker_id"]

    message_doc = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "receiver_id": receiver_id,
        "content": content,
        "message_type": msg_type,
        "data": data or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    await db.messages.insert_one(message_doc)

    # Update last message on the match
    await db.matches.update_one(
        {"id": match_id},
        {"$set": {
            "last_message": content[:100],
            "last_message_sender": sender_id,
            "last_message_at": message_doc["created_at"]
        }}
    )

    # Send via WebSocket
    await manager.send_to_user(receiver_id, {
        "type": "new_message",
        "message": {k: v for k, v in message_doc.items() if k != "_id"}
    })

    # Create a message notification so it shows in the notification bell
    await create_notification(
        user_id=receiver_id,
        notif_type="message",
        title="New Message",
        message=f"{sender_name}: {content[:50]}{'...' if len(content) > 50 else ''}",
        data={"match_id": match_id}
    )

    return message_doc


# ==================== PYDANTIC MODELS ====================

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
    video_url: Optional[str] = None
    current_employer: Optional[str] = None
    previous_employers: List[str] = []
    school: Optional[str] = None
    degree: Optional[str] = None
    certifications: List[str] = []
    work_preference: Optional[str] = None
    desired_salary: Optional[int] = None
    available_immediately: bool = True
    onboarding_complete: bool = False
    push_subscription: Optional[dict] = None
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
    location_restriction: Optional[str] = None  # 'any', 'specific', None
    category: Optional[str] = None  # 'technology', 'healthcare', 'finance', 'marketing', 'design', 'sales', 'engineering', 'education', 'other'
    employment_type: Optional[str] = "full-time"  # 'full-time', 'part-time', 'contract', 'internship'

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
    location_restriction: Optional[str] = None
    category: Optional[str] = None
    employment_type: Optional[str] = "full-time"
    match_score: Optional[int] = None
    created_at: str
    is_active: bool = True
    already_applied: Optional[bool] = None

class SwipeAction(BaseModel):
    job_id: str
    action: str  # 'like', 'pass', 'superlike'
    note: Optional[str] = None  # Premium: attach a note to Super Likes (max 140 chars)

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
    seeker_video: Optional[str] = None
    seeker_experience: Optional[int] = None
    seeker_school: Optional[str] = None
    seeker_degree: Optional[str] = None
    seeker_location: Optional[str] = None
    seeker_current_employer: Optional[str] = None
    job_title: Optional[str] = None
    action: str
    is_matched: bool = False
    recruiter_action: Optional[str] = None
    pipeline_stage: Optional[str] = "applied"
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
    last_message: Optional[str] = None
    last_message_sender: Optional[str] = None
    last_message_at: Optional[str] = None
    unread_count: Optional[int] = None

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
    message_type: Optional[str] = None
    data: Optional[dict] = None

class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str
    title: str
    message: str
    data: Optional[dict] = None
    is_read: bool = False
    created_at: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

# ==================== ADMIN MODELS ====================

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class ReportCreate(BaseModel):
    reported_type: str  # 'user', 'job', 'message'
    reported_id: str
    reason: str
    details: Optional[str] = None

# ==================== ADMIN AUTH ====================

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate admin users from the admin_users collection."""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        role = payload.get("role")
        if not user_id or role != "admin":
            raise HTTPException(status_code=401, detail="Invalid admin token")

        admin = await db.admin_users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not admin:
            raise HTTPException(status_code=401, detail="Admin not found")
        if admin.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Admin account is deactivated")
        # Ensure role field exists (default to "admin" for legacy records)
        if "role" not in admin:
            admin["role"] = "admin"
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
