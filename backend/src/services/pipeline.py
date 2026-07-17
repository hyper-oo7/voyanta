"""
pipeline.py — Extraction & Normalization Pipeline Service
===========================================================
Integrates PyMuPDF for spatial layout analysis and font metadata extraction.
Implements conditional routing to pdfplumber for complex tabular structures.
Normalizes all outputs to a standard JSON Intermediate Representation (IR).
"""

import os
import re
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

from src.models.ir_schema import (
    DocumentIR,
    PageIR,
    BlockIR,
    SpanIR,
    TableIR,
    TableCellIR,
)
from src.services.sqs_messaging_service import get_sqs_service

logger = logging.getLogger(__name__)


def _classify_block_type(spans: List[SpanIR], text: str) -> str:
    """
    Classify block structural type based on font metadata (size, bold flags)
    and text features (bullets, numbers).
    """
    if not spans or not text.strip():
        return "paragraph"

    max_size = max(span.font_size for span in spans)
    is_bold_dominant = any(span.is_bold for span in spans if len(span.text) > 3) or (
        spans[0].is_bold if spans else False
    )

    stripped = text.strip()

    # List items
    if re.match(r'^[\-\*\•\–\—]\s+', stripped) or re.match(r'^\d+[\.\)]\s+', stripped):
        return "list_item"

    # Headings
    if max_size >= 16.0 or (max_size >= 14.5 and is_bold_dominant):
        return "heading_h1"
    elif max_size >= 13.5 and is_bold_dominant:
        return "heading_h2"
    elif max_size >= 12.0 and is_bold_dominant and len(stripped) < 80:
        return "heading_h3"

    return "paragraph"


def _detect_complex_tabular_structure(
    page: Any,
    page_dict: Dict[str, Any],
    page_text: str
) -> bool:
    """
    Conditional logic to identify whether a page contains complex tabular structures
    warranting routing to pdfplumber.
    """
    try:
        # 1. PyMuPDF native table finder (v1.23+)
        if hasattr(page, "find_tables"):
            tables = page.find_tables()
            if tables and len(tables.tables) > 0:
                for tab in tables.tables:
                    if tab.col_count >= 2 and tab.row_count >= 2:
                        return True

        # 2. Vector drawing grid / line intersection checks
        drawings = page.get_drawings()
        h_lines = 0
        v_lines = 0
        for draw in drawings:
            for item in draw.get("items", []):
                if item[0] == "l":  # Line
                    p1, p2 = item[1], item[2]
                    # Check horizontal vs vertical orientation
                    if abs(p1.y - p2.y) < 2.0 and abs(p1.x - p2.x) > 20.0:
                        h_lines += 1
                    elif abs(p1.x - p2.x) < 2.0 and abs(p1.y - p2.y) > 20.0:
                        v_lines += 1

        if h_lines >= 3 and v_lines >= 2:
            return True

        # 3. Dense multi-column numeric alignment (e.g., pricing tables / room categories)
        lines = [l.strip() for l in page_text.split("\n") if l.strip()]
        price_line_count = 0
        for line in lines:
            # Check if line has multiple price tokens separated by wide spacing
            matches = re.findall(r'(?:₹|rs\.?|inr|\$|€|£)\s*\d+[\d,]*|\b\d{3,6}\b', line.lower())
            if len(matches) >= 2:
                price_line_count += 1

        if price_line_count >= 2:
            return True

    except Exception as e:
        logger.debug(f"[Pipeline] Tabular detection check warning on page: {e}")

    return False


def _extract_tables_via_pdfplumber(file_path: str, page_num: int) -> List[TableIR]:
    """
    Route page to pdfplumber for high-precision cell extraction and table recovery.
    Preserves multi-column layout without interleaving cell strings.
    """
    try:
        import pdfplumber
    except ImportError:
        logger.warning("[Pipeline] pdfplumber not installed; skipping specialized table extraction.")
        return []

    tables_ir: List[TableIR] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            if page_num >= len(pdf.pages):
                return []
            p_page = pdf.pages[page_num]

            # Extract tables using layout-aware table settings
            extracted_tables = p_page.extract_tables(table_settings={
                "vertical_strategy": "lines_strict",
                "horizontal_strategy": "lines_strict",
            })

            # If lines_strict finds nothing, fall back to text-alignment inference
            if not extracted_tables:
                extracted_tables = p_page.extract_tables(table_settings={
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "intersection_tolerance": 5,
                })

            for tab_idx, raw_table in enumerate(extracted_tables):
                if not raw_table or len(raw_table) == 0:
                    continue

                # Clean rows and cells
                clean_rows: List[List[str]] = []
                cells_ir: List[TableCellIR] = []
                headers: List[str] = []

                for r_idx, row in enumerate(raw_table):
                    clean_row = [str(c).strip() if c is not None else "" for c in row]
                    clean_rows.append(clean_row)

                    if r_idx == 0:
                        headers = clean_row

                    for c_idx, cell_text in enumerate(clean_row):
                        cells_ir.append(TableCellIR(
                            row_idx=r_idx,
                            col_idx=c_idx,
                            text=cell_text,
                        ))

                tables_ir.append(TableIR(
                    table_id=f"table_p{page_num + 1}_{tab_idx + 1}_{uuid.uuid4().hex[:6]}",
                    page_number=page_num + 1,
                    headers=headers,
                    rows=clean_rows,
                    cells=cells_ir,
                    metadata={"extractor": "pdfplumber", "row_count": len(clean_rows), "col_count": len(headers)}
                ))
    except Exception as e:
        logger.error(f"[Pipeline] pdfplumber extraction failed for page {page_num + 1}: {e}")

    return tables_ir


