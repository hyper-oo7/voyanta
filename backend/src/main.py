import os
import time
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from src.api.routers import (
    pdf_router, ppt_router, ai_router, public_router,
    packing_rules_router, vault_router, storage_router,
    knowledge_router, maintenance_router, billing_router,
    import_router, destinations_router, admin_analytics_router,
    inventory_selection_router, rag_router, documents_router,
    proposals_router
)
from src.core.rate_limiter import DistributedRateLimiterMiddleware
from src.services.pdf_vault_service import cleanup_old_temp_pdfs

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Sentry only when SENTRY_DSN environment variable exists
sentry_dsn = os.environ.get("SENTRY_DSN")
if sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=0.2,
            profiles_sample_rate=0.1,
            send_default_pii=False,
        )
        logger.info("[Sentry] Sentry error tracking automatically activated via SENTRY_DSN.")
    except Exception as e:
        logger.warning(f"[Sentry] Failed to initialize sentry-sdk: {e}")

async def retention_cleanup_loop():
    """
    Background worker loop for temporary PDF retention cleanup.
    Executes sync file operations inside a non-blocking thread to keep the asyncio loop responsive.
    """
    logger.info("[Scheduler] Starting temporary PDF retention cleanup background loop.")
    while True:
        try:
            await asyncio.to_thread(cleanup_old_temp_pdfs, retention_days=15)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[Scheduler] Error running PDF retention loop: {e}")
        try:
            await asyncio.sleep(24 * 3600)
        except asyncio.CancelledError:
            break

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start cleanup worker task and attach singletons to app.state
    cleanup_task = asyncio.create_task(retention_cleanup_loop())
    app.state.cleanup_task = cleanup_task
    try:
        from src.core.redis_client import get_redis_client
        app.state.redis = get_redis_client()
    except Exception as e:
        logger.warning(f"[Lifespan] Redis init notice: {e}")
        app.state.redis = None

    yield

    # Shutdown: Graceful cancellation
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.warning(f"[Lifespan] Cleanup task shutdown notice: {e}")

    try:
        from src.core.redis_client import reset_redis_client
        await reset_redis_client()
    except Exception as e:
        logger.warning(f"[Lifespan] Redis reset notice: {e}")

class LongRequestHeartbeatMiddleware:
    """
    Pure ASGI middleware: Logs slow requests (>10s) and monitors long-running LLM and extraction tasks
    with zero body-buffering and streaming safety.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        long_endpoints = ("/api/assemble-1shot", "/api/import/process", "/api/ai/stream-generate", "/api/stream-generate")
        is_monitored = any(path.startswith(ep) for ep in long_endpoints)

        if not is_monitored:
            await self.app(scope, receive, send)
            return

        start = time.time()
        try:
            await self.app(scope, receive, send)
            duration = time.time() - start
            if duration > 10:
                logger.info(f"[SLOW REQUEST] {path} took {duration:.1f}s")
        except asyncio.TimeoutError:
            logger.error(f"[TIMEOUT] {path} exceeded worker limit")
            raise

# Initialize FastAPI App with rich OpenAPI metadata
app = FastAPI(
    title="Voyanta API",
    description="Enterprise-grade AI travel proposal, document generation, and knowledge vault engine.",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "AI", "description": "LLM generation, translation, sensory enhancement, and SSE token streaming"},
        {"name": "PDF Generation", "description": "High-fidelity PDF document rendering, preview, and token downloads"},
        {"name": "PPT Generation", "description": "PowerPoint slide presentation generation"},
        {"name": "Knowledge Vault", "description": "Supplier catalog extraction, knowledge graph, and destination rules"},
        {"name": "RAG & Search", "description": "Hybrid full-text and pgvector semantic retrieval with Reciprocal Rank Fusion"},
        {"name": "Proposals", "description": "Proposal assembly, pricing calculation, and draft orchestration"},
        {"name": "Super Admin Operations & Analytics", "description": "Platform telemetry, admin dashboard, and tenant metrics"},
    ],
    lifespan=lifespan
)

# -------------------------------------------------------------
# Global Exception Handlers for Unified, Clean JSON Error Responses
# -------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Standardizes Pydantic input validation errors into clean JSON with field-level details.
    """
    logger.warning(f"[Validation Error] {request.method} {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": "Input validation failed. Please check the request body.",
            "details": exc.errors(),
            "path": str(request.url.path),
        }
    )

from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Standardizes HTTP exceptions (including 404s and 401s) into clean, uniform JSON payloads.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail if isinstance(exc.detail, str) else "HTTP Error",
            "detail": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path),
        },
        headers=getattr(exc, "headers", None) or {}
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catches any unhandled 500 error, logs full traceback,
    and returns a clean JSON error response without leaking internal stack traces.
    """
    logger.exception(f"[Unhandled Error] Uncaught exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected server error occurred. Our engineering team has been notified.",
            "path": str(request.url.path),
        }
    )

app.add_middleware(LongRequestHeartbeatMiddleware)
app.add_middleware(DistributedRateLimiterMiddleware, max_requests=1000, window_seconds=60)

# Add CORS Middleware
default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://voyanta-puce.vercel.app",
    "https://voyanta-frontend.vercel.app",
    "https://voyanta.vercel.app"
]
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
env_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
origins = list(set(default_origins + env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

@api_router.get("/", tags=["System"])
async def root():
    return {"message": "Voyanta API backend"}

@api_router.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "version": "3.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

api_router.include_router(pdf_router.router)
api_router.include_router(import_router.router)
api_router.include_router(ppt_router.router)
api_router.include_router(ai_router.router)
api_router.include_router(public_router.router)
api_router.include_router(packing_rules_router.router)
api_router.include_router(vault_router.router)
api_router.include_router(storage_router.router)
api_router.include_router(knowledge_router.router)
api_router.include_router(maintenance_router.router)
api_router.include_router(billing_router.router)
api_router.include_router(destinations_router.router)
api_router.include_router(admin_analytics_router.router)
api_router.include_router(inventory_selection_router.router)
api_router.include_router(rag_router.router)
api_router.include_router(documents_router.router)
api_router.include_router(proposals_router.router)

app.include_router(api_router)
