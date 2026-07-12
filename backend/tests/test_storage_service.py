import os
import pytest
from src.services.r2_storage_service import is_private_folder, upload_file_to_r2, get_presigned_url

def test_is_private_folder():
    assert is_private_folder("client-files") is True
    assert is_private_folder("proposal-pdfs") is True
    assert is_private_folder("generated-documents") is True
    assert is_private_folder("proposal-assets") is True
    assert is_private_folder("invoices") is True
    assert is_private_folder("receipts") is True
    assert is_private_folder("vault-documents") is True
    assert is_private_folder("supplier-pdfs") is True
    assert is_private_folder("signatures") is True
    assert is_private_folder("digital-signatures") is True
    assert is_private_folder("passports") is True
    assert is_private_folder("visas") is True
    assert is_private_folder("passport-uploads") is True
    assert is_private_folder("visa-uploads") is True
    
    assert is_private_folder("logos") is False
    assert is_private_folder("covers") is False
    assert is_private_folder("hotels") is False
    assert is_private_folder("activities") is False
    assert is_private_folder("destinations") is False
    assert is_private_folder("templates") is False
    assert is_private_folder("general") is False

def test_upload_file_to_r2_mock_fallback(tmp_path, monkeypatch):
    # Test that when CF_R2 credentials are not set, it falls back to mock storage
    monkeypatch.setenv("CF_R2_PRIVATE_ACCESS_KEY_ID", "")
    monkeypatch.setenv("CF_R2_PUBLIC_ACCESS_KEY_ID", "")
    
    result = upload_file_to_r2(
        file_bytes=b"mock pdf bytes",
        filename="test_supplier.pdf",
        folder="supplier-pdfs",
        agency_id="test-agency",
        content_type="application/pdf"
    )
    
    assert result is not None
    assert "mock-files/supplier-pdfs/test-agency" in result["url"]
    assert result["is_private"] is True
    assert "mock" in result["bucket"]
    
    # Verify mock file actually created on disk
    mock_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "public_r2_mock",
        "supplier-pdfs",
        "test-agency"
    )
    assert os.path.exists(mock_dir)
    files = os.listdir(mock_dir)
    assert len(files) > 0

def test_get_presigned_url_mock_fallback(monkeypatch):
    monkeypatch.setenv("CF_R2_PRIVATE_ACCESS_KEY_ID", "")
    key = "supplier-pdfs/test-agency/some-unique-file.pdf"
    url = get_presigned_url(key)
    assert url == "http://127.0.0.1:8000/api/storage/mock-files/supplier-pdfs/test-agency/some-unique-file.pdf"

def test_upload_and_get_text_r2(monkeypatch):
    monkeypatch.setenv("CF_R2_PRIVATE_ACCESS_KEY_ID", "")
    from src.services.r2_storage_service import upload_text_to_r2, get_text_from_r2
    
    key = upload_text_to_r2("Hello World raw text", "test_raw.txt", "vault-raw-text", "test-agency")
    assert key is not None
    assert "vault-raw-text/test-agency/" in key
    
    retrieved = get_text_from_r2(key)
    assert retrieved == "Hello World raw text"

def test_upload_and_get_json_r2(monkeypatch):
    monkeypatch.setenv("CF_R2_PRIVATE_ACCESS_KEY_ID", "")
    from src.services.r2_storage_service import upload_json_to_r2, get_json_from_r2
    
    data = {"name": "Paris Itinerary", "items": [1, 2, 3]}
    key = upload_json_to_r2(data, "output.json", "ai-cache", "test-agency")
    assert key is not None
    assert "ai-cache/test-agency/" in key
    
    retrieved = get_json_from_r2(key)
    assert retrieved == data

