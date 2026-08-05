import os
import io
import hashlib
import tempfile
from typing import List, Dict, Optional
from dataclasses import dataclass

try:
    import fitz  # PyMuPDF
except ImportError:
    raise ImportError("PyMuPDF (fitz) is required. Install: pip install PyMuPDF")

import logging
logger = logging.getLogger(__name__)


@dataclass
class ExtractedPage:
    number: int
    text: str
    tables: List[List[List[str]]]


class PdfEngine:
    """
    Memory-safe PDF extractor.
    - Streams file to disk, never loads full PDF into RAM as base64
    - Processes page-by-page with explicit memory cleanup
    - Hard page limit to prevent DoS via inflated page counts
    """

    MAX_PAGES = 200
    MAX_TEXT_BYTES_PER_PAGE = 2_000_000  # ~2 MB text / page safety valve
    MAX_TOTAL_TEXT_MB = 50  # Reject if extracted text exceeds 50 MB

    def __init__(self, file_bytes: bytes):
        self.file_bytes = file_bytes
        self._temp_path: Optional[str] = None

    def _write_to_disk(self) -> str:
        """Write bytes to a temporary file so fitz can mmap it."""
        fd, path = tempfile.mkstemp(suffix=".pdf")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(self.file_bytes)
            self._temp_path = path
            return path
        except Exception:
            os.close(fd)
            raise

    def _cleanup(self):
        if self._temp_path and os.path.exists(self._temp_path):
            try:
                os.unlink(self._temp_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp PDF: {e}")

    def extract(self) -> Dict[str, any]:
        path = self._write_to_disk()
        doc = None
        try:
            doc = fitz.open(path)
            if doc.page_count > self.MAX_PAGES:
                raise ValueError(
                    f"PDF has {doc.page_count} pages (max allowed: {self.MAX_PAGES}). "
                    "Split the file or remove unnecessary pages."
                )

            pages: List[ExtractedPage] = []
            total_text_len = 0

            for i in range(doc.page_count):
                page = doc.load_page(i)
                text = page.get_text("text") or ""

                # Safety valve: absurdly large text on one page = likely scanned image noise
                if len(text.encode("utf-8")) > self.MAX_TEXT_BYTES_PER_PAGE:
                    logger.warning(f"Page {i+1} text exceeds safety limit, truncating.")
                    text = text[: self.MAX_TEXT_BYTES_PER_PAGE // 2]

                total_text_len += len(text.encode("utf-8"))
                if total_text_len > self.MAX_TOTAL_TEXT_MB * 1_000_000:
                    raise ValueError(
                        f"Extracted text exceeds {self.MAX_TOTAL_TEXT_MB} MB. "
                        "The PDF may be image-heavy or corrupted."
                    )

                # Try to get tables (optional, best-effort)
                tables: List = []
                try:
                    tabs = page.find_tables()
                    if tabs and tabs.tables:
                        tables = [t.extract() for t in tabs.tables]
                except Exception:
                    pass  # Table extraction is non-critical

                pages.append(ExtractedPage(number=i + 1, text=text, tables=tables))
                page.clean_contents()  # Help fitz free page resources
                del page

            full_text = "\n\n".join(p.text for p in pages)

            return {
                "page_count": len(pages),
                "full_text": full_text,
                "pages": [
                    {"number": p.number, "text": p.text, "tables": p.tables}
                    for p in pages
                ],
                "file_hash": hashlib.sha256(self.file_bytes).hexdigest()[:16],
                "file_size_mb": round(len(self.file_bytes) / 1_048_576, 2),
            }

        finally:
            if doc:
                doc.close()
            self._cleanup()


def extract_pdf_safe(file_bytes: bytes) -> Dict[str, any]:
    """Convenience entrypoint."""
    engine = PdfEngine(file_bytes)
    return engine.extract()