def extract_and_normalize(file_path: str, doc_id: Optional[str] = None) -> DocumentIR:
    """
    Synchronous pipeline executing PyMuPDF spatial & font metadata analysis
    with conditional routing to pdfplumber for complex tables.
    Normalizes to DocumentIR.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        raise RuntimeError("PyMuPDF (fitz) is required for extraction pipeline.") from e

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Input file not found at: {file_path}")

    doc_id = doc_id or f"doc_{uuid.uuid4().hex[:12]}"
    logger.info(f"[Pipeline] Starting extraction & normalization for {file_path} (doc_id: {doc_id})")

    doc = fitz.open(file_path)
    pages_ir: List[PageIR] = []
    all_tables_ir: List[TableIR] = []
    full_text_parts: List[str] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        width = page.rect.width
        height = page.rect.height

        # PyMuPDF dict-mode extraction
        page_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_PRESERVE_LIGATURES)
        raw_blocks = page_dict.get("blocks", [])

        # Reconstruct spatial reading order: top-to-bottom, left-to-right
        sorted_blocks = sorted(raw_blocks, key=lambda b: (round(b["bbox"][1] / 5) * 5, b["bbox"][0]))

        blocks_ir: List[BlockIR] = []
        page_text_lines: List[str] = []

        for b_idx, block in enumerate(sorted_blocks):
            if block.get("type") != 0:  # Skip non-text blocks (images=1)
                continue

            block_spans_ir: List[SpanIR] = []
            block_lines: List[str] = []

            for line in block.get("lines", []):
                line_spans: List[str] = []
                for span in line.get("spans", []):
                    span_text = span.get("text", "")
                    if not span_text.strip():
                        continue

                    flags = span.get("flags", 0)
                    font_name = span.get("font", "unknown")
                    # Bit 1 = Superscript, Bit 2 = Italic, Bit 3 = Serif, Bit 4 = Monospace, Bit 5 = Bold
                    is_italic = bool(flags & 2) or "italic" in font_name.lower() or "oblique" in font_name.lower()
                    is_bold = bool(flags & 16) or "bold" in font_name.lower() or "heavy" in font_name.lower() or "black" in font_name.lower()

                    span_ir = SpanIR(
                        text=span_text,
                        bbox=(span["bbox"][0], span["bbox"][1], span["bbox"][2], span["bbox"][3]),
                        font_name=font_name,
                        font_size=round(span.get("size", 12.0), 2),
                        is_bold=is_bold,
                        is_italic=is_italic,
                        color=span.get("color", 0),
                        flags=flags
                    )
                    block_spans_ir.append(span_ir)
                    line_spans.append(span_text)

                if line_spans:
                    block_lines.append(" ".join(line_spans).strip())

            block_text = "\n".join(block_lines).strip()
            if not block_text:
                continue

            block_type = _classify_block_type(block_spans_ir, block_text)
            block_ir = BlockIR(
                block_id=f"p{page_num + 1}_b{b_idx + 1}",
                block_type=block_type,
                text=block_text,
                bbox=(block["bbox"][0], block["bbox"][1], block["bbox"][2], block["bbox"][3]),
                spans=block_spans_ir,
                metadata={"line_count": len(block_lines)}
            )
            blocks_ir.append(block_ir)
            page_text_lines.append(block_text)

        page_full_text = "\n\n".join(page_text_lines)
        if page_full_text.strip():
            full_text_parts.append(f"[Page {page_num + 1}]\n{page_full_text}")

        # Check conditional logic for complex tabular structures
        has_complex_tables = _detect_complex_tabular_structure(page, page_dict, page_full_text)
        page_tables: List[TableIR] = []
        extracted_via = "pymupdf_dict"

        if has_complex_tables:
            logger.info(f"[Pipeline] Complex tabular structure detected on Page {page_num + 1} -> routing to pdfplumber")
            page_tables = _extract_tables_via_pdfplumber(file_path, page_num)
            if page_tables:
                extracted_via = "pdfplumber_hybrid"
                all_tables_ir.extend(page_tables)

        page_ir = PageIR(
            page_number=page_num + 1,
            width=round(width, 2),
            height=round(height, 2),
            blocks=blocks_ir,
            tables=page_tables,
            has_complex_tables=has_complex_tables,
            extracted_via=extracted_via,
            text=page_full_text
        )
        pages_ir.append(page_ir)

    doc.close()

    doc_ir = DocumentIR(
        doc_id=doc_id,
        file_path=file_path,
        total_pages=len(pages_ir),
        pages=pages_ir,
        full_text="\n\n".join(full_text_parts),
        tables=all_tables_ir,
        metadata={
            "filename": os.path.basename(file_path),
            "table_count": len(all_tables_ir),
            "processed_at": datetime.now(timezone.utc).isoformat()
        },
        created_at=datetime.now(timezone.utc).isoformat()
    )

    logger.info(
        f"[Pipeline] Normalization complete: {doc_ir.total_pages} pages, "
        f"{len(doc_ir.tables)} complex tables, {len(doc_ir.full_text)} chars extracted."
    )

    # Publish background SQS event
    try:
        sqs = get_sqs_service()
        sqs.send_event("EXTRACTION_PIPELINE_COMPLETED", {
            "doc_id": doc_ir.doc_id,
            "file_path": doc_ir.file_path,
            "total_pages": doc_ir.total_pages,
            "table_count": len(doc_ir.tables)
        })
    except Exception as sqs_err:
        logger.debug(f"[Pipeline] SQS notification skipped: {sqs_err}")

    return doc_ir


async def extract_and_normalize_async(file_path: str, doc_id: Optional[str] = None) -> DocumentIR:
    """Async wrapper running extract_and_normalize in an executor pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: extract_and_normalize(file_path, doc_id))
