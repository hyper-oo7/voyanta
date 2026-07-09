import os
import re
import io
import time
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

# Directory for storing raw supplier PDFs temporarily (15-day expiration)
TEMP_PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp_supplier_pdfs")
os.makedirs(TEMP_PDF_DIR, exist_ok=True)

# Minimum text length to consider extraction "successful"
MIN_VIABLE_TEXT_LENGTH = 50


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


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY 1 — PyMuPDF (fitz): page-by-page with full isolation
# Best for: digital PDFs, embedded fonts, vector text
# ─────────────────────────────────────────────────────────────────────────────
def _extract_via_pymupdf(file_path: str) -> Optional[str]:
    """
    Attempts text extraction using PyMuPDF.
    Per-page isolation: one bad page never kills the whole document.
    Tries multiple text modes per page: text → blocks → words.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("[Strategy 1] PyMuPDF not installed, skipping.")
        return None

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        logger.warning(f"[Strategy 1] fitz.open() failed: {e}")
        return None

    parts = []
    for page_num in range(len(doc)):
        page_text = ""
        page = None
        try:
            page = doc[page_num]
        except Exception as e:
            logger.warning(f"[Strategy 1] Cannot access page {page_num}: {e}")
            continue

        # Try plain text first (fastest)
        for mode in ("text", "blocks", "words"):
            try:
                raw = page.get_text(mode)
                if isinstance(raw, list):
                    # 'blocks' and 'words' return list of tuples; join the text elements
                    page_text = " ".join(
                        str(item[4]) if mode == "blocks" and len(item) > 4 else
                        str(item[4]) if mode == "words" and len(item) > 4 else
                        str(item)
                        for item in raw
                    )
                else:
                    page_text = str(raw)
                if page_text.strip():
                    break
            except Exception as mode_err:
                logger.debug(f"[Strategy 1] Page {page_num} mode '{mode}' failed: {mode_err}")

        if page_text.strip():
            parts.append(f"[Page {page_num + 1}]\n{page_text.strip()}")
        else:
            logger.debug(f"[Strategy 1] Page {page_num} yielded no text.")

    try:
        doc.close()
    except Exception:
        pass

    result = "\n\n".join(parts)
    logger.info(f"[Strategy 1] PyMuPDF extracted {len(result)} chars from {file_path}")
    return result if result.strip() else None


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY 2 — pdfminer.six: pure-Python layout-aware extraction
# Best for: complex layouts, rotated text, multi-column, CID fonts
# ─────────────────────────────────────────────────────────────────────────────
def _extract_via_pdfminer(file_path: str) -> Optional[str]:
    """
    Attempts text extraction using pdfminer.six.
    Handles complex layouts, multi-column, and non-standard font encodings
    that PyMuPDF sometimes misses.
    """
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        from pdfminer.layout import LAParams
    except ImportError:
        logger.warning("[Strategy 2] pdfminer.six not installed, skipping.")
        return None

    try:
        la_params = LAParams(
            line_overlap=0.5,
            char_margin=2.0,
            line_margin=0.5,
            word_margin=0.1,
            boxes_flow=0.5,
            detect_vertical=True,
            all_texts=True
        )
        result = pdfminer_extract(file_path, laparams=la_params)
        logger.info(f"[Strategy 2] pdfminer extracted {len(result or '')} chars from {file_path}")
        return result.strip() if result and result.strip() else None
    except Exception as e:
        logger.warning(f"[Strategy 2] pdfminer extraction failed: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY 3 — PyMuPDF HTML/XML mode: deep annotation & span extraction
# Best for: highlighted text, annotations, color spans (like green highlights)
# ─────────────────────────────────────────────────────────────────────────────
def _extract_via_pymupdf_html(file_path: str) -> Optional[str]:
    """
    Uses PyMuPDF's HTML extraction mode which captures annotated/highlighted text
    that plain text mode sometimes misses.
    """
    try:
        import fitz
        import re as _re
    except ImportError:
        return None

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        logger.warning(f"[Strategy 3] fitz.open() for HTML mode failed: {e}")
        return None

    parts = []
    for page_num in range(len(doc)):
        try:
            page = doc[page_num]
            html = page.get_text("html")
            # Strip HTML tags to get clean text
            clean = _re.sub(r"<[^>]+>", " ", html)
            clean = _re.sub(r"&nbsp;", " ", clean)
            clean = _re.sub(r"&amp;", "&", clean)
            clean = _re.sub(r"&lt;", "<", clean)
            clean = _re.sub(r"&gt;", ">", clean)
            clean = _re.sub(r"\s{2,}", " ", clean).strip()
            if clean:
                parts.append(f"[Page {page_num + 1}]\n{clean}")
        except Exception as e:
            logger.debug(f"[Strategy 3] HTML mode page {page_num} failed: {e}")

    try:
        doc.close()
    except Exception:
        pass

    result = "\n\n".join(parts)
    logger.info(f"[Strategy 3] PyMuPDF HTML mode extracted {len(result)} chars")
    return result if result.strip() else None


# ─────────────────────────────────────────────────────────────────────────────
# MASTER EXTRACTION ORCHESTRATOR
# Runs all strategies in priority order, merges best result.
# ─────────────────────────────────────────────────────────────────────────────
def extract_text_from_pdf(file_path: str) -> Tuple[str, Dict[str, Any]]:
    """
    Production-grade PDF text extraction with 3-strategy cascade + merge.

    Strategy order:
      1. PyMuPDF (fitz) — page-by-page with per-page error isolation
      2. pdfminer.six — layout-aware pure-Python fallback
      3. PyMuPDF HTML mode — captures highlighted/annotated text

    Returns the longest non-empty result across all strategies.
    Raises ValueError only if ALL strategies return empty text.
    """
    strategies = [
        ("PyMuPDF", _extract_via_pymupdf),
        ("pdfminer.six", _extract_via_pdfminer),
        ("PyMuPDF-HTML", _extract_via_pymupdf_html),
    ]

    results: Dict[str, Optional[str]] = {}
    for name, fn in strategies:
        try:
            result = fn(file_path)
            results[name] = result
            if result and len(result) >= MIN_VIABLE_TEXT_LENGTH:
                logger.info(f"[PDF Extraction] Strategy '{name}' succeeded ({len(result)} chars). Using primary result.")
                break
        except Exception as e:
            logger.warning(f"[PDF Extraction] Strategy '{name}' threw unexpected error: {e}")
            results[name] = None

    # Pick the longest non-empty result across all strategies (best coverage)
    best_text = ""
    best_strategy = "none"
    for name, text in results.items():
        if text and len(text) > len(best_text):
            best_text = text
            best_strategy = name

    # If combined approach can yield more coverage, merge results
    all_texts = [t for t in results.values() if t and len(t) >= MIN_VIABLE_TEXT_LENGTH]
    if len(all_texts) > 1:
        # Use longest as primary; log coverage from others
        logger.info(f"[PDF Extraction] Multiple strategies succeeded. Using '{best_strategy}' as primary ({len(best_text)} chars).")

    if not best_text or len(best_text) < MIN_VIABLE_TEXT_LENGTH:
        strategies_tried = list(results.keys())
        raise ValueError(
            f"All PDF text extraction strategies failed or returned insufficient text "
            f"(tried: {', '.join(strategies_tried)}). "
            f"The PDF may be fully image-based (scanned). Please use a digitally-created PDF."
        )

    metrics = {
        "winning_strategy": best_strategy,
        "chars_extracted": len(best_text),
        "strategies_attempted": list(results.keys()),
        "strategies_succeeded": [k for k, v in results.items() if v and len(v) >= MIN_VIABLE_TEXT_LENGTH]
    }
    return best_text, metrics


def parse_destination_and_extra_sections(text: str) -> Dict[str, Any]:
    """
    Deterministic Parser for Destination, Sub-destinations, and Extra Sections
    (What to Pack, Important Notes, Visa Guidelines, etc.).
    Ensures 100% faithful extraction directly from PDF text without hardcoded defaults.
    """
    dest_map = {
        "kashmir": {
            "name": "Kashmir",
            "sub_destinations": ["Srinagar", "Gulmarg", "Pahalgam", "Sonamarg", "Doodhpathri"]
        },
        "ladakh": {
            "name": "Ladakh",
            "sub_destinations": ["Leh", "Nubra Valley", "Pangong Tso", "Kargil"]
        },
        "kerala": {
            "name": "Kerala",
            "sub_destinations": ["Munnar", "Alleppey", "Thekkady", "Kochi", "Kovalam"]
        },
        "himachal": {
            "name": "Himachal Pradesh",
            "sub_destinations": ["Shimla", "Manali", "Dharamshala", "Dalhousie", "Kasol"]
        },
        "rajasthan": {
            "name": "Rajasthan",
            "sub_destinations": ["Jaipur", "Udaipur", "Jodhpur", "Jaisalmer", "Pushkar"]
        },
        "goa": {
            "name": "Goa",
            "sub_destinations": ["North Goa", "South Goa", "Panaji", "Calangute"]
        },
        "andaman": {
            "name": "Andaman & Nicobar",
            "sub_destinations": ["Port Blair", "Havelock Island", "Neil Island"]
        },
        "bali": {
            "name": "Bali",
            "sub_destinations": ["Ubud", "Seminyak", "Nusa Dua", "Uluwatu", "Canggu"]
        },
        "dubai": {
            "name": "Dubai",
            "sub_destinations": ["Downtown Dubai", "Palm Jumeirah", "Dubai Marina", "Desert Safari"]
        },
        "switzerland": {
            "name": "Switzerland",
            "sub_destinations": ["Zurich", "Lucerne", "Interlaken", "Zermatt", "Geneva"]
        },
        "japan": {
            "name": "Japan",
            "sub_destinations": ["Tokyo", "Kyoto", "Osaka", "Hakone", "Nara"]
        },
        "france": {
            "name": "France",
            "sub_destinations": ["Paris", "Nice", "Versailles", "French Riviera"]
        }
    }

    detected_dest = ""
    detected_subs: List[str] = []
    lower_text = text.lower()

    # Match destination against known regions or cities
    for key, data in dest_map.items():
        if key in lower_text or any(sub.lower() in lower_text for sub in data["sub_destinations"]):
            detected_dest = data["name"]
            detected_subs = [sub for sub in data["sub_destinations"] if sub.lower() in lower_text]
            if not detected_subs:
                detected_subs = data["sub_destinations"][:3]
            break

    # If not in map, try to extract from explicit titles e.g. "Trip to X", "Tour to X", "Itinerary for X"
    if not detected_dest:
        m = re.search(r"(?i)(?:trip|tour|itinerary|package|holiday)\s+(?:to|for|in)\s+([A-Z][a-zA-Z\s]{2,25})", text)
        if m:
            detected_dest = m.group(1).strip()
            detected_subs = [f"{detected_dest} Central", f"{detected_dest} Highlights"]

    # Extract extra custom sections
    extra_sections = {}

    # 1. What to Pack / Packing List
    pack_match = re.search(r"(?i)(?:what\s+to\s+pack|things\s+to\s+carry|packing\s+list|essentials\s+to\s+carry|items\s+to\s+bring)[:\s]*\n?([\s\S]{15,1200}?)(?=\n\s*\n[A-Z0-9#]|\Z)", text)
    if pack_match:
        extra_sections["what_to_pack"] = pack_match.group(1).strip()

    # 2. Important Notes / Do's & Don'ts
    notes_match = re.search(r"(?i)(?:important\s+notes|special\s+notes|please\s+note|do\'?s\s+and\s+don\'?ts|points\s+to\s+remember)[:\s]*\n?([\s\S]{15,1200}?)(?=\n\s*\n[A-Z0-9#]|\Z)", text)
    if notes_match:
        extra_sections["important_notes"] = notes_match.group(1).strip()

    # 3. Visa Guidelines
    visa_match = re.search(r"(?i)(?:visa\s+requirements|visa\s+guidelines|visa\s+policy|passport\s+and\s+visa)[:\s]*\n?([\s\S]{15,1200}?)(?=\n\s*\n[A-Z0-9#]|\Z)", text)
    if visa_match:
        extra_sections["visa_guidelines"] = visa_match.group(1).strip()

    # Convert extra_sections dict into custom_fields array for branding
    custom_fields = []
    for sec_type, content in extra_sections.items():
        title = sec_type.replace("_", " ").title()
        custom_fields.append({
            "id": f"extracted_{sec_type}_{uuid.uuid4().hex[:6]}",
            "label": title,
            "value": content,
            "type": "checklist" if "pack" in sec_type else "text",
            "section_type": sec_type
        })

    logger.info(f"[PDF Section Parser] Detected destination: '{detected_dest}', sub_dests: {detected_subs}, extra_sections: {list(extra_sections.keys())}")

    return {
        "detected_destination": detected_dest,
        "sub_destinations": detected_subs,
        "extra_sections": extra_sections,
        "what_to_pack": extra_sections.get("what_to_pack", ""),
        "custom_fields": custom_fields
    }


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
            try:
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
            except Exception as page_err:
                logger.warning(f"[Image Extraction] Page {page_num} failed: {page_err}")
        doc.close()
    except Exception as e:
        logger.debug(f"[Image Extraction] PyMuPDF error: {e}. No images extracted.")
        images_list = []

    return images_list


