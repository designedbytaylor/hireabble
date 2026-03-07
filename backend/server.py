"""
Hireabble API - Main Server
A Tinder-style job matching platform

This is the main entry point that combines all routers.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
from datetime import datetime, timezone
import json
import uuid
import jwt as pyjwt

# Import database and shared utilities
from database import db, manager, UPLOADS_DIR, logger, JWT_SECRET, JWT_ALGORITHM, create_notification

# Import routers
from routers import auth, jobs, applications, matches, notifications, uploads, stats, admin, interviews

# Create the main app
app = FastAPI(
    title="Hireabble API",
    description="A Tinder-style job matching platform API",
    version="2.0.0"
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(matches.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")

# ==================== WEBSOCKET ====================

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time notifications and chat"""
    # Decode JWT token to get real user_id
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except pyjwt.InvalidTokenError:
        await websocket.accept()
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket, user_id)
    logger.info(f"WebSocket connected: {user_id}")

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Handle ping/pong for connection keep-alive
            if message_data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

            # Handle typing indicators
            elif message_data.get("type") == "typing":
                receiver_id = message_data.get("receiver_id")
                if receiver_id:
                    await manager.send_to_user(receiver_id, {
                        "type": "typing",
                        "sender_id": user_id,
                        "match_id": message_data.get("match_id"),
                        "is_typing": message_data.get("is_typing", True)
                    })

            # Handle chat messages sent via WebSocket
            elif message_data.get("type") == "message":
                match_id = message_data.get("match_id")
                content = message_data.get("content", "").strip()
                if not match_id or not content:
                    continue

                # Verify match exists and user is part of it
                match = await db.matches.find_one({"id": match_id}, {"_id": 0})
                if not match:
                    continue
                if match["seeker_id"] != user_id and match["recruiter_id"] != user_id:
                    continue

                # Determine receiver
                receiver_id = match["recruiter_id"] if user_id == match["seeker_id"] else match["seeker_id"]

                # Get sender info
                sender = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "avatar": 1, "photo_url": 1})
                sender_name = sender.get("name", "Unknown") if sender else "Unknown"
                sender_avatar = (sender.get("avatar") or sender.get("photo_url")) if sender else None

                # Save message to DB
                message_id = str(uuid.uuid4())
                message_doc = {
                    "id": message_id,
                    "match_id": match_id,
                    "sender_id": user_id,
                    "sender_name": sender_name,
                    "sender_avatar": sender_avatar,
                    "receiver_id": receiver_id,
                    "content": content,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "is_read": False
                }
                await db.messages.insert_one(message_doc)

                msg_response = {k: v for k, v in message_doc.items() if k != "_id"}

                # Send confirmation back to sender
                await manager.send_to_user(user_id, {
                    "type": "message_sent",
                    "message": msg_response
                })

                # Send to receiver
                await manager.send_to_user(receiver_id, {
                    "type": "new_message",
                    "message": msg_response
                })

                # Create notification for receiver
                await create_notification(
                    user_id=receiver_id,
                    notif_type="message",
                    title="New Message",
                    message=f"{sender_name}: {content[:50]}{'...' if len(content) > 50 else ''}",
                    data={"match_id": match_id, "message_id": message_id}
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"WebSocket disconnected: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {str(e)}")
        manager.disconnect(websocket, user_id)

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Hireabble API"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to Hireabble API",
        "version": "2.0.0",
        "docs": "/docs"
    }

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    """Initialize database indexes"""
    logger.info("Starting Hireabble API...")
    
    # Create indexes for better query performance
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.jobs.create_index("id", unique=True)
    await db.jobs.create_index("recruiter_id")
    await db.applications.create_index("id", unique=True)
    await db.applications.create_index([("job_id", 1), ("seeker_id", 1)])
    await db.matches.create_index("id", unique=True)
    await db.messages.create_index("match_id")
    await db.notifications.create_index([("user_id", 1), ("is_read", 1)])
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)

    # Admin & moderation indexes
    await db.admin_users.create_index("id", unique=True)
    await db.admin_users.create_index("email", unique=True)
    await db.reports.create_index("id", unique=True)
    await db.reports.create_index([("status", 1), ("created_at", -1)])
    await db.moderation_queue.create_index("id", unique=True)
    await db.moderation_queue.create_index([("status", 1), ("created_at", -1)])

    # Interview indexes
    await db.interviews.create_index("id", unique=True)
    await db.interviews.create_index([("created_by", 1), ("status", 1)])
    await db.interviews.create_index([("other_party_id", 1), ("status", 1)])

    logger.info("Database indexes created")
    logger.info("Hireabble API started successfully!")
