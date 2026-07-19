import os
import httpx
import logging
from typing import Optional
from fastapi import HTTPException, Security, Header, status

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

import jwt
from typing import Optional

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_KEY')
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('JWT_SECRET')

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

async def _verify_token_network(token: str) -> dict:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
        if res.status_code != 200:
            logger.error(f"Token verification failed: {res.text}")
            raise HTTPException(status_code=401, detail="Invalid auth token")
        return res.json()

async def _verify_token_optional_network(token: str) -> Optional[dict]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
            if res.status_code == 200:
                return res.json()
    except Exception as e:
        logger.warning(f"Optional token verification network error: {e}")
    return None

async def _resolve_user_agency(payload: Optional[dict], token: str) -> Optional[dict]:
    if not payload:
        return payload
    
    agency_id = (
        (payload.get("user_metadata") or {}).get("agency_id")
        or (payload.get("app_metadata") or {}).get("agency_id")
        or payload.get("agency_id")
    )
    if agency_id:
        payload["agency_id"] = agency_id
        return payload

    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        return payload

    try:
        from src.services.supabase_client import get_user_supabase_client
        sb = get_user_supabase_client(token)
        if sb:
            res = sb.table("users").select("agency_id").eq("id", user_id).execute()
            if res.data and res.data[0].get("agency_id"):
                resolved_aid = res.data[0]["agency_id"]
                payload["agency_id"] = resolved_aid
                if "user_metadata" not in payload:
                    payload["user_metadata"] = {}
                payload["user_metadata"]["agency_id"] = resolved_aid
                logger.info(f"[Security] Resolved agency_id {resolved_aid} for user {user_id}")
    except Exception as e:
        logger.warning(f"[Security] Failed to resolve agency_id for user {user_id}: {e}")

    return payload

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    secret = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('JWT_SECRET')
    
    payload = None
    if secret:
        try:
            # Local high-performance verification (O(1) CPU, no network call)
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        except jwt.ExpiredSignatureError:
            logger.error("Token has expired")
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.PyJWTError as e:
            logger.error(f"Local JWT verification failed: {e}")
            raise HTTPException(status_code=401, detail="Invalid auth token")
    else:
        # Fall back to decoding without verification if token is in valid JWT structure (dev convenience)
        try:
            if len(token.split(".")) == 3:
                payload = jwt.decode(token, options={"verify_signature": False})
        except Exception:
            pass
            
        if not payload:
            # Hard fallback to Supabase verification endpoint
            try:
                payload = await _verify_token_network(token)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to verify token: {e}")
                raise HTTPException(status_code=401, detail="Invalid auth token")
                
    if payload:
        payload = await _resolve_user_agency(payload, token)
    return payload

async def verify_token_optional(credentials: HTTPAuthorizationCredentials = Security(security_optional)):
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    secret = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('JWT_SECRET')
    
    payload = None
    if secret:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        except jwt.PyJWTError:
            return None
    else:
        try:
            if len(token.split(".")) == 3:
                payload = jwt.decode(token, options={"verify_signature": False})
        except Exception:
            pass
            
        if not payload:
            payload = await _verify_token_optional_network(token)
            
    if payload:
        payload = await _resolve_user_agency(payload, token)
    return payload


async def get_request_token(credentials: HTTPAuthorizationCredentials = Security(security_optional)) -> HTTPAuthorizationCredentials:
    """
    FastAPI dependency to extract the raw Bearer JWT token from the authorization header.
    Returns the token string if present, or None if unauthenticated.
    """
    if credentials and credentials.credentials:
        return credentials.credentials
    return None


async def verify_internal_api_key(x_internal_api_key: str = Header(..., alias="x-internal-api-key")):
    """
    FastAPI dependency that enforces requests to supply a valid x-internal-api-key header.
    Gates internal maintenance and PDF generation endpoints.
    """
    expected_key = os.environ.get("INTERNAL_API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_API_KEY not configured on server"
        )
    if x_internal_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key"
        )


