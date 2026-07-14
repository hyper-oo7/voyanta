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
        assert "Invalid auth token" in exc_info.value.detail

@pytest.mark.anyio
async def test_verify_token_no_secret_unverified_decode():
    payload = {"sub": "user-456", "email": "unverified@example.com"}
    token = jwt.encode(payload, "some-secret", algorithm="HS256")
    
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": ""}):
        decoded = await verify_token(credentials)
        assert decoded["sub"] == "user-456"
        assert decoded["email"] == "unverified@example.com"

@pytest.mark.anyio
@patch("src.core.security._verify_token_network")
async def test_verify_token_fallback_network(mock_verify_network):
    mock_verify_network.return_value = {"sub": "network-user"}
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-valid-jwt")
    
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": ""}):
        decoded = await verify_token(credentials)
        assert decoded["sub"] == "network-user"
        mock_verify_network.assert_called_once_with("not-a-valid-jwt")
