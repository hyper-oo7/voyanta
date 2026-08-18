import pytest
import time
import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from unittest.mock import patch, MagicMock
from src.core.security import verify_token, verify_token_optional

@pytest.fixture
def mock_jwt_secret():
    return "super-secret-jwt-key-with-sufficient-length-32-chars"

@pytest.mark.anyio
async def test_verify_token_local_success(mock_jwt_secret):
    payload = {"sub": "user-123", "email": "user@example.com", "role": "authenticated", "exp": int(time.time()) + 3600}
    token = jwt.encode(payload, mock_jwt_secret, algorithm="HS256")
    
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": mock_jwt_secret}):
        decoded = await verify_token(credentials)
        assert decoded["sub"] == "user-123"
        assert decoded["email"] == "user@example.com"

@pytest.mark.anyio
async def test_verify_token_local_expired(mock_jwt_secret):
    payload = {"sub": "user-123", "email": "user@example.com", "role": "authenticated", "exp": int(time.time()) - 3600}
    token = jwt.encode(payload, mock_jwt_secret, algorithm="HS256")
    
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": mock_jwt_secret}):
        with pytest.raises(HTTPException) as exc_info:
            await verify_token(credentials)
        assert exc_info.value.status_code == 401
        assert "Token has expired" in exc_info.value.detail

@pytest.mark.anyio
async def test_verify_token_local_invalid_signature(mock_jwt_secret):
    payload = {"sub": "user-123", "email": "user@example.com", "role": "authenticated", "exp": int(time.time()) + 3600}
    token = jwt.encode(payload, "different-secret-different-secret-secret", algorithm="HS256")
    
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": mock_jwt_secret}):
        with pytest.raises(HTTPException) as exc_info:
            await verify_token(credentials)
        assert exc_info.value.status_code == 401

@pytest.mark.anyio
@patch("src.core.security._verify_token_network")
async def test_verify_token_fallback_network(mock_verify_network):
    mock_verify_network.return_value = {"sub": "network-user"}
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-valid-jwt")
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": ""}):
        decoded = await verify_token(credentials)
        assert decoded["sub"] == "network-user"
        mock_verify_network.assert_called_once_with("not-a-valid-jwt")

@pytest.mark.anyio
async def test_admin_token_with_configured_secret(mock_jwt_secret):
    payload = {"sub": "admin-1", "role": "owner", "exp": int(time.time()) + 3600}
    token = jwt.encode(payload, mock_jwt_secret, algorithm="HS256")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": mock_jwt_secret}):
        decoded = await verify_token(credentials)
        assert decoded["role"] == "owner"
        assert decoded["sub"] == "admin-1"

@pytest.mark.anyio
@patch("src.core.security._verify_token_network")
async def test_admin_token_rejected_when_secret_unset(mock_verify_network):
    """Ensure hardcoded default secret is NOT accepted when SUPABASE_JWT_SECRET is unset."""
    payload = {"sub": "fake-admin", "role": "owner", "exp": int(time.time()) + 3600}
    # Token signed with the old hardcoded string
    token = jwt.encode(payload, "voyanta_admin_super_secret_key_2026", algorithm="HS256")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    mock_verify_network.side_effect = HTTPException(status_code=401, detail="Invalid auth token")
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "", "JWT_SECRET": ""}):
        with pytest.raises(HTTPException) as exc_info:
            await verify_token(credentials)
        assert exc_info.value.status_code == 401

