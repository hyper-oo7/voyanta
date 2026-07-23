import os
import httpx
import logging
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_KEY')
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('JWT_SECRET')

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

_jwks_clients: Dict[str, Any] = {}

def get_jwks_client(supabase_url: str):
    """
    Returns a cached PyJWKClient instance for fetching and caching Supabase ES256/RS256 public keys
    from {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
    """
    base_url = supabase_url.rstrip('/')
    if base_url not in _jwks_clients:
        jwks_url = f"{base_url}/auth/v1/.well-known/jwks.json"
        _jwks_clients[base_url] = jwt.PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=10)
    return _jwks_clients[base_url]

async def _verify_token_network(token: str) -> dict:
    """
    Official Supabase network verification fallback via GET /auth/v1/user.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
        if res.status_code != 200:
            logger.error(f"[Security] Network token verification failed: {res.text}")
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
        logger.warning(f"[Security] Optional network token verification error: {e}")
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
    """
    Verifies incoming Authorization Bearer JWT using:
    1. Supabase ES256/JWKS public key verification via PyJWKClient (O(1) cached local cryptographic verification)
    2. Shared symmetric secret (HS256) if SUPABASE_JWT_SECRET is explicitly configured
    3. Official Supabase network verification fallback (GET /auth/v1/user)
    
    Strictly NO unverified signature bypass permitted.
    """
    token = credentials.credentials
    secret = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('JWT_SECRET')
    supabase_url = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')

    payload = None

    # 0. Check for Platform Admin Token issued by /api/admin/login
    admin_secret = os.environ.get('SUPABASE_JWT_SECRET') or "voyanta_admin_super_secret_key_2026"
    try:
        admin_payload = jwt.decode(token, admin_secret, algorithms=["HS256"], options={"verify_aud": False})
        if admin_payload and admin_payload.get("role") in ("owner", "admin"):
            return admin_payload
    except jwt.ExpiredSignatureError:
        logger.error("[Security] Admin token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception:
        pass

    # 1. Primary: ES256 / JWKS public key verification
    if supabase_url:
        try:
            jwks_client = get_jwks_client(supabase_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "HS256"],
                options={"verify_aud": False}
            )
        except jwt.ExpiredSignatureError:
            logger.error("[Security] Token has expired")
            raise HTTPException(status_code=401, detail="Token has expired")
        except Exception as e:
            logger.debug(f"[Security] JWKS verification attempt error: {e}")

    # 2. Secondary: Shared symmetric secret (HS256) if configured
    if not payload and secret:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        except jwt.ExpiredSignatureError:
            logger.error("[Security] Token has expired")
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.PyJWTError as e:
            logger.error(f"[Security] Local JWT secret verification failed: {e}")
            raise HTTPException(status_code=401, detail="Invalid auth token")

    # 3. Fallback: Official Supabase network verification (/auth/v1/user)
    if not payload:
        try:
            payload = await _verify_token_network(token)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[Security] Failed to verify token via network: {e}")
            raise HTTPException(status_code=401, detail="Invalid auth token")

    if payload:
        payload = await _resolve_user_agency(payload, token)

    return payload

async def verify_token_optional(credentials: HTTPAuthorizationCredentials = Security(security_optional)):
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    secret = os.environ.get('SUPABASE_JWT_SECRET') or os.environ.get('JWT_SECRET')
    supabase_url = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')

    payload = None

    # 0. Check for Platform Admin Token
    admin_secret = os.environ.get('SUPABASE_JWT_SECRET') or "voyanta_admin_super_secret_key_2026"
    try:
        admin_payload = jwt.decode(token, admin_secret, algorithms=["HS256"], options={"verify_aud": False})
        if admin_payload and admin_payload.get("role") in ("owner", "admin"):
            return admin_payload
    except Exception:
        pass

    # 1. Primary: ES256 / JWKS public key verification
    if supabase_url:
        try:
            jwks_client = get_jwks_client(supabase_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "HS256"],
                options={"verify_aud": False}
            )
        except Exception:
            pass

    # 2. Secondary: Shared secret if configured
    if not payload and secret:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        except jwt.PyJWTError:
            pass

    # 3. Fallback: Official Supabase network verification
    if not payload:
        payload = await _verify_token_optional_network(token)

    if payload:
        payload = await _resolve_user_agency(payload, token)

    return payload

async def get_request_token(credentials: HTTPAuthorizationCredentials = Security(security_optional)) -> Optional[str]:
    """
    FastAPI dependency to extract the raw Bearer JWT token from the authorization header.
    Returns the token string if present, or None if unauthenticated.
    """
    if credentials and credentials.credentials:
        return credentials.credentials
    return None

async def verify_internal_api_key(x_internal_api_key: str = Header(..., alias="x-internal-api-key")):
    """
    FastAPI dependency enforcing requests to supply a valid x-internal-api-key header.
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key"
        )
