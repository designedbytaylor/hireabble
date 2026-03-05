"""
File uploads routes for Hireabble API — Supabase Storage
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import RedirectResponse
from supabase import create_client
import uuid
import os

from database import (
    db, get_current_user, SUPABASE_URL, SUPABASE_KEY, logger
)

router = APIRouter(tags=["Uploads"])

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB

PHOTO_BUCKET = "photos"
VIDEO_BUCKET = "videos"


def _get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Storage not configured")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _public_url(bucket: str, path: str) -> str:
    """Build the public URL for a stored object."""
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


@router.post("/upload/photo")
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile photo to Supabase Storage"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"

    supabase = _get_supabase()

    # Remove old photo if it exists in the bucket
    user = await db.users.find_one({"id": current_user["id"]})
    if user and user.get("photo_url") and SUPABASE_URL in (user.get("photo_url") or ""):
        old_path = user["photo_url"].split(f"/{PHOTO_BUCKET}/")[-1]
        try:
            supabase.storage.from_(PHOTO_BUCKET).remove([old_path])
        except Exception:
            pass  # old file may already be gone

    # Upload to Supabase Storage
    try:
        supabase.storage.from_(PHOTO_BUCKET).upload(
            filename,
            contents,
            file_options={"content-type": file.content_type}
        )
    except Exception as e:
        logger.error(f"Supabase upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload photo")

    photo_url = _public_url(PHOTO_BUCKET, filename)

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
    """Upload a video introduction to Supabase Storage"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can upload video intros")

    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Only video files (MP4, WebM, MOV) are allowed")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Video size exceeds 50MB limit")

    ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp4'
    filename = f"video_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"

    supabase = _get_supabase()

    # Remove old video if it exists
    user = await db.users.find_one({"id": current_user["id"]})
    if user and user.get("video_url") and SUPABASE_URL in (user.get("video_url") or ""):
        old_path = user["video_url"].split(f"/{VIDEO_BUCKET}/")[-1]
        try:
            supabase.storage.from_(VIDEO_BUCKET).remove([old_path])
        except Exception:
            pass

    try:
        supabase.storage.from_(VIDEO_BUCKET).upload(
            filename,
            contents,
            file_options={"content-type": file.content_type}
        )
    except Exception as e:
        logger.error(f"Supabase video upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload video")

    video_url = _public_url(VIDEO_BUCKET, filename)

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"video_url": video_url}}
    )

    logger.info(f"Video uploaded for user {current_user['id']}: {filename}")
    return {"video_url": video_url, "filename": filename}


@router.delete("/upload/video")
async def delete_video(current_user: dict = Depends(get_current_user)):
    """Delete video introduction from Supabase Storage"""
    if current_user["role"] != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can manage video intros")

    user = await db.users.find_one({"id": current_user["id"]})
    if user and user.get("video_url"):
        # Delete from Supabase if it's a Supabase URL
        if SUPABASE_URL and SUPABASE_URL in (user.get("video_url") or ""):
            old_path = user["video_url"].split(f"/{VIDEO_BUCKET}/")[-1]
            try:
                supabase = _get_supabase()
                supabase.storage.from_(VIDEO_BUCKET).remove([old_path])
            except Exception:
                pass

        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"video_url": None}}
        )
        logger.info(f"Video deleted for user {current_user['id']}")

    return {"message": "Video deleted successfully"}
