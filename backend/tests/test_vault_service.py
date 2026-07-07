"""Tests for secure filename generation and cleanup in pdf_vault_service."""
import os
import time
import pytest
from src.services.pdf_vault_service import save_temporary_pdf, cleanup_expired_pdfs, TEMP_PDF_DIR

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

def test_cleanup_expired_pdfs(tmp_path, monkeypatch):
    monkeypatch.setattr("src.services.pdf_vault_service.TEMP_PDF_DIR", str(tmp_path))
    
    # Create an old file (16 days old)
    old_file = tmp_path / "old_doc.pdf"
    old_file.write_bytes(b"old")
    old_time = time.time() - (16 * 24 * 3600)
    os.utime(old_file, (old_time, old_time))
    
    # Create a fresh file
    fresh_file = tmp_path / "fresh_doc.pdf"
    fresh_file.write_bytes(b"fresh")
    
    res = cleanup_expired_pdfs()
    assert res["deleted"] == 1
    assert not os.path.exists(old_file)
    assert os.path.exists(fresh_file)
