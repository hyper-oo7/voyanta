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

from src.api.routers import pdf_router, ppt_router, ai_router
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(DistributedRateLimiterMiddleware, max_requests=200, window_seconds=60)

# Add CORS Middleware
cors_origins_env = os.environ.get("CORS_ORIGINS")
if not cors_origins_env and os.environ.get("ENV", "").lower() in ("production", "prod"):
    logger.warning("[Security] CORS_ORIGINS environment variable is not set; defaulting to local development origins in production!")
cors_origins_str = cors_origins_env or "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
api_router.include_router(ppt_router.router)
api_router.include_router(ai_router.router)

app.include_router(api_router)
