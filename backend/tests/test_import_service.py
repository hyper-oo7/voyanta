import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from src.main import app
from src.core.security import verify_token
from src.services.import_service import PdfExtractor, XlsxExtractor, CsvExtractor

app.dependency_overrides[verify_token] = lambda: {"id": "test-user", "agency_id": "test-agency"}
client = TestClient(app)

@pytest.fixture
def mock_gemini():
    with patch("src.services.cascading_ai_service.extract_vault_package_from_text") as mock:
        mock.return_value = {
            "destination": "Paris",
            "sub_destinations": ["Eiffel Tower", "Louvre"],
            "duration_days": 3,
            "currency": "EUR",
            "total_price": 3000,
            "overview": "Short trip to Paris",
            "days": [
                {
                    "day_number": 1,
                    "title": "Arrival in Paris",
                    "description": "Check in to hotel.",
                    "hotels": [{"name": "Hotel Ritz", "category": "5 Star", "price_per_night": 1000}],
                    "activities": [{"name": "Eiffel Tower Visit", "price": 50}],
                    "transfers": [],
                    "meals": []
                }
            ],
            "extra_sections": {
                "what_to_pack": "Warm clothes, camera",
                "visa_guidelines": "Schengen Visa required"
            }
        }
        yield mock

@pytest.fixture
def mock_r2():
    with patch("src.services.r2_storage_service.upload_file_to_r2") as mock:
        mock.return_value = {"url": "https://pub-mock.r2.dev/supplier-pdfs/test.pdf"}
        yield mock

@pytest.fixture
def mock_supabase():
    with patch("src.services.supabase_client.get_supabase_client") as mock:
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[])
        mock_table.insert.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"id": "mock-package-id"}])
        mock.return_value = mock_client
        yield mock

@pytest.fixture
def mock_entitlements():
    with patch("src.core.entitlements.get_agency_entitlements_data") as mock:
        mock.return_value = {
            "tier": "Premium",
            "features": {"ai_vault": True, "ai_rewrite": True},
            "max_proposals_per_month": 100
        }
        yield mock

@pytest.fixture
def mock_semantic_cache():
    with patch("src.api.routers.import_router.get_cached_recommendation") as mock_get, \
         patch("src.api.routers.import_router.store_cached_recommendation") as mock_store:
        mock_get.return_value = None
        mock_store.return_value = True
        yield mock_get, mock_store


def test_extractors_instantiation():
    pdf_ext = PdfExtractor()
    xlsx_ext = XlsxExtractor()
    csv_ext = CsvExtractor()
    assert pdf_ext is not None
    assert xlsx_ext is not None
    assert csv_ext is not None

@pytest.mark.anyio
@patch("src.services.pdf_vault_service.extract_text_from_pdf")
async def test_pdf_extractor_flow(mock_extract_text, mock_gemini, mock_r2):
    mock_extract_text.return_value = ("Eiffel Tower is beautiful", {"winning_strategy": "PyMuPDF", "chars_extracted": 25})
    pdf_ext = PdfExtractor()
    
    # Mock PyMuPDF fitz.open
    with patch("fitz.open") as mock_fitz_open:
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_doc.__len__.return_value = 1
        mock_doc.__getitem__.return_value = mock_page
        mock_page.get_images.return_value = []
        mock_fitz_open.return_value = mock_doc
        
        result = await pdf_ext.extract(
            file_bytes=b"%PDF-1.4 mock content",
            filename="itinerary.pdf",
            agency_id="agency-123"
        )
        
        assert result["source_type"] == "pdf"
        assert result["destination"] == "Paris"
        assert len(result["days"]) == 1
        assert len(result["hotels"]) == 1
        assert result["hotels"][0]["name"] == "Hotel Ritz"
        assert "fields" in result
        assert result["fields"]["destination"]["value"] == "Paris"
        assert result["fields"]["destination"]["source"] == "ai"

def test_import_process_endpoint_pdf(mock_gemini, mock_r2, mock_supabase, mock_entitlements, mock_semantic_cache):
    with patch("src.services.pdf_vault_service.extract_text_from_pdf") as mock_extract_text, \
         patch("fitz.open") as mock_fitz_open:
         
        mock_extract_text.return_value = ("Itinerary to Paris", {"winning_strategy": "PyMuPDF", "chars_extracted": 18})
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_doc.__len__.return_value = 1
        mock_doc.__getitem__.return_value = mock_page
        mock_page.get_images.return_value = []
        mock_fitz_open.return_value = mock_doc
        
        # Test default preview_only=True workflow
        response = client.post(
            "/api/import/process",
            files={"file": ("itinerary.pdf", b"%PDF-1.4 mock content")},
            data={"destination": "Paris", "budget": "2000", "duration": "3", "preview_only": "true"}
        )
        
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["status"] == "success"
        assert json_data["cache_hit"] is False
        assert json_data["preview_only"] is True
        assert json_data["data"]["destination"] == "Paris"
        assert json_data["data"]["source_type"] == "pdf"
        assert "overall_confidence_score" in json_data["data"]

        # Test preview_only=False direct save workflow
        response_direct = client.post(
            "/api/import/process",
            files={"file": ("itinerary.pdf", b"%PDF-1.4 mock content")},
            data={"destination": "Paris", "budget": "2000", "duration": "3", "preview_only": "false"}
        )
        assert response_direct.status_code == 200
        json_direct = response_direct.json()
        assert json_direct["data"]["vault_package_id"] == "mock-package-id"

def test_import_confirm_endpoint(mock_gemini, mock_r2, mock_supabase, mock_entitlements, mock_semantic_cache):
    confirm_payload = {
        "destination": "Paris",
        "days": [{"day_number": 1, "title": "Arrival", "description": "Welcome to Paris"}],
        "total_price": 2500,
        "currency": "EUR",
        "source_type": "pdf",
        "_pdf_filename": "reviewed_paris.pdf"
    }
    response = client.post("/api/import/confirm", json=confirm_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert "vault_package_id" in res_data["data"] or res_data["data"].get("destination") == "Paris"

def test_import_process_endpoint_invalid_pdf(mock_gemini, mock_r2, mock_supabase, mock_entitlements, mock_semantic_cache):
    response = client.post(
        "/api/import/process",
        files={"file": ("itinerary.pdf", b"fake pdf contents that do not start with magic bytes")},
        data={"destination": "Paris", "budget": "2000", "duration": "3"}
    )
    assert response.status_code == 400
    assert "Only valid PDF files starting with '%PDF-'" in response.json()["detail"]

def test_import_process_endpoint_invalid_excel(mock_gemini, mock_r2, mock_supabase, mock_entitlements, mock_semantic_cache):
    response = client.post(
        "/api/import/process",
        files={"file": ("spreadsheet.xlsx", b"not zip magic bytes")},
        data={"destination": "Paris", "budget": "2000", "duration": "3"}
    )
    assert response.status_code == 400
    assert "Only valid spreadsheet files" in response.json()["detail"]

def test_import_process_endpoint_invalid_csv(mock_gemini, mock_r2, mock_supabase, mock_entitlements, mock_semantic_cache):
    # CSV file that contains zip magic bytes (silently relabeled binary file)
    response = client.post(
        "/api/import/process",
        files={"file": ("table.csv", b"PK\x03\x04ziparchivecontents")},
        data={"destination": "Paris", "budget": "2000", "duration": "3"}
    )
    assert response.status_code == 400
    assert "Binary format or unsupported content detected" in response.json()["detail"]
