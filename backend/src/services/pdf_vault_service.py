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
    Saves raw supplier PDF to permanent vault storage.
    Uses secure UUID to prevent filename enumeration.
    """
    timestamp = int(time.time())
    safe_name = "".join(c if c.isalnum() or c in (".", "_", "-") else "_" for c in filename)
    file_path = os.path.join(TEMP_PDF_DIR, f"{timestamp}_{uuid.uuid4().hex[:16]}_{safe_name}")

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    logger.info(f"[Vault Storage] Saved PDF to {file_path}. Permanent storage.")

    return {
        "file_path": file_path,
        "filename": safe_name,
        "size_bytes": len(file_bytes),
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": None
    }


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY 1 — PyMuPDF (fitz) dict-mode: reading-order reconstruction
# Best for: digital PDFs, multi-column layouts, tables, mixed fonts
#
# WHY dict-mode over plain text/blocks/words:
#   page.get_text("text") reads glyphs in PDF *stream* order, not visual order.
#   For multi-column PDFs (e.g., Day 1 | Day 2 side-by-side) this interleaves
#   both columns into one garbled block.  dict-mode returns every span with its
#   bounding-box, letting us sort by (y0, x0) to reconstruct top-to-bottom,
#   left-to-right reading order for any column layout.
# ─────────────────────────────────────────────────────────────────────────────
def table_to_markdown(data: List[List[Optional[str]]]) -> str:
    if not data:
        return ""
    
    # Process cells: replace None with "", strip, and join lines with space
    processed_data = []
    for row in data:
        processed_row = []
        for cell in row:
            if cell is None:
                val = ""
            else:
                val = " ".join(cell.split())
            processed_row.append(val)
        if any(processed_row):
            processed_data.append(processed_row)
            
    if not processed_data:
        return ""
        
    num_cols = max(len(row) for row in processed_data)
    
    # Pad rows to match max number of columns
    for row in processed_data:
        while len(row) < num_cols:
            row.append("")
            
    # Find columns that are entirely empty
    non_empty_col_indices = []
    for col_idx in range(num_cols):
        col_has_content = False
        for row in processed_data:
            if row[col_idx].strip():
                col_has_content = True
                break
        if col_has_content:
            non_empty_col_indices.append(col_idx)
            
    if not non_empty_col_indices:
        return ""
        
    # Filter columns to only keep non-empty ones
    filtered_data = []
    for row in processed_data:
        filtered_row = [row[idx] for idx in non_empty_col_indices]
        filtered_data.append(filtered_row)
        
    headers = filtered_data[0]
    headers = [h if h else f"Col {idx+1}" for idx, h in enumerate(headers)]
    num_filtered_cols = len(headers)
    separator = ["---"] * num_filtered_cols
    
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(separator) + " |")
    for row in filtered_data[1:]:
        lines.append("| " + " | ".join(row) + " |")
        
    return "\n".join(lines)

def _extract_via_pymupdf(file_path: str) -> Optional[str]:
    """
    Per-page dict-mode extraction with spatial reading-order sort.
    Each page is isolated; a corrupt page logs a warning and is skipped.
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
        try:
            page = doc[page_num]
        except Exception as e:
            logger.warning(f"[Strategy 1] Cannot access page {page_num}: {e}")
            continue

        page_text = ""
        try:
            page_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_PRESERVE_LIGATURES)
            blocks = page_dict.get("blocks", [])

            # Sort blocks top-to-bottom, then left-to-right by their top-left corner.
            # This reconstructs correct reading order for multi-column layouts.
            sorted_blocks = sorted(blocks, key=lambda b: (round(b["bbox"][1] / 5) * 5, b["bbox"][0]))

            block_lines = []
            for block in sorted_blocks:
                if block.get("type") != 0:  # skip image blocks
                    continue
                for line in block.get("lines", []):
                    # Join spans within the same line with a space.
                    # Consecutive spans on the same baseline share y-coordinates;
                    # we preserve the gap between them as a single space.
                    span_texts = []
                    for span in line.get("spans", []):
                        t = span.get("text", "")
                        if t.strip():
                            span_texts.append(t)
                    line_text = " ".join(span_texts).strip()
                    if line_text:
                        block_lines.append(line_text)

                block_lines.append("")  # blank line between blocks

            page_text = "\n".join(block_lines).strip()
            
            # Extract cell-based tables as Markdown tables (Strategy 4)
            table_markdowns = []
            try:
                tables = page.find_tables()
                if tables and tables.tables:
                    for table in tables.tables:
                        data = table.extract()
                        if data:
                            md = table_to_markdown(data)
                            if md:
                                table_markdowns.append(md)
            except Exception as tbl_err:
                logger.debug(f"[Strategy 1] Table extraction failed on page {page_num}: {tbl_err}")

            if table_markdowns:
                page_text += "\n\n[Extracted Tables from Page " + str(page_num + 1) + "]\n" + "\n\n".join(table_markdowns)

        except Exception as dict_err:
            logger.debug(f"[Strategy 1] dict-mode failed for page {page_num}: {dict_err}")
            # Fallback: plain text mode for this page only
            try:
                page_text = page.get_text("text").strip()
            except Exception:
                pass

        if page_text.strip():
            parts.append(f"[Page {page_num + 1}]\n{page_text.strip()}")
        else:
            logger.debug(f"[Strategy 1] Page {page_num} yielded no text.")

    try:
        doc.close()
    except Exception:
        pass

    result = "\n\n".join(parts)
    logger.info(f"[Strategy 1] PyMuPDF dict-mode extracted {len(result)} chars from {file_path}")
    return result if result.strip() else None


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY 2 — pdfminer.six: per-page layout-aware extraction
# Best for: complex layouts, rotated text, multi-column, CID fonts
#
# UPGRADE from document-level to per-page isolation:
#   The old pdfminer_extract(file_path) call returns one giant string with no
#   per-page fault tolerance — one corrupt page degrades the entire output.
#   The PDFPage iterator lets us wrap each page independently so a bad page
#   is logged and skipped while all other pages still contribute.
# ─────────────────────────────────────────────────────────────────────────────
def _extract_via_pdfminer(file_path: str) -> Optional[str]:
    """
    Per-page pdfminer extraction with per-page isolation.
    LAParams tuning preserves multi-column, vertical text, and tight spacing.
    """
    try:
        from pdfminer.high_level import extract_text_to_fp
        from pdfminer.layout import LAParams
        from pdfminer.pdfpage import PDFPage
        from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
        from pdfminer.converter import TextConverter
    except ImportError:
        logger.warning("[Strategy 2] pdfminer.six not installed, skipping.")
        return None

    la_params = LAParams(
        line_overlap=0.5,
        char_margin=2.0,
        line_margin=0.5,
        word_margin=0.1,
        boxes_flow=0.5,
        detect_vertical=True,
        all_texts=True
    )

    parts = []
    try:
        with open(file_path, "rb") as f:
            rsrcmgr = PDFResourceManager()
            for page_num, page in enumerate(PDFPage.get_pages(f, check_extractable=False)):
                try:
                    output = io.StringIO()
                    device = TextConverter(rsrcmgr, output, laparams=la_params)
                    interpreter = PDFPageInterpreter(rsrcmgr, device)
                    interpreter.process_page(page)
                    device.close()
                    page_text = output.getvalue()
                    if page_text.strip():
                        parts.append(f"[Page {page_num + 1}]\n{page_text.strip()}")
                    else:
                        logger.debug(f"[Strategy 2] Page {page_num} yielded no text.")
                except Exception as page_err:
                    logger.warning(f"[Strategy 2] pdfminer page {page_num} failed: {page_err}")
    except Exception as e:
        logger.warning(f"[Strategy 2] pdfminer document open failed: {e}")
        return None

    result = "\n\n".join(parts)
    logger.info(f"[Strategy 2] pdfminer extracted {len(result)} chars from {file_path}")
    return result if result.strip() else None


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY 3 — PyMuPDF HTML/XML mode: deep annotation & span extraction
# Best for: highlighted text, annotations, color spans (like green highlights)
#
# FIX: Block-level HTML tags (<p>, <div>, <br>) are now converted to newlines
# BEFORE stripping remaining tags.  The old approach collapsed everything to
# spaces, turning structured paragraphs into one long run-on line.
# ─────────────────────────────────────────────────────────────────────────────
def _extract_via_pymupdf_html(file_path: str) -> Optional[str]:
    """
    Uses PyMuPDF's HTML extraction mode which captures annotated/highlighted text
    that plain text mode sometimes misses.
    Block-level tags are converted to newlines before tag stripping to preserve
    paragraph and line structure.
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

            # Step 1: Convert block-level tags to newlines BEFORE stripping.
            # This preserves paragraph and heading boundaries as line breaks.
            clean = _re.sub(r"</?(p|div|br|h[1-6]|li|tr|td|th)[^>]*>", "\n", html, flags=_re.IGNORECASE)

            # Step 2: Strip remaining inline tags.
            clean = _re.sub(r"<[^>]+>", "", clean)

            # Step 3: Decode common HTML entities.
            clean = clean.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

            # Step 4: Collapse horizontal whitespace per line; preserve intentional blank lines.
            lines = [re.sub(r"[ \t]{2,}", " ", ln).strip() for ln in clean.splitlines()]
            # Collapse runs of more than 2 consecutive blank lines to 1
            clean = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()

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
# CONTENT MERGE HELPER
# Unions unique prose paragraphs from secondary strategies into the primary.
# Limitation: paragraph-level dedup works well for narrative text but may
# miss individual table rows that look different per-strategy yet carry the
# same semantic content (e.g., a pricing table extracted differently by
# PyMuPDF vs pdfminer).  The price-coverage heuristic in extract_text_from_pdf
# flags these cases in metrics so callers can decide whether to trust the merge.
# ─────────────────────────────────────────────────────────────────────────────
def _merge_strategy_results(results: Dict[str, Optional[str]]) -> Tuple[str, str, int]:
    """
    Unions unique paragraphs from secondary strategy results into the primary.

    Approach:
      1. Primary = longest viable result (highest raw coverage).
      2. Each secondary result is split on blank lines into paragraphs.
      3. Any paragraph >= 80 chars that is not already a substring of the
         accumulated base is appended.  This catches prose sections a single
         strategy missed (e.g., rotated headings, CID-encoded footnotes).

    Limitation: paragraph-level substring matching does not catch table rows
    that both strategies extracted but formatted differently.  The caller's
    price-coverage heuristic handles this case separately.

    Returns (merged_text, primary_strategy_name, paragraphs_added_from_secondary).
    """
    viable = {name: text for name, text in results.items()
              if text and len(text.strip()) >= MIN_VIABLE_TEXT_LENGTH}

    if not viable:
        return "", "none", 0

    # Primary = longest result
    primary_name = max(viable, key=lambda n: len(viable[n]))
    base = viable[primary_name]

    appended_sections: List[str] = []
    base_lower = base.lower()

    for name, text in viable.items():
        if name == primary_name:
            continue
        paragraphs = re.split(r"\n{2,}", text)
        for para in paragraphs:
            para_stripped = para.strip()
            # Only append paragraphs that are substantial AND absent from the base
            if len(para_stripped) >= 40 and para_stripped.lower() not in base_lower:
                appended_sections.append(para_stripped)
                base_lower += " " + para_stripped.lower()  # update for dedup

    if appended_sections:
        merged = base.rstrip() + "\n\n" + "\n\n".join(appended_sections)
        logger.info(
            f"[PDF Merge] Appended {len(appended_sections)} unique paragraph(s) "
            f"from secondary strategies into primary '{primary_name}' result."
        )
    else:
        merged = base

    return merged, primary_name, len(appended_sections)


# ─────────────────────────────────────────────────────────────────────────────
# MASTER EXTRACTION ORCHESTRATOR
# Runs all three strategies unconditionally, then merges unique prose paragraphs.
# See _merge_strategy_results for the merge algorithm and its limitations.
# ─────────────────────────────────────────────────────────────────────────────
def extract_text_from_pdf(file_path: str) -> Tuple[str, Dict[str, Any]]:
    """
    PDF text extraction with 3-strategy run-all + paragraph-level merge.

    Execution model:
      All three strategies always run regardless of earlier success.
      This is intentional: pdfminer is complementary to PyMuPDF, not merely
      a fallback.  PyMuPDF is faster and handles reading order; pdfminer's
      layout model catches content in CID-encoded fonts and complex column
      flows that PyMuPDF sometimes garbles.

    Merge model (honest description):
      _merge_strategy_results picks the longest result as the primary, then
      appends paragraphs (>= 80 chars) from other strategies that don't appear
      as substrings in the primary.  This works well for prose but does NOT
      reliably merge tabular data — a pricing table that both strategies
      extracted in different formats will appear once (primary's version).
      When this matters, the returned metrics include a 'price_coverage_warning'
      flag so callers can log or surface it.

    Strategy descriptions:
      1. PyMuPDF dict-mode — spatial sort for correct multi-column reading order
      2. pdfminer.six per-page — layout-aware, handles non-standard encodings
      3. PyMuPDF HTML mode — captures annotated/highlighted spans

    Returns (merged_text, metrics).
    Raises ValueError only if ALL strategies return empty text.
    """
    # Regex for price-like tokens: ₹/Rs/INR/$/USD/€/£ followed by a number,
    # or bare numbers formatted as prices (e.g., 12,500 or 1500.00).
    # Used by the table-coverage heuristic below.
    _PRICE_RE = re.compile(
        r"(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP|AED)\s*[\d,]+(?:\.\d+)?"
        r"|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b",  # comma-formatted numbers
        re.IGNORECASE,
    )

    strategies = [
        ("PyMuPDF-dict", _extract_via_pymupdf),
        ("pdfminer.six", _extract_via_pdfminer),
        ("PyMuPDF-HTML", _extract_via_pymupdf_html),
    ]

    results: Dict[str, Optional[str]] = {}
    for name, fn in strategies:
        # All strategies run unconditionally.
        # pdfminer is complementary to PyMuPDF, not just a fallback.
        try:
            result = fn(file_path)
            results[name] = result
            status = f"{len(result)} chars" if result else "empty"
            logger.info(f"[PDF Extraction] Strategy '{name}': {status}")
        except Exception as e:
            logger.warning(f"[PDF Extraction] Strategy '{name}' threw unexpected error: {e}")
            results[name] = None

    merged_text, primary_strategy, paragraphs_added = _merge_strategy_results(results)

    if not merged_text or len(merged_text) < MIN_VIABLE_TEXT_LENGTH:
        strategies_tried = list(results.keys())
        raise ValueError(
            f"All PDF text extraction strategies failed or returned insufficient text "
            f"(tried: {', '.join(strategies_tried)}). "
            f"The PDF may be fully image-based (scanned). Please use a digitally-created PDF."
        )

    # ── Price-coverage heuristic for table-heavy documents ────────────────────
    # Paragraph-level merge works well for prose but can miss pricing tables
    # that pdfminer extracted differently.  Compare the count of price-like
    # tokens in the primary (PyMuPDF) result vs. pdfminer's result.  If
    # pdfminer found significantly more price patterns, the merged output may
    # be missing tabular pricing data and the caller should be aware.
    price_coverage_warning = False
    pymupdf_text = results.get("PyMuPDF-dict") or ""
    pdfminer_text = results.get("pdfminer.six") or ""
    if pymupdf_text and pdfminer_text:
        pymupdf_prices = len(_PRICE_RE.findall(pymupdf_text))
        pdfminer_prices = len(_PRICE_RE.findall(pdfminer_text))
        # Trigger if pdfminer found >= 2x more price tokens than PyMuPDF
        # AND the absolute difference is meaningful (> 5 tokens).
        if pdfminer_prices > 0 and pymupdf_prices < pdfminer_prices / 2 and (pdfminer_prices - pymupdf_prices) > 5:
            price_coverage_warning = True
            logger.warning(
                f"[PDF Extraction] Price-coverage gap detected: PyMuPDF found {pymupdf_prices} "
                f"price tokens, pdfminer found {pdfminer_prices}. "
                f"The merged output is based on PyMuPDF (primary); tabular pricing from "
                f"pdfminer may not be fully captured by the paragraph merge. "
                f"AI extraction will see both strategies' text where they differed."
            )

    metrics = {
        "winning_strategy": primary_strategy,
        "chars_extracted": len(merged_text),
        "strategies_attempted": list(results.keys()),
        "strategies_succeeded": [
            k for k, v in results.items() if v and len(v) >= MIN_VIABLE_TEXT_LENGTH
        ],
        # How many paragraphs the merge pulled in from secondary strategies.
        # 0 means the primary result already covered everything the merge checked.
        "merge_paragraphs_added": paragraphs_added,
        # True when pdfminer found >= 2x more price tokens than PyMuPDF —
        # a signal that this PDF may have pricing tables pdfminer handled
        # better than the primary strategy.
        "price_coverage_warning": price_coverage_warning,
    }

    logger.info(
        f"[PDF Extraction] Final output: {len(merged_text)} chars "
        f"(primary={primary_strategy}, paragraphs_added={paragraphs_added}, "
        f"price_coverage_warning={price_coverage_warning})"
    )
    return merged_text, metrics



def parse_destination_and_extra_sections(text: str) -> Dict[str, Any]:
    """
    Deterministic Pre-Parser for Extra Sections.
    Extracts static sections (What to Pack, Visa, Important Notes, etc.) from
    PDF text using regex before sending to AI — gives AI a head start.

    Destination detection is now handled by the AI extraction prompt.
    This function is kept for pre-AI enrichment only.
    """
    # Extract extra custom sections using regex
    extra_sections = {}

    section_patterns = [
        # What to Pack / Packing List
        ("what_to_pack", r"(?i)(?:what\s+to\s+pack|things\s+to\s+carry|packing\s+list|essentials\s+to\s+carry|items\s+to\s+bring|carry\s+along)[:\s]*\n?([\s\S]{15,2000}?)(?=\n\s*\n[A-Z0-9#]|\Z)"),
        # Important Notes / Do's & Don'ts
        ("important_notes", r"(?i)(?:important\s+notes|special\s+notes|please\s+note|do\'?s\s+and\s+don\'?ts|points\s+to\s+remember|advisory)[:\s]*\n?([\s\S]{15,2000}?)(?=\n\s*\n[A-Z0-9#]|\Z)"),
        # Visa Guidelines
        ("visa_guidelines", r"(?i)(?:visa\s+requirements|visa\s+guidelines|visa\s+policy|passport\s+and\s+visa|visa\s+information)[:\s]*\n?([\s\S]{15,2000}?)(?=\n\s*\n[A-Z0-9#]|\Z)"),
        # Cancellation / Damages
        ("cancellation_policy", r"(?i)(?:cancellation\s+policy|cancellation\s+charges|refund\s+policy)[:\s]*\n?([\s\S]{15,2000}?)(?=\n\s*\n[A-Z0-9#]|\Z)"),
        # Damages
        ("damages", r"(?i)(?:damages|damage\s+policy|damage\s+charges)[:\s]*\n?([\s\S]{15,1000}?)(?=\n\s*\n[A-Z0-9#]|\Z)"),
        # Terms of Payment
        ("terms_of_payment", r"(?i)(?:terms\s+of\s+payment|payment\s+terms|payment\s+schedule|payment\s+policy)[:\s]*\n?([\s\S]{15,2000}?)(?=\n\s*\n[A-Z0-9#]|\Z)"),
    ]

    for section_type, pattern in section_patterns:
        match = re.search(pattern, text)
        if match:
            extra_sections[section_type] = match.group(1).strip()

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

    logger.info(f"[PDF Section Parser] Pre-parsed extra_sections: {list(extra_sections.keys())}")

    return {
        "detected_destination": "",  # Determined by AI extraction, not hardcoded
        "sub_destinations": [],       # Determined by AI extraction
        "extra_sections": extra_sections,
        "what_to_pack": extra_sections.get("what_to_pack", ""),
        "custom_fields": custom_fields
    }



def deterministic_pre_parse_and_compress(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Deterministic Pre-Parsing & Token Compression:
    Strips boilerplate legalese, copyright, decorative headers, and repetitive disclaimers
    before sending text to AI.

    Safety guarantees (added to fix silent content deletion):
      - Each regex match is evaluated individually before removal.
      - If a single match would remove > MAX_STRIP_PCT of the current document,
        it is SKIPPED and a WARNING is logged for human review.
      - A hard char cap (MAX_STRIP_CHARS) prevents runaway [.\\n]* patterns that
        reach end-of-string from eating real itinerary content.
    """
    original_len = len(text)

    # Maximum characters a single boilerplate strip is allowed to remove.
    # Real legalese disclaimers are rarely more than a paragraph (~2 000 chars).
    # Anything longer is almost certainly a runaway match into real content.
    MAX_STRIP_CHARS = 2_000

    # Maximum fraction of the *current* (already-shrinking) document a single
    # pattern application may remove in total.  Exceeding this triggers a WARNING
    # and the entire pattern application is skipped for this document.
    MAX_STRIP_PCT = 0.15  # 15 %

    # 1. Strip standard legalese boilerplate patterns — with per-match safety.
    #
    # IMPORTANT: cancellation_policy is intentionally NOT included here.
    # The AI extraction prompt (Rule 9) explicitly asks for it and the
    # section pre-parser also captures it — stripping it here would cause
    # extra_sections.cancellation_policy to always return null.
    # Terms & Conditions is also excluded: some supplier PDFs embed pricing
    # payment schedules inside T&C that the AI needs to see.
    legalese_patterns = [
        r"(?i)limitation\s+of\s+liability[\s\S]*?(?=\n\n|\Z)",
        r"(?i)copyright\s+\d{4}[\s\S]*?(?=\n|\Z)",
        r"(?i)all\s+rights\s+reserved[\s\S]*?(?=\n|\Z)",
        r"(?i)responsibility\s+clause[\s\S]*?(?=\n\n|\Z)",
    ]

    skipped_patterns: List[str] = []
    applied_patterns: List[str] = []

    PROTECTED_KEYWORDS = {"hotel", "room", "night", "price", "pricing", "cost", "inclusions", "exclusions", "itinerary", "flight", "transfer", "meal", "day", "destination"}

    cleaned = text
    for pattern in legalese_patterns:
        current_len = len(cleaned)
        if current_len == 0:
            break

        # Find all non-overlapping matches for this pattern.
        matches = list(re.finditer(pattern, cleaned))
        if not matches:
            continue

        # Filter out matches that contain protected vocabulary to prevent false-positives
        safe_matches = []
        for m in matches:
            match_text = cleaned[m.start():m.end()].lower()
            if any(kw in match_text for kw in PROTECTED_KEYWORDS):
                logger.warning(
                    f"[Token Compression] SKIPPED strip match: pattern contains protected keyword. "
                    f"Preview: '{match_text[:120].replace('\n', ' ')}...'"
                )
                continue
            safe_matches.append(m)

        if not safe_matches:
            skipped_patterns.append(pattern[:60])
            continue

        # Compute total characters that would be removed by the safe matches.
        total_removed = sum(m.end() - m.start() for m in safe_matches)

        # --- Safety check 1: absolute char cap (per individual match) ---
        oversized = [m for m in safe_matches if (m.end() - m.start()) > MAX_STRIP_CHARS]
        if oversized:
            for m in oversized:
                span_len = m.end() - m.start()
                preview = cleaned[m.start():m.start() + 120].replace("\n", " ")
                logger.warning(
                    f"[Token Compression] SKIPPED strip: pattern matched {span_len} chars "
                    f"(cap={MAX_STRIP_CHARS}) — possible false-positive. "
                    f"Preview: '{preview}...'"
                )
            # Skip the entire pattern for this document if any match is oversized.
            skipped_patterns.append(pattern[:60])
            continue

        # --- Safety check 2: percentage of document cap ---
        removed_pct = total_removed / current_len
        if removed_pct > MAX_STRIP_PCT:
            preview = cleaned[safe_matches[0].start():safe_matches[0].start() + 120].replace("\n", " ")
            logger.warning(
                f"[Token Compression] SKIPPED strip: pattern would remove "
                f"{total_removed} chars ({removed_pct:.1%} of document, "
                f"threshold={MAX_STRIP_PCT:.0%}). "
                f"Preview: '{preview}...'"
            )
            skipped_patterns.append(pattern[:60])
            continue

        # Safe to apply — strip all safe matches for this pattern from end to start to preserve offsets
        for m in sorted(safe_matches, key=lambda x: x.start(), reverse=True):
            cleaned = cleaned[:m.start()] + cleaned[m.end():]
        applied_patterns.append(pattern[:60])

    # 2. Collapse excessive vertical whitespace and multiple lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = cleaned.strip()

    compressed_len = len(cleaned)
    savings_pct = round(((original_len - compressed_len) / max(1, original_len)) * 100, 1)

    if skipped_patterns:
        logger.warning(
            f"[Token Compression] {len(skipped_patterns)} pattern(s) skipped due to safety "
            f"limits — document sent to AI with those sections intact for manual review."
        )

    logger.info(
        f"[Token Compression] Reduced input from {original_len} to {compressed_len} chars "
        f"({savings_pct}% saved). Applied={len(applied_patterns)}, Skipped={len(skipped_patterns)}."
    )

    metrics = {
        "original_chars": original_len,
        "compressed_chars": compressed_len,
        "savings_percentage": f"{savings_pct}%",
        "patterns_applied": len(applied_patterns),
        "patterns_skipped": len(skipped_patterns),
        "skipped_pattern_previews": skipped_patterns,
    }
    return cleaned, metrics



def extract_images_and_link_spatially(file_path: str, agency_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Extracts embedded images from PDF binary, links them spatially by coordinate/heading
    to Hotels, Activities, Meals, Flights, and Days, and uploads them to R2.
    """
    images_list = []
    try:
        import fitz  # PyMuPDF
        import uuid
        from src.services.r2_storage_service import upload_file_to_r2

        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            try:
                page = doc[page_num]
                
                # 1. Extract potential headings on the page via layout analysis
                headings = []
                try:
                    page_dict = page.get_text("dict")
                    for b in page_dict.get("blocks", []):
                        if b.get("type") == 0:  # text block
                            for line in b.get("lines", []):
                                for span in line.get("spans", []):
                                    text = span.get("text", "").strip()
                                    if not text:
                                        continue
                                    
                                    font_lower = span.get("font", "").lower()
                                    is_bold = "bold" in font_lower or "black" in font_lower or (span.get("flags", 0) & 4)
                                    is_large = span.get("size", 0) > 11.0
                                    starts_with_keyword = any(text.lower().startswith(kw) for kw in [
                                        "day", "hotel", "activity", "flight", "transfer", "overview", "inclusion", "exclusion"
                                    ])
                                    
                                    if (is_bold or is_large or starts_with_keyword) and len(text) < 120:
                                        headings.append({
                                            "text": text,
                                            "bbox": span.get("bbox"),  # (x0, y0, x1, y1)
                                            "size": span.get("size")
                                        })
                except Exception as text_err:
                    logger.warning(f"[Spatial Image] Failed to extract text formatting on page {page_num}: {text_err}")

                # 2. Process page images
                image_list = page.get_images(full=True)
                for img_index, img_info in enumerate(image_list):
                    try:
                        xref = img_info[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]

                        # Find coordinate bounding box of the image on this page
                        rects = page.get_image_rects(xref)
                        img_bbox = rects[0] if rects else None

                        # Find the nearest heading spatially
                        nearest_heading = None
                        min_dist = float("inf")
                        
                        if img_bbox and headings:
                            ix0, iy0, ix1, iy1 = img_bbox
                            icx = (ix0 + ix1) / 2
                            icy = (iy0 + iy1) / 2
                            
                            for h in headings:
                                hx0, hy0, hx1, hy1 = h["bbox"]
                                hcx = (hx0 + hx1) / 2
                                hcy = (hy0 + hy1) / 2
                                
                                # Distance metric: prefer headings vertically above
                                if hy1 <= iy0:  # strictly above
                                    dist = (iy0 - hy1) + abs(icx - hcx) * 0.2
                                elif hy0 >= iy1:  # strictly below (penalized)
                                    dist = (hy0 - iy1) * 2.0 + abs(icx - hcx) * 0.2
                                else:  # overlapping vertically
                                    dist = abs(icy - hcy) + abs(icx - hcx) * 0.5
                                    
                                if dist < min_dist:
                                    min_dist = dist
                                    nearest_heading = h["text"]

                        # Map nearest heading to category
                        entity_type = "destination"
                        heading_lower = (nearest_heading or "").lower()
                        if heading_lower:
                            if any(kw in heading_lower for kw in ["hotel", "resort", "stay", "accommodation", "villa", "lodge", "overnight"]):
                                entity_type = "hotel"
                            elif any(kw in heading_lower for kw in ["activity", "sightseeing", "tour", "visit", "experience", "excursion", "temple", "museum", "park"]):
                                entity_type = "activity"
                            elif any(kw in heading_lower for kw in ["meal", "breakfast", "lunch", "dinner", "restaurant", "food", "cuisine"]):
                                entity_type = "meal"
                            elif any(kw in heading_lower for kw in ["flight", "air", "airline", "airport"]):
                                entity_type = "flight"
                            elif any(kw in heading_lower for kw in ["day"]):
                                entity_type = "day"

                        # Upload to R2 under public folder "supplier-images"
                        img_filename = f"extracted_img_p{page_num+1}_{img_index+1}_{uuid.uuid4().hex[:8]}.{image_ext}"
                        upload_res = upload_file_to_r2(
                            file_bytes=image_bytes,
                            filename=img_filename,
                            folder="supplier-images",
                            agency_id=agency_id,
                            content_type=f"image/{image_ext}"
                        )
                        
                        real_url = upload_res.get("url") if upload_res else ""

                        images_list.append({
                            "image_id": f"img_p{page_num+1}_{img_index+1}",
                            "page": page_num + 1,
                            "url": real_url,
                            "linked_entity_type": entity_type,
                            "heading_text": nearest_heading
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



def cleanup_old_temp_pdfs(retention_days: int = 15) -> int:
    """
    Deletes temporary/raw supplier PDFs older than retention_days from the local filesystem.
    Returns the count of deleted files.
    """
    if not os.path.exists(TEMP_PDF_DIR):
        return 0

    import time
    cutoff_time = time.time() - (retention_days * 24 * 3600)
    cleaned_count = 0
    try:
        for filename in os.listdir(TEMP_PDF_DIR):
            filepath = os.path.join(TEMP_PDF_DIR, filename)
            if os.path.isfile(filepath):
                file_mtime = os.path.getmtime(filepath)
                if file_mtime < cutoff_time:
                    try:
                        os.remove(filepath)
                        cleaned_count += 1
                    except Exception as e:
                        logger.error(f"[Cleanup] Failed to delete file {filepath}: {e}")
        if cleaned_count > 0:
            logger.info(f"[Cleanup] Deleted {cleaned_count} temporary supplier PDFs older than {retention_days} days.")
    except Exception as e:
        logger.error(f"[Cleanup] PDF retention job failed: {e}")

    return cleaned_count



