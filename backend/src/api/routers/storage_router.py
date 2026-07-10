import os
import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from src.core.security import verify_token, verify_token_optional
from src.services.r2_storage_service import upload_file_to_r2, get_presigned_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/storage", tags=["Storage"])

def _extract_agency_id(user: Any) -> Optional[str]:
    """Helper to extract agency_id from authenticated user JWT context."""
    if not user or not isinstance(user, dict):
        return None
    return (
        (user.get("user_metadata") or {}).get("agency_id")
        or (user.get("app_metadata") or {}).get("agency_id")
        or user.get("agency_id")
    )

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form("general"),
    user: Any = Depends(verify_token_optional)
):
    """
    Upload a file/image to Cloudflare R2 (Private or Public depending on the folder name).
    Fails back gracefully to local mockup storage if credentials aren't set.
    """
    try:
        agency_id = _extract_agency_id(user)
        file_bytes = await file.read()
        content_type = file.content_type or "application/octet-stream"
        
        result = upload_file_to_r2(
            file_bytes=file_bytes,
            filename=file.filename or "file",
            folder=folder,
            agency_id=agency_id,
            content_type=content_type
        )
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to upload file")
            
        return JSONResponse(content={
            "status": "success",
            "url": result["url"],
            "path": result["path"],
            "bucket": result["bucket"],
            "is_private": result["is_private"]
        })
    except Exception as e:
        logger.exception("File upload failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sign")
async def sign_url(
    path: str,
    expires_in: int = 86400,
    user: Any = Depends(verify_token_optional)
):
    """
    Generate a presigned S3/R2 download URL for a private file key/path.
    """
    try:
        url = get_presigned_url(path, expires_in=expires_in)
        if not url:
            raise HTTPException(status_code=404, detail="File or credentials not found")
        return JSONResponse(content={"status": "success", "url": url})
    except Exception as e:
        logger.exception("Failed to sign URL")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mock-files/{folder}/{agency_id}/{filename}")
async def serve_mock_file(folder: str, agency_id: str, filename: str):
    """
    Serves files from the local mock directory (only used in dev when R2 is not configured).
    """
    mock_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "public_r2_mock",
        folder,
        agency_id,
        filename
    )
    if not os.path.exists(mock_path):
        raise HTTPException(status_code=404, detail="Mock file not found")
        
    return FileResponse(mock_path)
