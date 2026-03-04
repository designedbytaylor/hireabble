from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64

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

# Create the main app
app = FastAPI(title="Hireabble API")

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

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
    
    return {"message": f"Swiped {action.action}", "application_id": application_id}

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
    
    # If matched, create a match record
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
    
    # Update user's photo_url
    photo_url = f"/uploads/{filename}"
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"photo_url": photo_url}})
    
    return {"photo_url": photo_url, "message": "Photo uploaded successfully"}

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
