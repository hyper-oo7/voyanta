"""
PDF Processing Orchestrator service.
Manages document ingestion, text & entity extraction, semantic chunking, embedding generation, and vector indexing.
"""
import uuid
import logging
import httpx
import re
from typing import Dict, Any, List, Optional
from src.core.config import get_settings
from src.services.chunker import TravelDocumentChunker
from src.services.embedder import embedder
from src.services.vector_store import vector_store
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

def get_supabase():
    return get_supabase_client()

class PDFProcessor:
    def __init__(self):
        self.chunker = TravelDocumentChunker()
        settings = get_settings()
        self.pdf_service_url = getattr(settings, "PDF_SERVICE_URL", "http://127.0.0.1:8002")

    async def process_pdf(
        self,
        file_bytes: bytes,
        filename: str,
        agency_id: str,
        document_type: str = "pdf",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        document_id = str(uuid.uuid4())
        extracted = await self._extract_via_service_or_fallback(file_bytes, filename)
        raw_text = extracted.get("text", "")
        extracted_entities = extracted.get("entities", {})
        
        if not raw_text or len(raw_text.strip()) < 20:
            logger.warning(f"[PDFProcessor] Extracted text too short for filename={filename}")
            raise ValueError(f"Could not extract meaningful text from PDF {filename}")
        
        self._save_document(
            document_id=document_id,
            agency_id=agency_id,
            filename=filename,
            document_type=document_type,
            tags=tags or [],
            extracted_entities=extracted_entities,
            page_count=extracted.get("page_count", 1),
        )
        
        metadata = {
            "document_name": filename,
            "document_id": document_id,
            "source_type": document_type,
            "page_count": extracted.get("page_count", 1),
            **extracted_entities,
        }
        
        chunks = self.chunker.chunk_text(raw_text, metadata)
        texts = [c["content"] for c in chunks]
        embeddings = embedder.embed_texts(texts)
        
        chunks_stored = vector_store.store_chunks(
            agency_id=agency_id,
            document_id=document_id,
            chunks=chunks,
            embeddings=embeddings,
        )

        # Schedule Document Summary generation in background for Document Summary Index routing
        if raw_text and len(raw_text) > 30:
            try:
                import asyncio
                from src.services.vault_knowledge_service import _generate_and_store_doc_summary
                loop = asyncio.get_running_loop()
                loop.create_task(_generate_and_store_doc_summary(
                    document_id=document_id,
                    agency_id=agency_id,
                    document_text=raw_text,
                    table_name="documents",
                ))
            except Exception as e:
                logger.debug(f"[PDFProcessor] Background summary generation schedule skipped: {e}")

        logger.info(f"[PDFProcessor] Complete: document_id={document_id}, chunks={chunks_stored}")
        
        return {
            "document_id": document_id,
            "status": "success",
            "chunks_indexed": chunks_stored,
            "message": f"Processed {filename}: extracted {len(raw_text)} chars into {chunks_stored} chunks",
        }
    
    async def _extract_via_service_or_fallback(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        # Try primary node pdf-service microservice endpoint first
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                files = {"file": (filename, file_bytes, "application/pdf")}
                resp = await client.post(f"{self.pdf_service_url}/extract", files=files)
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.info(f"[PDFProcessor] Microservice endpoint unavailable ({e}). Using native Python extraction.")

        # Fallback: Native Python PyMuPDF / pdfminer extraction
        return self._extract_native_python(file_bytes, filename)

    def _extract_native_python(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        text = ""
        page_count = 1
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            pages_text = [page.get_text() for page in doc]
            text = "\n\n".join(pages_text)
        except Exception as e:
            logger.warning(f"[PDFProcessor] PyMuPDF failed ({e}), trying pdfminer...")
            try:
                from pdfminer.high_level import extract_text
                import io
                text = extract_text(io.BytesIO(file_bytes))
            except Exception as ex:
                logger.error(f"[PDFProcessor] Native Python PDF extraction failed: {ex}")
                text = ""

        # Extract entities natively via regex patterns
        entities = self._extract_entities_regex(text)
        return {
            "text": text,
            "page_count": page_count,
            "isScanned": len(text.strip()) < 100,
            "entities": entities,
        }

    def _extract_entities_regex(self, text: str) -> Dict[str, Any]:
        entities = {
            "destinations": [],
            "hotels": [],
            "activities": [],
            "dates": [],
            "prices": [],
            "transportModes": [],
            "mealPlans": [],
        }
        if not text:
            return entities

        # Destinations
        for match in re.findall(r"\b(manali|shimla|dharamshala|goa|kerala|rajasthan|jaipur|udaipur|leh|ladakh|srinagar|gulmarg|pahalgam|rishikesh)\b", text, re.IGNORECASE):
            entities["destinations"].append(match.lower())
        entities["destinations"] = list(set(entities["destinations"]))

        # Hotels
        for match in re.findall(r"(?:hotel|resort|lodge|villa|homestay)\s+([A-Z][A-Za-z\s&]+?)(?=\n|\.|,|\d|\(|\))", text):
            entities["hotels"].append(match.strip())
        entities["hotels"] = list(set(entities["hotels"]))[:15]

        # Prices
        prices = re.findall(r"(?:₹|rs\.?|inr)\s*[\d,]+", text, re.IGNORECASE)
        entities["prices"] = [p for p in prices if len(p) > 3][:15]

        # Meal Plans
        meals = re.findall(r"\b(cp|map|ap|ep|bb|hb|fb)\b", text, re.IGNORECASE)
        entities["mealPlans"] = list(set(m.upper() for m in meals))

        return entities

    def _save_document(
        self,
        document_id: str,
        agency_id: str,
        filename: str,
        document_type: str,
        tags: List[str],
        extracted_entities: Dict[str, Any],
        page_count: int,
    ):
        sb = get_supabase()
        if not sb:
            logger.warning("[PDFProcessor] Supabase client unavailable. Skipping document db record.")
            return
        try:
            sb.table("documents").insert({
                "id": document_id,
                "agency_id": agency_id,
                "filename": filename,
                "document_type": document_type,
                "tags": tags,
                "extracted_entities": extracted_entities,
                "page_count": page_count,
                "status": "processed",
            }).execute()
        except Exception as e:
            logger.error(f"[PDFProcessor] Error inserting into documents table: {e}")

pdf_processor = PDFProcessor()
