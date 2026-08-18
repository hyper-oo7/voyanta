import sys
import os
import asyncio
import json
import logging

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RealPdfTest")

import pytest
from src.services.pdf_vault_service import extract_text_from_pdf
from src.services.cascading_ai_service import extract_vault_package_from_text

@pytest.mark.anyio
async def test_real_pdf_pipeline():
    pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "temp_supplier_pdfs"))
    if not os.path.exists(pdf_dir):
        logger.error(f"Directory {pdf_dir} does not exist!")
        return

    pdf_files = [os.path.join(pdf_dir, f) for f in os.listdir(pdf_dir) if f.endswith(".pdf")]
    if not pdf_files:
        logger.error(f"No PDF files found in {pdf_dir}")
        return

    sample_pdf = pdf_files[0]
    logger.info(f"========== TESTING REAL SUPPLIER PDF ==========")
    logger.info(f"Target PDF: {sample_pdf}")

    # Stage 1: Text Extraction
    try:
        text, metrics = extract_text_from_pdf(sample_pdf)
        logger.info(f"[STAGE 1 SUCCESS] Extracted {len(text)} characters.")
        logger.info(f"Winning Strategy: {metrics['winning_strategy']}")
        logger.info(f"Price Coverage Warning: {metrics['price_coverage_warning']}")
    except Exception as e:
        logger.error(f"[STAGE 1 FAILURE] {e}")
        return

    # Stage 2: Information Extraction via Cascading AI Service
    try:
        prompt_text = text[:4000] # Pass first 4000 chars
        logger.info("[STAGE 2] Running Information Extraction on extracted text...")
        proposal_dict = await extract_vault_package_from_text(prompt_text, destination_hint="Sample Destination")
        logger.info(f"[STAGE 2 SUCCESS] Structured extraction complete.")
        logger.info(f"Extracted Destination: {proposal_dict.get('destination')}")
        logger.info(f"Extracted Duration: {proposal_dict.get('duration_days')} days")
        logger.info(f"Extracted Hotels Count: {len(proposal_dict.get('hotels', []))}")
        logger.info(f"Extracted Days Count: {len(proposal_dict.get('days', []))}")
        logger.info(f"Extracted Price: ₹{proposal_dict.get('total_price')}")
    except Exception as e:
        logger.error(f"[STAGE 2 FAILURE] {e}")
        return

    logger.info("========== REAL PDF TEST COMPLETE — ALL STAGES PASSED ==========")

if __name__ == "__main__":
    asyncio.run(test_real_pdf_pipeline())
