import os
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, JSONResponse
from typing import Any

from src.models.api_models import PDFGenerateRequest
from src.core.security import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pdf")
PDF_SERVICE_URL = os.environ.get("PDF_SERVICE_URL", "http://127.0.0.1:8002")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "voyanta-internal-secret")

@router.get("/health")
async def pdf_health():
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(f"{PDF_SERVICE_URL}/health")
            return JSONResponse(status_code=res.status_code, content=res.json())
        except Exception as e:
            logger.exception("PDF service health check failed")
            return JSONResponse(status_code=503, content={"ok": False, "error": str(e)})

@router.post("/generate")
async def pdf_generate(request: PDFGenerateRequest, user: Any = Depends(verify_token)):
    payload = request.model_dump(exclude_none=True)
    if not payload.get("proposal_id") and not payload.get("html"):
        raise HTTPException(status_code=400, detail="Missing proposal_id or html")

    headers = {"x-internal-api-key": INTERNAL_API_KEY}
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            res = await client.post(f"{PDF_SERVICE_URL}/generate", json=payload, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.text)
            
            filename = payload.get("name") or payload.get("proposal_id") or "proposal"
            filename = "".join(c if c.isalnum() or c in (".", "_", "-") else "-" for c in filename)
            
            return Response(
                content=res.content,
                media_type="application/pdf",
                headers={'Content-Disposition': f'attachment; filename="{filename}.pdf"'}
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PDF generate proxy failed")
            raise HTTPException(status_code=500, detail=str(e))
