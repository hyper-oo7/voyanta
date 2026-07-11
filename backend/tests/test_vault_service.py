"""Tests for secure filename generation and cleanup in pdf_vault_service."""
import os
import time
import pytest
from src.services.pdf_vault_service import save_temporary_pdf, TEMP_PDF_DIR

def test_save_temporary_pdf_generates_uuid_filename(tmp_path, monkeypatch):
    monkeypatch.setattr("src.services.pdf_vault_service.TEMP_PDF_DIR", str(tmp_path))
    
    res1 = save_temporary_pdf(b"mock pdf content 1", "test_doc.pdf")
    res2 = save_temporary_pdf(b"mock pdf content 2", "test_doc.pdf")
    
    path1 = res1["file_path"]
    path2 = res2["file_path"]
    
    # Check both files exist
    assert os.path.exists(path1)
    assert os.path.exists(path2)
    
    # Check that filenames are distinct even if original filename is identical and created in the same second
    assert path1 != path2
    
    # Check filename structure contains hex UUID (at least 16 hex chars after timestamp_)
    basename = os.path.basename(path1)
    parts = basename.split("_")
    assert len(parts) >= 3
    assert len(parts[1]) == 16  # uuid hex slice

def test_permanent_pdf_storage_after_time_passage(tmp_path, monkeypatch):
    monkeypatch.setattr("src.services.pdf_vault_service.TEMP_PDF_DIR", str(tmp_path))
    
    # Create a PDF file via save_temporary_pdf
    res = save_temporary_pdf(b"supplier PDF content", "supplier_itinerary.pdf")
    file_path = res["file_path"]
    assert os.path.exists(file_path)
    
    # Simulate passage of 30 days (set access & modification time to 30 days ago)
    thirty_days_ago = time.time() - (30 * 24 * 3600)
    os.utime(file_path, (thirty_days_ago, thirty_days_ago))
    
    # Verify that the PDF still exists and is not deleted from disk
    assert os.path.exists(file_path)
    with open(file_path, "rb") as f:
        content = f.read()
    assert content == b"supplier PDF content"


def test_permanent_pdf_db_storage_and_query_retention():
    """
    Test that when a supplier PDF is uploaded/saved in vault_packages,
    even if we simulate 30 days passing (by modifying the mock record's
    created_at / expires_at values), the package remains active, queryable,
    and retrievable (not deleted).
    """
    from unittest.mock import MagicMock, patch
    from src.services.vault_knowledge_service import save_vault_package, list_vault_packages

    # Create mock Supabase response/client
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    
    # Mock search/dedup query to return empty data (new insert)
    mock_query = MagicMock()
    mock_table.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[])
    
    # Mock insert to return a created record
    mock_inserted_record = {
        "id": "mock-pkg-uuid-12345",
        "destination": "Ladakh",
        "pdf_filename": "supplier_package.pdf",
        "source_pdf_hash": "abc123hash",
        "status": "active",
        "created_at": "2026-06-10T20:00:00.000000",  # 30 days in the past
        "expires_at": None,  # Expiration is disabled/None
        "pdf_url": "https://pub-5b335169d19649a18c149e3e1de3a858.r2.dev/supplier-pdfs/default/xyz.pdf"
    }
    mock_table.insert.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[mock_inserted_record])

    with patch("src.services.supabase_client.get_supabase_client", return_value=mock_sb):
        # 1. Save vault package (simulating upload)
        parsed_data = {
            "destination": "Ladakh",
            "total_price": 50000,
            "duration_days": 5,
        }
        res = save_vault_package(
            parsed_data=parsed_data,
            pdf_filename="supplier_package.pdf",
            pdf_hash="abc123hash",
            agency_id="agency-123",
            user_id="user-123",
            pdf_url="https://pub-5b335169d19649a18c149e3e1de3a858.r2.dev/supplier-pdfs/default/xyz.pdf",
            raw_text="Delhi tour check in Taj Delhi",
            extraction_version="v2.0.0"
        )
        
        assert res is not None
        assert res["id"] == "mock-pkg-uuid-12345"
        # Verify database update payload contains raw_text and extraction_version
        mock_table.update.assert_called_once()
        updated_payload = mock_table.update.call_args[0][0]
        assert updated_payload["raw_text"] == "Delhi tour check in Taj Delhi"
        assert updated_payload["extraction_version"] == "v2.0.0"

        # 2. Simulate 30 days passing, query list of packages
        mock_list_query = MagicMock()
        mock_table.select.return_value = mock_list_query
        mock_list_query.eq.return_value = mock_list_query
        mock_list_query.order.return_value = mock_list_query
        mock_list_query.execute.return_value = MagicMock(data=[mock_inserted_record])
        
        packages = list_vault_packages(agency_id="agency-123")
        assert len(packages) == 1
        assert packages[0]["id"] == "mock-pkg-uuid-12345"
        assert packages[0]["status"] == "active"
        assert packages[0]["pdf_filename"] == "supplier_package.pdf"


