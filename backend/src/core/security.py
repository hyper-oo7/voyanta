import os
import httpx
import logging
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_KEY')

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
            if res.status_code != 200:
                logger.error(f"Token verification failed: {res.text}")
                raise HTTPException(status_code=401, detail="Invalid auth token")
            return res.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify token: {e}")
        raise HTTPException(status_code=401, detail="Invalid auth token")

async def verify_token_optional(credentials: HTTPAuthorizationCredentials = Security(security_optional)):
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
        
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
            if res.status_code != 200:
                logger.warning(f"Optional token verification failed (proceeding as guest): {res.text}")
                return None
            return res.json()
    except Exception as e:
        logger.warning(f"Optional token verification error (proceeding as guest): {e}")
        return None
