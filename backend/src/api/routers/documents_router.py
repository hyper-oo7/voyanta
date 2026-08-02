"""
Document Upload, Search, and Vector Management API Router.
Exposes endpoints for processing travel PDFs, listing uploaded documents, and deleting document vectors.
"""
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel
import logging

from src.services.pdf_processor import pdf_processor
from src.services.vector_store import vector_store
from src.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    chunks_indexed: int
    message: str

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    agency_id: str = Form(...),
    client_id: Optional[str] = Form(None),
    document_type: str = Form("pdf"),
    tags: Optional[str] = Form(""),
):
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "application/octet-stream"]
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not supported. Use PDF, PNG, or JPEG.")
    
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    
    try:
        file_bytes = await file.read()
        result = await pdf_processor.process_pdf(
            file_bytes=file_bytes,
            filename=file.filename or "uploaded_document.pdf",
            agency_id=agency_id,
            document_type=document_type,
            tags=tag_list,
        )
        return DocumentUploadResponse(**result)
    except Exception as e:
        logger.error(f"[DocumentsRouter] Upload failed for filename={file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@router.get("/")
async def list_documents(agency_id: str = Query("global")):
    sb = get_supabase_client()
    if not sb:
        return {"documents": []}
    try:
        resp = sb.table("documents").select("*").eq("agency_id", agency_id).execute()
        return {"documents": resp.data or []}
    except Exception as e:
        logger.error(f"[DocumentsRouter] Error listing documents: {e}")
        return {"documents": []}

@router.delete("/{document_id}")
async def delete_document(document_id: str, agency_id: str = Query("global")):
    vector_store.delete_document_chunks(document_id)
    sb = get_supabase_client()
    if sb:
        try:
            sb.table("documents").delete().eq("id", document_id).eq("agency_id", agency_id).execute()
        except Exception as e:
            logger.error(f"[DocumentsRouter] Error deleting document record: {e}")
    return {"status": "deleted", "document_id": document_id}
