"""
ir_schema.py — Standard JSON Intermediate Representation (IR) Models
======================================================================
Normalizes outputs from PyMuPDF spatial/font analysis and pdfplumber complex tabular
extraction into a unified, lossless structured representation.
"""

from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field


class SpanIR(BaseModel):
    """Normalized span containing exact text, bounding box, and font metadata."""
    text: str
    bbox: Tuple[float, float, float, float]
    font_name: str
    font_size: float
    is_bold: bool
    is_italic: bool
    color: int
    flags: int = 0


class BlockIR(BaseModel):
    """Normalized block containing reading-ordered text and structural classification."""
    block_id: str
    block_type: str  # "heading_h1", "heading_h2", "heading_h3", "paragraph", "table_region", "list_item", "image"
    text: str
    bbox: Tuple[float, float, float, float]
    spans: List[SpanIR] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TableCellIR(BaseModel):
    """Individual table cell with grid coordinates and spatial bounding box."""
    row_idx: int
    col_idx: int
    text: str
    bbox: Optional[Tuple[float, float, float, float]] = None
    rowspan: int = 1
    colspan: int = 1


class TableIR(BaseModel):
    """Normalized table structure extracted via pdfplumber or spatial analysis."""
    table_id: str
    page_number: int
    bbox: Optional[Tuple[float, float, float, float]] = None
    headers: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)
    cells: List[TableCellIR] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PageIR(BaseModel):
    """Normalized page with structural blocks, tables, and spatial dimensions."""
    page_number: int
    width: float
    height: float
    blocks: List[BlockIR] = Field(default_factory=list)
    tables: List[TableIR] = Field(default_factory=list)
    has_complex_tables: bool = False
    extracted_via: str  # e.g., "pymupdf_dict", "pdfplumber_hybrid"
    text: str = ""


class DocumentIR(BaseModel):
    """Standard JSON Intermediate Representation for travel itinerary/supplier PDFs."""
    doc_id: str
    file_path: str
    total_pages: int
    pages: List[PageIR] = Field(default_factory=list)
    full_text: str = ""
    tables: List[TableIR] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
