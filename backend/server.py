"""
Hireabble API - Main Server
A Tinder-style job matching platform

This is the main entry point that combines all routers.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import json

# Import database and shared utilities
from database import db, manager, UPLOADS_DIR, logger

# Import routers
from routers import auth, jobs, applications, matches, notifications, uploads, stats, admin

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

# ==================== WEBSOCKET ====================

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time notifications and chat"""
    await manager.connect(websocket, user_id)
    logger.info(f"WebSocket connected: {user_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle ping/pong for connection keep-alive
            if message_data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
            # Handle chat messages
            elif message_data.get("type") == "chat":
                receiver_id = message_data.get("receiver_id")
                if receiver_id:
                    await manager.send_to_user(receiver_id, {
                        "type": "chat_message",
                        "sender_id": user_id,
                        "content": message_data.get("content"),
                        "match_id": message_data.get("match_id")
                    })
                    
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

    logger.info("Database indexes created")
    logger.info("Hireabble API started successfully!")
