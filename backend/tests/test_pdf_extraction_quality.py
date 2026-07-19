import os
import glob
import pytest
from src.services.import_service import PdfExtractor

@pytest.mark.anyio
async def test_kashmir_pdf_extraction_quality():
    # Find the Kashmir PDF in the temp directory
    temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_supplier_pdfs")
    pdf_pattern = os.path.join(temp_dir, "*Mr._Shivam_Bhardwaj.pdf")
    pdf_files = glob.glob(pdf_pattern)
    
    if not pdf_files:
        pytest.skip("Kashmir test PDF not found in temp directory.")
        
    pdf_path = pdf_files[0]
    filename = os.path.basename(pdf_path)
    
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()
        
    extractor = PdfExtractor()
    result = await extractor.extract(
        file_bytes=file_bytes,
        filename=filename,
        destination_hint="Kashmir",
        agency_id="db64c8d5-1bfa-4c4f-9e6b-ec4718012678"  # Mock agency
    )
    
    # Assertions to ensure Zero-Miss Extraction
    assert result is not None, "Extraction returned None"
    assert "days" in result, "No days field in result"
    
    # Kashmir PDF is a 7 nights / 8 days plan
    days = result["days"]
    print("Extracted Days:", len(days))
    assert len(days) >= 6, f"Expected at least 6 days, extracted {len(days)}"
    
    # Verify hotels are extracted
    hotels = result.get("hotels", [])
    print("Extracted Hotels:", [h.get("name") for h in hotels])
    assert len(hotels) >= 2, f"Expected at least 2 hotels, extracted {len(hotels)}"
    
    # Verify extra sections are present
    extra_sections = result.get("extra_sections", {})
    print("Extracted Extra Sections:", list(extra_sections.keys()))
    assert len(extra_sections) > 0, "No extra sections extracted"
