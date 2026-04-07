"""
Hireabble API - Main Server
A swipe-based job application platform

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
import asyncio
import json
import uuid
import jwt as pyjwt
import os

# Sentry error tracking
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    def _sentry_before_send(event, hint):
        """Strip sensitive data from Sentry events."""
        if event.get("request"):
            headers = event["request"].get("headers", {})
            if "Authorization" in headers:
                headers["Authorization"] = "[Filtered]"
            if "cookie" in headers:
                headers["cookie"] = "[Filtered]"
            # Strip sensitive request body fields
            data = event["request"].get("data")
            if isinstance(data, dict):
                for key in ("password", "token", "code", "secret", "totp_secret"):
                    if key in data:
                        data[key] = "[Filtered]"
        return event

    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment=os.getenv("ENVIRONMENT", "production"),
        integrations=[StarletteIntegration(), FastApiIntegration()],
        before_send=_sentry_before_send,
    )

# Import database and shared utilities
from database import db, manager, UPLOADS_DIR, logger, JWT_SECRET, JWT_ALGORITHM, create_notification, send_web_push
from content_filter import check_text, is_severe

# Import routers
from routers import auth, jobs, applications, matches, notifications, uploads, stats, admin, interviews, payments, support, users, skills, blog, analytics

# Rate limiter — uses remote IP address by default
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

# Create the main app — disable docs/OpenAPI in production to reduce attack surface
_is_production = os.getenv("ENVIRONMENT", "production") != "development"
app = FastAPI(
    title="Hireabble API",
    description="A swipe-based job application platform API",
    version="2.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
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
_frontend_url = os.getenv("FRONTEND_URL", "https://hireabble.com")
_environment = os.getenv("ENVIRONMENT", "development")
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
    allow_headers=["Authorization", "Content-Type", "Cache-Control", "X-Platform"],
)


# Compiled once at module load — used in CSRF middleware below
import re as _re
_CSRF_ORIGIN_RE = _re.compile(
    r"https://(hireabble[a-z0-9-]*\.vercel\.app|hireabble[a-z0-9-]*\.up\.railway\.app|(www\.)?hireabble\.com)"
)

# CSRF protection — verify Origin header on state-changing requests
@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    # Only check state-changing methods
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        # Skip for webhooks and health checks
        path = request.url.path
        if path.startswith("/api/payments/webhook") or path == "/api/health":
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
        if not origin_valid and _CSRF_ORIGIN_RE.match(check_value):
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
        "frame-ancestors 'none'; "
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
    # Batched dashboard endpoints — no-cache so browser always revalidates
    elif path in ("/api/dashboard", "/api/recruiter/dashboard-data"):
        response.headers["Cache-Control"] = "private, no-cache"
    # User-specific data — no-cache to avoid stale data after mutations
    elif path.startswith("/api/stats") or path.startswith("/api/profile/completeness") or path.startswith("/api/superlikes/remaining"):
        response.headers["Cache-Control"] = "private, no-cache"
    # Auth check — very short cache to avoid re-calling on every navigation
    elif path == "/api/auth/me":
        response.headers["Cache-Control"] = "no-store"
    # Notifications — short cache
    elif path.startswith("/api/notifications"):
        response.headers["Cache-Control"] = "private, no-cache"
    # Jobs/matches listing — private, no stale data
    elif request.method == "GET" and (path.startswith("/api/jobs") or path.startswith("/api/matches")):
        response.headers["Cache-Control"] = "private, no-cache"
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
app.include_router(skills.router, prefix="/api")
app.include_router(blog.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

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


# ==================== HEALTH CHECK ====================

@app.api_route("/api/health", methods=["GET", "HEAD"])
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
    await ensure_index(db.matches, [("expired", 1), ("expires_at", 1)])
    await ensure_index(db.matches, "created_at")
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

    # Stripe session idempotency (prevents duplicate webhook fulfillment)
    await ensure_index(db.transactions, "stripe_session_id", unique=True, sparse=True)

    # Apple IAP transaction lock (prevents duplicate fulfillment)
    await ensure_index(db.apple_txn_locks, "apple_transaction_id", unique=True)

    # Google Play transaction lock (prevents duplicate fulfillment)
    await ensure_index(db.google_txn_locks, "google_order_id", unique=True)

    # Admin 2FA codes
    await ensure_index(db.admin_2fa_codes, "admin_id")

    # User email 2FA codes
    await ensure_index(db.user_2fa_codes, "user_id")

    # Token blacklist with TTL (auto-expire entries after 24h to match JWT expiration)
    await ensure_index(db.token_blacklist, "jti")
    try:
        await db.token_blacklist.create_index("blacklisted_at", expireAfterSeconds=86400)
    except Exception:
        pass  # Index may already exist

    # ==================== PERFORMANCE INDEXES ====================

    # Sorting indexes (used on every list page load)
    await ensure_index(db.notifications, [("user_id", 1), ("created_at", -1)])
    await ensure_index(db.matches, "created_at")

    # Filter indexes for common query patterns
    await ensure_index(db.users, "status")
    await ensure_index(db.applications, [("seeker_id", 1), ("action", 1)])
    await ensure_index(db.applications, [("recruiter_id", 1), ("recruiter_action", 1)])

    # Profile views (previously unindexed)
    await ensure_index(db.profile_views, "seeker_id")
    await ensure_index(db.profile_views, [("viewer_id", 1), ("seeker_id", 1), ("date", 1)])

    # Page views (traffic analytics)
    await ensure_index(db.page_views, [("created_at", -1)])
    await ensure_index(db.page_views, "visitor_id")
    await ensure_index(db.page_views, "path")

    # ==================== TTL INDEXES (auto-cleanup) ====================
    try:
        await db.user_2fa_codes.create_index("created_at", expireAfterSeconds=900)
        await db.admin_2fa_codes.create_index("created_at", expireAfterSeconds=900)
        await db.profile_views.create_index("created_at", expireAfterSeconds=7776000)  # 90 days
        await db.email_verification_tokens.create_index("created_at", expireAfterSeconds=86400)
        await db.conversation_starters_cache.create_index("created_at", expireAfterSeconds=604800)  # 7 days
        await db.page_views.create_index("created_at", expireAfterSeconds=15552000)  # 180 days
    except Exception:
        pass  # TTL indexes may already exist

    logger.info("Database indexes created")

    # Start background saved-job reminder scheduler
    asyncio.create_task(_saved_job_reminder_loop())

    # Start background job alerts scheduler
    asyncio.create_task(_job_alerts_loop())

    # Start match expiry, streak check, and weekly digest schedulers
    asyncio.create_task(_match_expiry_loop())
    asyncio.create_task(_streak_check_loop())
    asyncio.create_task(_weekly_digest_loop())

    logger.info("Hireabble API started successfully!")


async def _job_alerts_loop():
    """Send periodic job alert digests to seekers."""
    import random
    from datetime import timedelta
    await asyncio.sleep(random.randint(60, 300))  # initial jitter
    while True:
        try:
            now = datetime.now(timezone.utc)
            six_hours_ago = (now - timedelta(hours=6)).isoformat()

            # Find seekers with job alerts enabled
            seekers = await db.users.find(
                {
                    "role": "seeker",
                    "email_notifications.job_alerts": {"$ne": False},
                    "$or": [
                        {"last_job_alert_at": {"$exists": False}},
                        {"last_job_alert_at": {"$lte": six_hours_ago}},
                    ],
                },
                {"_id": 0, "id": 1, "skills": 1, "location": 1, "desired_salary": 1,
                 "job_type_preference": 1, "last_job_alert_at": 1, "name": 1},
            ).to_list(500)

            for seeker in seekers:
                try:
                    since = seeker.get("last_job_alert_at", six_hours_ago)
                    # Find new jobs since last alert
                    new_jobs_query = {
                        "is_active": True,
                        "created_at": {"$gte": since},
                    }
                    new_jobs = await db.jobs.find(
                        new_jobs_query,
                        {"_id": 0, "id": 1, "title": 1, "company": 1, "location": 1,
                         "salary_min": 1, "salary_max": 1, "category": 1},
                    ).to_list(50)

                    if len(new_jobs) >= 3:
                        await create_notification(
                            seeker["id"], "job_alert",
                            f"{len(new_jobs)} New Jobs for You",
                            f"There are {len(new_jobs)} new job openings that may interest you. Check them out!",
                            data={"type": "job_alert"},
                        )
                        await send_web_push(
                            seeker["id"],
                            title=f"{len(new_jobs)} New Jobs",
                            body="New jobs posted that match your profile!",
                            push_data={"type": "job_alert"},
                        )
                        await db.users.update_one(
                            {"id": seeker["id"]},
                            {"$set": {"last_job_alert_at": now.isoformat()}},
                        )
                except Exception:
                    pass
        except Exception:
            pass

        await asyncio.sleep(6 * 3600)  # every 6 hours


async def _saved_job_reminder_loop():
    """Background task: send daily saved-job reminders via email & push."""
    import random
    # Stagger start across workers to avoid duplicate sends
    await asyncio.sleep(60 + random.randint(0, 120))
    while True:
        try:
            await _send_saved_job_reminders()
        except Exception as e:
            logger.error(f"Saved job reminder error: {e}")
        # Run once every 24 hours (with jitter)
        await asyncio.sleep(86400 + random.randint(0, 3600))


async def _send_saved_job_reminders():
    """Find users with saved jobs and send reminder notifications."""
    from database import db, send_email_notification, send_web_push, get_user_email_prefs
    from datetime import datetime, timezone, timedelta

    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # Find users who saved jobs 3+ days ago and haven't been reminded recently
    pipeline = [
        {"$match": {"created_at": {"$lte": three_days_ago}}},
        {"$group": {"_id": "$user_id", "saved_count": {"$sum": 1}, "oldest_save": {"$min": "$created_at"}}},
        {"$match": {"saved_count": {"$gte": 1}}},
        {"$limit": 200},
    ]

    user_saves = await db.saved_jobs.aggregate(pipeline).to_list(200)

    for entry in user_saves:
        user_id = entry["_id"]
        saved_count = entry["saved_count"]

        # Check if we already sent a reminder recently (within 7 days)
        last_reminder = await db.notifications.find_one(
            {"user_id": user_id, "type": "saved_job_reminder", "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}},
            {"_id": 1}
        )
        if last_reminder:
            continue

        # Check user preferences
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "name": 1, "email_notifications": 1})
        if not user:
            continue

        prefs = user.get("email_notifications", {})
        if prefs.get("saved_job_reminders") is False:
            continue

        # Check how many saved jobs are still active
        saved_jobs = await db.saved_jobs.find({"user_id": user_id}, {"_id": 0, "job_id": 1}).to_list(50)
        job_ids = [s["job_id"] for s in saved_jobs]
        active_count = await db.jobs.count_documents({"id": {"$in": job_ids}, "is_active": True})

        if active_count == 0:
            continue

        # Create in-app notification
        import uuid
        notif_id = str(uuid.uuid4())
        message = f"You have {active_count} saved job{'s' if active_count != 1 else ''} still open. Don't miss out!"
        await db.notifications.insert_one({
            "id": notif_id,
            "user_id": user_id,
            "type": "saved_job_reminder",
            "message": message,
            "is_read": False,
            "created_at": now,
        })

        # Send email
        name = user.get("name", "there")
        html = f"""
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Don't forget your saved jobs!</h2>
            <p>Hi {name},</p>
            <p>You have <strong>{active_count} saved job{'s' if active_count != 1 else ''}</strong> that {'are' if active_count != 1 else 'is'} still open and accepting applications.</p>
            <p>Don't let great opportunities slip away — review and apply before they close.</p>
            <a href="https://hireabble.com/saved" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #6366f1, #22d3ee); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 10px;">
                View Saved Jobs
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">
                You're receiving this because you saved jobs on Hireabble.
                You can update your notification preferences in your profile settings.
            </p>
        </div>
        """
        if user.get("email"):
            await send_email_notification(user["email"], f"You have {active_count} saved job{'s' if active_count != 1 else ''} still open", html)

        # Send push notification
        await send_web_push(
            user_id,
            title="Saved jobs still open",
            body=f"You have {active_count} saved job{'s' if active_count != 1 else ''} waiting for you",
            push_data={"type": "saved_job_reminder", "url": "/saved"}
        )


async def _match_expiry_loop():
    """Background: expire unresponded matches after 72 hours."""
    import random
    await asyncio.sleep(random.randint(120, 600))
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

            expired_matches = await db.matches.find(
                {"expires_at": {"$lte": now_iso}, "expired": {"$ne": True}},
                {"_id": 0, "id": 1, "seeker_id": 1, "recruiter_id": 1}
            ).to_list(200)

            for match in expired_matches:
                msg_count = await db.messages.count_documents({"match_id": match["id"]})
                if msg_count > 0:
                    await db.matches.update_one(
                        {"id": match["id"]},
                        {"$unset": {"expires_at": "", "expired": ""}}
                    )
                else:
                    await db.matches.update_one(
                        {"id": match["id"]},
                        {"$set": {"expired": True}}
                    )
                    for uid in [match["seeker_id"], match["recruiter_id"]]:
                        await create_notification(
                            uid, "system_message",
                            "Connection Expired",
                            "A connection expired because no one started a conversation. Keep swiping!",
                            data={"match_id": match["id"]}
                        )

            # "Expiring soon" warnings (24hr before expiry)
            warning_cutoff = (now + timedelta(hours=24)).isoformat()
            expiring_soon = await db.matches.find(
                {
                    "expires_at": {"$lte": warning_cutoff, "$gt": now_iso},
                    "expired": {"$ne": True},
                    "expiry_warned": {"$ne": True},
                },
                {"_id": 0, "id": 1, "seeker_id": 1, "recruiter_id": 1, "job_title": 1}
            ).to_list(200)

            for match in expiring_soon:
                msg_count = await db.messages.count_documents({"match_id": match["id"]})
                if msg_count == 0:
                    for uid in [match["seeker_id"], match["recruiter_id"]]:
                        await create_notification(
                            uid, "system_message",
                            "Connection Expiring Soon",
                            f"Your connection for {match.get('job_title', 'a position')} expires in 24 hours. Send a message to keep it!",
                            data={"match_id": match["id"]}
                        )
                        await manager.send_to_user(uid, {"type": "match_expiring_soon", "match_id": match["id"]})
                    await db.matches.update_one({"id": match["id"]}, {"$set": {"expiry_warned": True}})
        except Exception as e:
            logger.error(f"Match expiry loop error: {e}")

        await asyncio.sleep(3600)


async def _streak_check_loop():
    """Background: reset broken streaks and notify users."""
    import random
    from datetime import date as _date
    await asyncio.sleep(random.randint(600, 1800))
    while True:
        try:
            two_days_ago = (_date.today() - timedelta(days=2)).isoformat()
            broken = await db.users.find(
                {"streak_count": {"$gt": 0}, "streak_last_active_date": {"$lte": two_days_ago}},
                {"_id": 0, "id": 1, "streak_count": 1}
            ).to_list(500)

            for user in broken:
                old_count = user.get("streak_count", 0)
                await db.users.update_one({"id": user["id"]}, {"$set": {"streak_count": 0}})
                if old_count >= 3:
                    await create_notification(
                        user["id"], "system_message",
                        "Streak Ended",
                        f"Your {old_count}-day streak ended. Start a new one today!",
                        data={"type": "streak_broken"}
                    )
        except Exception as e:
            logger.error(f"Streak check loop error: {e}")

        await asyncio.sleep(86400 + random.randint(0, 3600))


async def _weekly_digest_loop():
    """Background: send weekly market digest emails on Sundays."""
    import random
    await asyncio.sleep(random.randint(300, 900))
    while True:
        try:
            now = datetime.now(timezone.utc)
            if now.weekday() == 6 and 8 <= now.hour <= 10:
                week_ago = (now - timedelta(days=7)).isoformat()

                seekers = await db.users.find(
                    {
                        "role": "seeker", "email_verified": True,
                        "email_notifications.weekly_digest": {"$ne": False},
                        "$or": [
                            {"last_weekly_digest_at": {"$exists": False}},
                            {"last_weekly_digest_at": {"$lte": week_ago}},
                        ],
                    },
                    {"_id": 0, "id": 1, "email": 1, "name": 1}
                ).to_list(500)

                for seeker in seekers:
                    try:
                        new_jobs = await db.jobs.count_documents({"is_active": True, "created_at": {"$gte": week_ago}})
                        profile_views = await db.profile_views.count_documents({"seeker_id": seeker["id"], "created_at": {"$gte": week_ago}})
                        new_matches = await db.matches.count_documents({"seeker_id": seeker["id"], "created_at": {"$gte": week_ago}, "expired": {"$ne": True}})
                        apps_sent = await db.applications.count_documents({"seeker_id": seeker["id"], "created_at": {"$gte": week_ago}})

                        if new_jobs > 0 or new_matches > 0:
                            summary = f"This week: {new_jobs} new jobs, {new_matches} connections, {profile_views} profile views"
                            await create_notification(seeker["id"], "system_message", "Your Weekly Market Report", summary, data={"type": "weekly_digest"})

                        await db.users.update_one({"id": seeker["id"]}, {"$set": {"last_weekly_digest_at": now.isoformat()}})
                    except Exception as e:
                        logger.error(f"Weekly digest error for {seeker['id']}: {e}")

                recruiters = await db.users.find(
                    {
                        "role": "recruiter", "email_verified": True,
                        "email_notifications.weekly_digest": {"$ne": False},
                        "$or": [
                            {"last_weekly_digest_at": {"$exists": False}},
                            {"last_weekly_digest_at": {"$lte": week_ago}},
                        ],
                    },
                    {"_id": 0, "id": 1, "email": 1, "name": 1}
                ).to_list(500)

                for recruiter in recruiters:
                    try:
                        new_apps = await db.applications.count_documents({"recruiter_id": recruiter["id"], "created_at": {"$gte": week_ago}})
                        new_matches = await db.matches.count_documents({"recruiter_id": recruiter["id"], "created_at": {"$gte": week_ago}, "expired": {"$ne": True}})
                        if new_apps > 0 or new_matches > 0:
                            summary = f"This week: {new_apps} new applications, {new_matches} connections"
                            await create_notification(recruiter["id"], "system_message", "Your Weekly Hiring Report", summary, data={"type": "weekly_digest"})
                        await db.users.update_one({"id": recruiter["id"]}, {"$set": {"last_weekly_digest_at": now.isoformat()}})
                    except Exception as e:
                        logger.error(f"Weekly digest error for {recruiter['id']}: {e}")
        except Exception as e:
            logger.error(f"Weekly digest loop error: {e}")

        await asyncio.sleep(3600)
