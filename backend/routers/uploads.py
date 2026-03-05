"""
File uploads routes for Hireabble API
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
import os

from database import (
    db, get_current_user, UPLOADS_DIR, logger
)

router = APIRouter(tags=["Uploads"])

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile photo"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Read and check size
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, 'wb') as f:
        f.write(contents)
    
    # Update user profile with photo URL
    photo_url = f"/api/photos/{filename}"
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"photo_url": photo_url}}
    )
    
    logger.info(f"Photo uploaded for user {current_user['id']}: {filename}")
    
    return {"photo_url": photo_url, "filename": filename}

@router.post("/upload/video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a video introduction"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can upload video intros")
    
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Only video files (MP4, WebM, MOV) are allowed")
    
    # Read and check size
    contents = await file.read()
    if len(contents) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Video size exceeds 50MB limit")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp4'
    filename = f"video_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, 'wb') as f:
        f.write(contents)
    
    # Update user profile with video URL
    video_url = f"/api/videos/{filename}"
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"video_url": video_url}}
    )
    
    logger.info(f"Video uploaded for user {current_user['id']}: {filename}")
    
    return {"video_url": video_url, "filename": filename}

@router.delete("/upload/video")
async def delete_video(current_user: dict = Depends(get_current_user)):
    """Delete video introduction"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can manage video intros")
    
    user = await db.users.find_one({"id": current_user["id"]})
    if user and user.get("video_url"):
        # Extract filename from URL
        filename = user["video_url"].split("/")[-1]
        filepath = UPLOADS_DIR / filename
        
        # Delete file if exists
        if filepath.exists():
            os.remove(filepath)
        
        # Update user profile
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"video_url": None}}
        )
        
        logger.info(f"Video deleted for user {current_user['id']}")
    
    return {"message": "Video deleted successfully"}

@router.get("/photos/{filename}")
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
    
    return FileResponse(filepath, media_type=content_type)

@router.get("/videos/{filename}")
async def get_video(filename: str):
    """Serve uploaded videos"""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo'
    }
    content_type = content_types.get(ext, 'video/mp4')
    
    return FileResponse(filepath, media_type=content_type)
