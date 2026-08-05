import os
import logging
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware

from src.api.routers import pdf_router, ppt_router, ai_router, public_router, packing_rules_router, vault_router, storage_router, knowledge_router, maintenance_router, billing_router, import_router, destinations_router, admin_analytics_router, inventory_selection_router, rag_router, documents_router, proposals_router
from src.core.rate_limiter import DistributedRateLimiterMiddleware

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

import asyncio
from src.services.pdf_vault_service import cleanup_old_temp_pdfs

async def retention_cleanup_loop():
    logger.info("[Scheduler] Starting temporary PDF retention cleanup background loop.")
    while True:
        try:
            cleanup_old_temp_pdfs(retention_days=15)
        except Exception as e:
            logger.error(f"[Scheduler] Error running PDF retention loop: {e}")
        await asyncio.sleep(24 * 3600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start cleanup task
    cleanup_task = asyncio.create_task(retention_cleanup_loop())
    yield
    # Shutdown: Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

import time
from starlette.middleware.base import BaseHTTPMiddleware

class LongRequestHeartbeatMiddleware(BaseHTTPMiddleware):
    """
    Logs slow requests (>10s) and monitors long-running LLM and extraction tasks.
    """
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        long_endpoints = ("/api/assemble-1shot", "/api/import/process")
        if not any(path.startswith(ep) for ep in long_endpoints):
            return await call_next(request)

        start = time.time()
        try:
            response = await call_next(request)
            duration = time.time() - start
            if duration > 10:
                logger.info(f"[SLOW REQUEST] {path} took {duration:.1f}s")
            return response
        except asyncio.TimeoutError:
            logger.error(f"[TIMEOUT] {path} exceeded worker limit")
            raise

app = FastAPI(lifespan=lifespan)
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

@api_router.get("/")
async def root():
    return {"message": "Voyanta API backend"}

@api_router.get("/health")
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
