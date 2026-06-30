import os
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

async def generate_pdf_from_proposal(proposal_id: str) -> bytes:
    url = f"{FRONTEND_URL}/proposals/{proposal_id}/print"
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Navigate to the hidden print route and wait for network idle
            await page.goto(url, wait_until='networkidle', timeout=60000)
            
            # Add a slight delay just in case some images take a second after networkidle
            await page.wait_for_timeout(2000)
            
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
            )
            
            await browser.close()
            return pdf_bytes
            
    except Exception as e:
        logger.exception("Playwright PDF generation failed")
        raise e
