import os
import boto3
from botocore.config import Config
from typing import BinaryIO, Optional
import uuid
import time
import logging

logger = logging.getLogger(__name__)

# Private Bucket Configuration
CF_R2_PRIVATE_BUCKET = os.environ.get("CF_R2_PRIVATE_BUCKET")
CF_R2_PRIVATE_ACCESS_KEY_ID = os.environ.get("CF_R2_PRIVATE_ACCESS_KEY_ID")
CF_R2_PRIVATE_SECRET_ACCESS_KEY = os.environ.get("CF_R2_PRIVATE_SECRET_ACCESS_KEY")
CF_R2_PRIVATE_ENDPOINT = os.environ.get("CF_R2_PRIVATE_ENDPOINT")

# Public Bucket Configuration
CF_R2_PUBLIC_BUCKET = os.environ.get("CF_R2_PUBLIC_BUCKET")
CF_R2_PUBLIC_ACCESS_KEY_ID = os.environ.get("CF_R2_PUBLIC_ACCESS_KEY_ID")
CF_R2_PUBLIC_SECRET_ACCESS_KEY = os.environ.get("CF_R2_PUBLIC_SECRET_ACCESS_KEY")
CF_R2_PUBLIC_ENDPOINT = os.environ.get("CF_R2_PUBLIC_ENDPOINT")
CF_R2_PUBLIC_URL_PREFIX = os.environ.get("CF_R2_PUBLIC_URL_PREFIX")

def get_private_r2_client():
    if not (CF_R2_PRIVATE_ENDPOINT and CF_R2_PRIVATE_ACCESS_KEY_ID and CF_R2_PRIVATE_SECRET_ACCESS_KEY):
        logger.warning("[R2 Storage] Private R2 credentials not fully configured.")
        return None
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=CF_R2_PRIVATE_ENDPOINT,
            aws_access_key_id=CF_R2_PRIVATE_ACCESS_KEY_ID,
            aws_secret_access_key=CF_R2_PRIVATE_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4")
        )
        return s3
    except Exception as e:
        logger.error(f"[R2 Storage] Failed to initialize Private R2 client: {e}")
        return None

def get_public_r2_client():
    if not (CF_R2_PUBLIC_ENDPOINT and CF_R2_PUBLIC_ACCESS_KEY_ID and CF_R2_PUBLIC_SECRET_ACCESS_KEY):
        logger.warning("[R2 Storage] Public R2 credentials not fully configured.")
        return None
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=CF_R2_PUBLIC_ENDPOINT,
            aws_access_key_id=CF_R2_PUBLIC_ACCESS_KEY_ID,
            aws_secret_access_key=CF_R2_PUBLIC_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4")
        )
        return s3
    except Exception as e:
        logger.error(f"[R2 Storage] Failed to initialize Public R2 client: {e}")
        return None

def is_private_folder(folder: str) -> bool:
    f = folder.lower()
    return f in {
        "client-files",
        "proposal-pdfs",
        "generated-documents",
        "proposal-assets",
        "invoices",
        "receipts",
        "vault-documents",
        "supplier-pdfs",
        "signatures",
        "digital-signatures",
        "passports",
        "visas",
        "passport-uploads",
        "visa-uploads"
    }

def upload_file_to_r2(
    file_bytes: bytes,
    filename: str,
    folder: str,
    agency_id: Optional[str] = None,
    content_type: str = "application/octet-stream"
) -> Optional[dict]:
    """
    Upload file bytes to Cloudflare R2 (Private or Public depending on folder).
    Returns a dict with 'url', 'path', and 'bucket'.
    If R2 credentials are not set, it saves to a local mock public folder.
    """
    agency_id_str = agency_id or "default"
    ext = (filename.split(".")[-1] if "." in filename else "bin").lower()
    # Clean ext
    ext = "".join(c for c in ext if c.isalnum())
    unique_id = uuid.uuid4().hex
    timestamp = int(time.time() * 1000)
    key = f"{folder}/{agency_id_str}/{timestamp}-{unique_id}.{ext}"

    is_private = is_private_folder(folder)
    
    # Try S3 Upload
    s3 = get_private_r2_client() if is_private else get_public_r2_client()
    bucket = CF_R2_PRIVATE_BUCKET if is_private else CF_R2_PUBLIC_BUCKET

    if s3 and bucket:
        try:
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type
            )
            # URL resolution
            if is_private:
                # Private file uses a presigned URL valid for 24 hours
                url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": key},
                    ExpiresIn=86400  # 24 hours
                )
            else:
                # Public file uses public CDN URL prefix
                prefix = (CF_R2_PUBLIC_URL_PREFIX or "").rstrip("/")
                if prefix:
                    url = f"{prefix}/{key}"
                else:
                    endpoint = CF_R2_PUBLIC_ENDPOINT.rstrip("/")
                    url = f"{endpoint}/{bucket}/{key}"
            
            return {
                "url": url,
                "path": key,
                "bucket": bucket,
                "is_private": is_private
            }
        except Exception as e:
            logger.error(f"[R2 Storage] Failed to upload {key} to R2 bucket {bucket}: {e}")

    # Local Mock Fallback (for development / offline / missing credentials)
    logger.info(f"[R2 Storage] Falling back to local mock storage for {key}")
    mock_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public_r2_mock", folder, agency_id_str)
    os.makedirs(mock_dir, exist_ok=True)
    local_filename = f"{timestamp}-{unique_id}.{ext}"
    local_path = os.path.join(mock_dir, local_filename)
    
    with open(local_path, "wb") as f:
        f.write(file_bytes)
        
    # Return mock URL
    mock_url = f"http://127.0.0.1:8000/api/storage/mock-files/{folder}/{agency_id_str}/{local_filename}"
    return {
        "url": mock_url,
        "path": key,
        "bucket": bucket or ("voyanta-private-mock" if is_private else "voyanta-public-mock"),
        "is_private": is_private
    }

def get_presigned_url(key: str, expires_in: int = 86400) -> Optional[str]:
    """Generate a presigned URL for private files."""
    s3 = get_private_r2_client()
    bucket = CF_R2_PRIVATE_BUCKET
    if s3 and bucket:
        try:
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"[R2 Storage] Failed to generate presigned URL for key {key}: {e}")
            
    # Mock fallback URL
    # Extract folder and filename from key (key pattern: folder/agency_id/filename)
    parts = key.split("/")
    if len(parts) >= 3:
        folder, agency_id, filename = parts[0], parts[1], parts[2]
        return f"http://127.0.0.1:8000/api/storage/mock-files/{folder}/{agency_id}/{filename}"
        
    return None
