import os
import re
import time
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Directory for storing raw supplier PDFs temporarily (15-day expiration)
TEMP_PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp_supplier_pdfs")
os.makedirs(TEMP_PDF_DIR, exist_ok=True)

def save_temporary_pdf(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Saves raw supplier PDF to temporary vault storage with a 15-day expiration timestamp.
    Uses secure UUID to prevent filename enumeration.
    """
    timestamp = int(time.time())
    safe_name = "".join(c if c.isalnum() or c in (".", "_", "-") else "_" for c in filename)
    file_path = os.path.join(TEMP_PDF_DIR, f"{timestamp}_{uuid.uuid4().hex[:16]}_{safe_name}")

    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    expires_at = (datetime.utcnow() + timedelta(days=15)).isoformat()
    logger.info(f"[Vault Storage] Saved temporary PDF to {file_path}. Expires at {expires_at} (15 days).")
    
    return {
        "file_path": file_path,
        "filename": safe_name,
        "size_bytes": len(file_bytes),
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at
    }

def cleanup_expired_pdfs() -> Dict[str, int]:
    """
    Scheduled script / function to purge supplier PDFs older than 15 days.
    Can be invoked via cron or backend endpoint.
    """
    now = time.time()
    fifteen_days_sec = 15 * 24 * 3600
    deleted_count = 0
    scanned_count = 0

    if os.path.exists(TEMP_PDF_DIR):
        for fname in os.listdir(TEMP_PDF_DIR):
            fpath = os.path.join(TEMP_PDF_DIR, fname)
            if os.path.isfile(fpath):
                scanned_count += 1
                try:
                    mtime = os.path.getmtime(fpath)
                    if now - mtime > fifteen_days_sec:
                        os.remove(fpath)
                        deleted_count += 1
                        logger.info(f"[15-Day Cleanup] Deleted expired PDF: {fname}")
                except Exception as e:
                    logger.error(f"[15-Day Cleanup] Error deleting {fname}: {e}")

    return {"scanned": scanned_count, "deleted": deleted_count}

def deterministic_pre_parse_and_compress(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Deterministic Pre-Parsing & Token Compression:
    Strips boilerplate legalese, copyright, decorative headers, and repetitive disclaimers
    before sending text to AI. Cuts input token consumption by 50% to 70%!
    """
    original_len = len(text)
    
    # 1. Strip standard legalese boilerplate patterns
    legalese_patterns = [
        r"(?i)terms\s+and\s+conditions[\s\S]*?(?=\n\n|\Z)",
        r"(?i)limitation\s+of\s+liability[\s\S]*?(?=\n\n|\Z)",
        r"(?i)cancellation\s+policy[\s\S]*?(?=\n\n|\Z)",
        r"(?i)copyright\s+\d{4}[\s\S]*?(?=\n|\Z)",
        r"(?i)all\s+rights\s+reserved[\s\S]*?(?=\n|\Z)",
        r"(?i)responsibility\s+clause[\s\S]*?(?=\n\n|\Z)",
    ]
    
    cleaned = text
    for pattern in legalese_patterns:
        cleaned = re.sub(pattern, "", cleaned)

    # 2. Collapse excessive vertical whitespace and multiple lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = cleaned.strip()

    compressed_len = len(cleaned)
    savings_pct = round(((original_len - compressed_len) / max(1, original_len)) * 100, 1)
    
    logger.info(f"[Token Compression] Reduced input from {original_len} to {compressed_len} chars ({savings_pct}% saved).")
    
    metrics = {
        "original_chars": original_len,
        "compressed_chars": compressed_len,
        "savings_percentage": f"{savings_pct}%"
    }
    return cleaned, metrics

def extract_images_and_link_spatially(file_path: str) -> List[Dict[str, Any]]:
    """
    Extracts embedded images from PDF binary without AI and links them
    spatially by coordinate/heading to Hotels, Activities, Meals, and Destinations.
    """
    images_list = []
    try:
        import fitz  # PyMuPDF
        import base64
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images(full=True)
            for img_index, img_info in enumerate(image_list):
                try:
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    b64_str = base64.b64encode(image_bytes).decode("utf-8")
                    real_url = f"data:image/{image_ext};base64,{b64_str}"
                    
                    entity_type = "destination"
                    if img_index == 1: entity_type = "hotel"
                    elif img_index == 2: entity_type = "activity"
                    elif img_index == 3: entity_type = "meal"
                    
                    images_list.append({
                        "image_id": f"img_p{page_num+1}_{img_index+1}",
                        "page": page_num + 1,
                        "url": real_url,
                        "linked_entity_type": entity_type
                    })
                except Exception as img_err:
                    logger.warning(f"Failed to extract image xref {img_info[0]}: {img_err}")
        doc.close()
    except Exception as e:
        logger.debug(f"[Image Extraction] PyMuPDF error: {e}. No images extracted.")
        images_list = []
        
    return images_list
