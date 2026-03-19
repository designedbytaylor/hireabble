"""
Hireabble API - Main Server
A Tinder-style job matching platform

This is the main entry point that combines all routers.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from brotli_asgi import BrotliMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pathlib import Path
from datetime import datetime, timezone
import json
import uuid
import jwt as pyjwt
import os as _os_sentry

# Sentry error tracking
_sentry_dsn = _os_sentry.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.1,
        environment=_os_sentry.getenv("ENVIRONMENT", "production"),
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )

# Import database and shared utilities
from database import db, manager, UPLOADS_DIR, logger, JWT_SECRET, JWT_ALGORITHM, create_notification
from content_filter import check_text, is_severe

# Import routers
from routers import auth, jobs, applications, matches, notifications, uploads, stats, admin, interviews, payments, support, users

# Rate limiter — uses remote IP address by default
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

# Create the main app
app = FastAPI(
    title="Hireabble API",
    description="A Tinder-style job matching platform API",
    version="2.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Mount static files for uploads
# Note: Security headers for uploads (Content-Disposition, X-Content-Type-Options)
# are set in the add_security_headers middleware below
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Brotli compression first (15-20% smaller than gzip), GZip as fallback
app.add_middleware(BrotliMiddleware, minimum_size=500)
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS middleware — restrict to known origins in production
import os as _os
_frontend_url = _os.getenv("FRONTEND_URL", "https://hireabble.com")
_environment = _os.getenv("ENVIRONMENT", "development")
_cors_origins = [
    "capacitor://localhost",   # iOS Capacitor native app
    "https://localhost",       # iOS Capacitor WKWebView (iosScheme: https)
]
# Only allow localhost dev origins in development
if _environment == "development":
    _cors_origins.extend(["http://localhost:3000", "http://localhost:3001"])
if _frontend_url:
    _cors_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://(hireabble[a-z0-9-]*\.vercel\.app|hireabble[a-z0-9-]*\.up\.railway\.app|(www\.)?hireabble\.com)",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# CSRF protection — verify Origin header on state-changing requests
@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    # Only check state-changing methods
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        # Skip for webhooks and health checks
        path = request.url.path
        if path.startswith("/api/payments/stripe/webhook") or path == "/api/health":
            return await call_next(request)

        origin = request.headers.get("origin") or ""
        referer = request.headers.get("referer") or ""

        # Allow requests with no origin (non-browser clients, mobile apps)
        if not origin and not referer:
            return await call_next(request)

        # Check origin against allowed list
        allowed_patterns = [
            "http://localhost:3000",
            "http://localhost:3001",
            "capacitor://localhost",
            "https://localhost",
        ]
        if _frontend_url:
            allowed_patterns.append(_frontend_url)

        origin_valid = False
        check_value = origin or referer
        for pattern in allowed_patterns:
            if check_value.startswith(pattern):
                origin_valid = True
                break

        # Also allow Vercel/Railway preview deployments and hireabble.com
        import re as _csrf_re
        if not origin_valid and _csrf_re.match(
            r"https://(hireabble[a-z0-9-]*\.vercel\.app|hireabble[a-z0-9-]*\.up\.railway\.app|(www\.)?hireabble\.com)",
            check_value
        ):
            origin_valid = True

        if not origin_valid:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid origin"}
            )

    return await call_next(request)


# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://fonts.googleapis.com https://apis.google.com; "
        "style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' https: wss:; "
        "frame-src 'self' https://accounts.google.com https://appleid.apple.com; "
        "object-src 'none'; "
        "base-uri 'self'"
    )
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    # Force uploaded files to download (prevents inline rendering of malicious SVG/HTML)
    if request.url.path.startswith("/uploads/"):
        response.headers["Content-Disposition"] = "attachment"
        response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Cache headers — tell browsers what they can cache to avoid redundant requests
@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    # Long cache for uploaded media (images, videos)
    if path.startswith("/uploads/"):
        response.headers["Cache-Control"] = "public, max-age=3600, immutable"
    # Static/health endpoints
    elif path in ("/api/health", "/"):
        response.headers["Cache-Control"] = "public, max-age=60"
    # Read-only API data that changes infrequently — browser can reuse for 30s
    elif path in ("/api/oauth/config",):
        response.headers["Cache-Control"] = "public, max-age=30"
    # Batched dashboard endpoints — short cache for snappy back-nav
    elif path in ("/api/dashboard", "/api/recruiter/dashboard-data"):
        response.headers["Cache-Control"] = "private, max-age=10, stale-while-revalidate=30"
    # User-specific data — private cache, short TTL to reduce refetches on back-nav
    elif path.startswith("/api/stats") or path.startswith("/api/profile/completeness") or path.startswith("/api/superlikes/remaining"):
        response.headers["Cache-Control"] = "private, max-age=15, stale-while-revalidate=30"
    # Auth check — very short cache to avoid re-calling on every navigation
    elif path == "/api/auth/me":
        response.headers["Cache-Control"] = "no-store"
    # Notifications — short cache
    elif path.startswith("/api/notifications"):
        response.headers["Cache-Control"] = "private, max-age=5, stale-while-revalidate=15"
    # Jobs/matches listing — stale-while-revalidate for snappy back-nav
    elif request.method == "GET" and (path.startswith("/api/jobs") or path.startswith("/api/matches")):
        response.headers["Cache-Control"] = "private, max-age=10, stale-while-revalidate=30"
    return response

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
app.include_router(payments.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(users.router, prefix="/api")

# ==================== WEBSOCKET ====================

async def _ws_message_loop(websocket: WebSocket, user_id: str):
    """Shared WebSocket message-handling loop for both /ws and /ws/{token} endpoints."""
    # Per-user message rate limiting (max 30 messages per 60 seconds)
    _ws_msg_times: list = []
    _WS_RATE_LIMIT = 30
    _WS_RATE_WINDOW = 60  # seconds

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Rate limit check for chat messages (skip pings/typing)
            import time as _time
            if message_data.get("type") == "message":
                now = _time.monotonic()
                _ws_msg_times = [t for t in _ws_msg_times if now - t < _WS_RATE_WINDOW]
                if len(_ws_msg_times) >= _WS_RATE_LIMIT:
                    await websocket.send_json({"type": "error", "message": "Too many messages. Please slow down."})
                    continue
                _ws_msg_times.append(now)

            # Handle ping/pong for connection keep-alive
            if message_data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

            # Handle typing indicators
            elif message_data.get("type") == "typing":
                match_id = message_data.get("match_id")
                if match_id:
                    # Derive receiver from match — never trust client-provided receiver_id
                    typing_match = await db.matches.find_one({"id": match_id}, {"_id": 0, "seeker_id": 1, "recruiter_id": 1})
                    if typing_match and (typing_match["seeker_id"] == user_id or typing_match["recruiter_id"] == user_id):
                        receiver_id = typing_match["recruiter_id"] if user_id == typing_match["seeker_id"] else typing_match["seeker_id"]
                        await manager.send_to_user(receiver_id, {
                            "type": "typing",
                            "sender_id": user_id,
                            "match_id": match_id,
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

                # Content moderation
                is_clean, violations = check_text(content)
                if not is_clean and is_severe(violations):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Message contains prohibited content."
                    })
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

                # Update last_message on the match so it shows in Messages list
                await db.matches.update_one(
                    {"id": match_id},
                    {"$set": {
                        "last_message": content[:100],
                        "last_message_sender": user_id,
                        "last_message_at": message_doc["created_at"]
                    }}
                )

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


async def _ws_validate_and_connect(websocket: WebSocket, token: str, accept_subprotocol: str = None):
    """Validate JWT token, block banned users, accept connection, and run message loop."""
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

    # Block banned/suspended users from WebSocket
    ws_user = await db.users.find_one({"id": user_id}, {"_id": 0, "status": 1})
    if ws_user and ws_user.get("status") in ("banned", "suspended"):
        await websocket.accept()
        await websocket.close(code=4003, reason="Account banned or suspended")
        return

    if accept_subprotocol:
        # Accept with the negotiated subprotocol, then register with manager manually
        await websocket.accept(subprotocol=accept_subprotocol)
        if user_id not in manager.active_connections:
            manager.active_connections[user_id] = []
        manager.active_connections[user_id].append(websocket)
    else:
        # Legacy path: manager.connect calls accept() internally
        await manager.connect(websocket, user_id)

    logger.info(f"WebSocket connected: {user_id}")
    await _ws_message_loop(websocket, user_id)


@app.websocket("/ws")
async def websocket_endpoint_secure(websocket: WebSocket):
    """WebSocket endpoint that accepts token via Sec-WebSocket-Protocol header."""
    protocols = (websocket.headers.get("sec-websocket-protocol") or "").split(",")
    token = None
    for proto in protocols:
        proto = proto.strip()
        if proto.startswith("access_token."):
            token = proto[len("access_token."):]
            break

    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    await _ws_validate_and_connect(websocket, token, accept_subprotocol=f"access_token.{token}")


@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """Legacy WebSocket endpoint with token in URL path — DEPRECATED.
    Tokens in URLs leak via logs, browser history, and referrer headers.
    Use /ws with Sec-WebSocket-Protocol header instead."""
    logger.warning("Deprecated /ws/{token} endpoint used — migrate to /ws with subprotocol auth")
    await _ws_validate_and_connect(websocket, token)

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

    async def ensure_index(collection, keys, **kwargs):
        """Create an index, ignoring conflicts with existing indexes."""
        try:
            await collection.create_index(keys, **kwargs)
        except Exception as e:
            if "IndexKeySpecificationConflict" in str(e) or "IndexOptionsConflict" in str(e) or "86" in str(getattr(e, 'code', '')):
                # Index already exists with compatible keys — safe to ignore
                logger.warning(f"Index conflict on {collection.name}, skipping: {e}")
            else:
                raise

    # Create indexes for better query performance
    await ensure_index(db.users, "email", unique=True)
    await ensure_index(db.users, "id", unique=True)
    await ensure_index(db.jobs, "id", unique=True)
    await ensure_index(db.jobs, "recruiter_id")
    await ensure_index(db.applications, "id", unique=True)
    await ensure_index(db.applications, [("job_id", 1), ("seeker_id", 1)], unique=True)
    await ensure_index(db.applications, "seeker_id")
    await ensure_index(db.applications, "recruiter_id")
    await ensure_index(db.applications, [("seeker_id", 1), ("created_at", -1)])
    await ensure_index(db.matches, "id", unique=True)
    await ensure_index(db.matches, [("seeker_id", 1), ("recruiter_id", 1)])
    await ensure_index(db.matches, "last_message_at")
    await ensure_index(db.messages, "match_id")
    await ensure_index(db.messages, [("receiver_id", 1), ("is_read", 1)])
    await ensure_index(db.notifications, [("user_id", 1), ("is_read", 1)])
    await ensure_index(db.password_reset_tokens, "token", unique=True)
    await ensure_index(db.password_reset_tokens, "expires_at", expireAfterSeconds=0)

    # Email change tokens indexes
    await ensure_index(db.email_change_tokens, "token", unique=True)
    await ensure_index(db.email_change_tokens, "user_id")

    # Admin & moderation indexes
    await ensure_index(db.admin_users, "id", unique=True)
    await ensure_index(db.admin_users, "email", unique=True)
    await ensure_index(db.reports, "id", unique=True)
    await ensure_index(db.reports, [("status", 1), ("created_at", -1)])
    await ensure_index(db.moderation_queue, "id", unique=True)
    await ensure_index(db.moderation_queue, [("status", 1), ("created_at", -1)])

    # Interview indexes
    await ensure_index(db.interviews, "id", unique=True)
    await ensure_index(db.interviews, [("created_by", 1), ("status", 1)])
    await ensure_index(db.interviews, [("other_party_id", 1), ("status", 1)])
    await ensure_index(db.interviews, "seeker_id")
    await ensure_index(db.interviews, "recruiter_id")

    # Recruiter swipes indexes (critical for match detection speed)
    await ensure_index(db.recruiter_swipes, [("recruiter_id", 1), ("seeker_id", 1)], unique=True)
    await ensure_index(db.recruiter_swipes, "recruiter_id")
    await ensure_index(db.recruiter_swipes, [("recruiter_id", 1), ("action", 1), ("created_at", -1)])
    await ensure_index(db.recruiter_swipes, "seeker_id")

    # Performance indexes
    await ensure_index(db.jobs, [("recruiter_id", 1), ("is_active", 1)])
    await ensure_index(db.jobs, "is_active")
    await ensure_index(db.applications, [("recruiter_id", 1), ("action", 1), ("created_at", -1)])
    await ensure_index(db.applications, "job_id")
    await ensure_index(db.messages, [("match_id", 1), ("is_read", 1)])
    await ensure_index(db.messages, [("match_id", 1), ("created_at", -1)])
    await ensure_index(db.messages, "sender_id")
    await ensure_index(db.matches, "seeker_id")
    await ensure_index(db.matches, "recruiter_id")
    await ensure_index(db.matches, "job_id")
    await ensure_index(db.notifications, "user_id")

    # User blocked_users index (for block-list lookups)
    await ensure_index(db.users, "blocked_users")

    # Support ticket indexes
    await ensure_index(db.support_tickets, "id", unique=True)
    await ensure_index(db.support_tickets, [("user_id", 1), ("updated_at", -1)])
    await ensure_index(db.support_tickets, [("status", 1), ("updated_at", -1)])
    await ensure_index(db.support_tickets, [("assigned_to", 1), ("status", 1)])

    # Saved jobs
    await ensure_index(db.saved_jobs, [("user_id", 1), ("job_id", 1)], unique=True)
    await ensure_index(db.saved_jobs, [("user_id", 1), ("created_at", -1)])

    # Candidate notes
    await ensure_index(db.candidate_notes, [("recruiter_id", 1), ("seeker_id", 1)], unique=True)

    # Apple IAP transaction lock (prevents duplicate fulfillment)
    await ensure_index(db.apple_txn_locks, "apple_transaction_id", unique=True)

    # Google Play transaction lock (prevents duplicate fulfillment)
    await ensure_index(db.google_txn_locks, "google_order_id", unique=True)

    logger.info("Database indexes created")
    logger.info("Hireabble API started successfully!")
