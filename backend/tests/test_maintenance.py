import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_retention_endpoint_requires_api_key():
    # Calling retention without the x-internal-api-key header
    r = client.post("/api/maintenance/retention")
    assert r.status_code == 422

def test_retention_endpoint_invalid_api_key():
    # Configure env variable
    os.environ["INTERNAL_API_KEY"] = "super-secret-key"
    # Calling retention with an invalid header key
    r = client.post("/api/maintenance/retention", headers={"x-internal-api-key": "bad-key"})
    assert r.status_code == 401
    assert "Invalid internal API key" in r.json()["detail"]

def test_retention_endpoint_valid_api_key():
    # Configure env variable
    os.environ["INTERNAL_API_KEY"] = "super-secret-key"
    with patch("src.api.routers.maintenance_router.run_activity_logs_retention") as mock_retention:
        mock_retention.return_value = {"status": "success", "deleted_count": 5}
        
        r = client.post(
            "/api/maintenance/retention", 
            headers={"x-internal-api-key": "super-secret-key"}
        )
        assert r.status_code == 200
        assert r.json() == {"status": "success", "deleted_count": 5}
        mock_retention.assert_called_once_with(retention_days=60)
