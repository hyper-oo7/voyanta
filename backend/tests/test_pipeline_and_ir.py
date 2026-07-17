"""
test_pipeline_and_ir.py — Unit Tests for Extraction Pipeline & IR Normalization
"""

import os
import pytest
from src.models.ir_schema import DocumentIR, PageIR, BlockIR, SpanIR, TableIR, TableCellIR
from src.services.pipeline import _classify_block_type, _detect_complex_tabular_structure


def test_ir_schema_models():
    """Verify standard Intermediate Representation schema validation and defaults."""
    span = SpanIR(
        text="Hotel Overview",
        bbox=(10.0, 20.0, 100.0, 35.0),
        font_name="Arial-BoldMT",
        font_size=16.5,
        is_bold=True,
        is_italic=False,
        color=0
    )
    assert span.is_bold is True
    assert span.font_size == 16.5

    block = BlockIR(
        block_id="p1_b1",
        block_type="heading_h1",
        text="Hotel Overview",
        bbox=(10.0, 20.0, 100.0, 35.0),
        spans=[span]
    )
    assert block.block_type == "heading_h1"

    table = TableIR(
        table_id="table_1",
        page_number=1,
        headers=["Day", "Hotel", "Price"],
        rows=[["Day 1", "Taj Mahal Palace", "₹45,000"]],
        cells=[TableCellIR(row_idx=0, col_idx=0, text="Day 1")]
    )
    assert len(table.headers) == 3
    assert table.rows[0][1] == "Taj Mahal Palace"

    doc = DocumentIR(
        doc_id="doc_123",
        file_path="/tmp/test.pdf",
        total_pages=1,
        pages=[PageIR(page_number=1, width=612.0, height=792.0, blocks=[block], tables=[table], extracted_via="pymupdf_dict")],
        full_text="Hotel Overview\n\nDay 1 Taj Mahal Palace ₹45,000",
        tables=[table],
        created_at="2026-07-17T00:00:00Z"
    )
    assert doc.total_pages == 1
    assert len(doc.tables) == 1


def test_classify_block_type():
    """Verify font metadata heuristics for structural block classification."""
    # Heading H1 test
    spans_h1 = [SpanIR(text="Kashmir Itinerary", bbox=(0,0,0,0), font_name="Bold", font_size=18.0, is_bold=True, is_italic=False, color=0)]
    assert _classify_block_type(spans_h1, "Kashmir Itinerary") == "heading_h1"

    # List item test
    spans_list = [SpanIR(text="• Visit Dal Lake", bbox=(0,0,0,0), font_name="Regular", font_size=12.0, is_bold=False, is_italic=False, color=0)]
    assert _classify_block_type(spans_list, "• Visit Dal Lake") == "list_item"

    # Paragraph test
    spans_para = [SpanIR(text="Arrival at Srinagar airport and transfer to houseboat.", bbox=(0,0,0,0), font_name="Regular", font_size=11.5, is_bold=False, is_italic=False, color=0)]
    assert _classify_block_type(spans_para, "Arrival at Srinagar airport and transfer to houseboat.") == "paragraph"
