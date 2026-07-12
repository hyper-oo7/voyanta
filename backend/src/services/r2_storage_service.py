import os
import boto3
from botocore.config import Config
from typing import BinaryIO, Optional, Any
import uuid
import time
import json
import logging

logger = logging.getLogger(__name__)

# Private Bucket Configuration dynamically read in clients below
def get_private_r2_client():
    endpoint = os.environ.get("CF_R2_PRIVATE_ENDPOINT")
    access_key = os.environ.get("CF_R2_PRIVATE_ACCESS_KEY_ID")
    secret_key = os.environ.get("CF_R2_PRIVATE_SECRET_ACCESS_KEY")
    if not (endpoint and access_key and secret_key):
        logger.warning("[R2 Storage] Private R2 credentials not fully configured.")
        return None
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4")
        )
        return s3
    except Exception as e:
        logger.error(f"[R2 Storage] Failed to initialize Private R2 client: {e}")
        return None

def get_public_r2_client():
    endpoint = os.environ.get("CF_R2_PUBLIC_ENDPOINT")
    access_key = os.environ.get("CF_R2_PUBLIC_ACCESS_KEY_ID")
    secret_key = os.environ.get("CF_R2_PUBLIC_SECRET_ACCESS_KEY")
    if not (endpoint and access_key and secret_key):
        logger.warning("[R2 Storage] Public R2 credentials not fully configured.")
        return None
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
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
        "vault-raw-text",
        "ai-cache",
        "database-backups",
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
    private_bucket = os.environ.get("CF_R2_PRIVATE_BUCKET")
    public_bucket = os.environ.get("CF_R2_PUBLIC_BUCKET")
    bucket = private_bucket if is_private else public_bucket

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
                public_url_prefix = os.environ.get("CF_R2_PUBLIC_URL_PREFIX")
                prefix = (public_url_prefix or "").rstrip("/")
                if prefix:
                    url = f"{prefix}/{key}"
                else:
                    public_endpoint = os.environ.get("CF_R2_PUBLIC_ENDPOINT")
                    endpoint = (public_endpoint or "").rstrip("/")
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
        "bucket": "voyanta-private-mock" if is_private else "voyanta-public-mock",
        "is_private": is_private
    }

def get_presigned_url(key: str, expires_in: int = 86400) -> Optional[str]:
    """Generate a presigned URL for private files."""
    s3 = get_private_r2_client()
    bucket = os.environ.get("CF_R2_PRIVATE_BUCKET")
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

def get_file_from_r2(key: str) -> Optional[bytes]:
    """Retrieve raw file bytes from R2 (private or public) or fallback mock storage."""
    is_private = True
    parts = key.split("/")
    if parts:
        is_private = is_private_folder(parts[0])

    s3 = get_private_r2_client() if is_private else get_public_r2_client()
    private_bucket = os.environ.get("CF_R2_PRIVATE_BUCKET")
    public_bucket = os.environ.get("CF_R2_PUBLIC_BUCKET")
    bucket = private_bucket if is_private else public_bucket

    if s3 and bucket:
        try:
            resp = s3.get_object(Bucket=bucket, Key=key)
            return resp["Body"].read()
        except Exception as e:
            logger.error(f"[R2 Storage] Failed to get object {key} from R2 bucket {bucket}: {e}")

    # Fallback to local mock storage
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    local_path = os.path.join(root_dir, "public_r2_mock", key.replace("/", os.sep))
    if os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                return f.read()
        except Exception as e:
            logger.error(f"[R2 Storage] Failed to read mock file {local_path}: {e}")
    return None

def upload_text_to_r2(
    text: str,
    filename: str,
    folder: str = "vault-raw-text",
    agency_id: Optional[str] = None
) -> Optional[str]:
    """Upload UTF-8 text to R2 and return the stored object key (path)."""
    if text is None:
        return None
    res = upload_file_to_r2(
        file_bytes=text.encode("utf-8"),
        filename=filename,
        folder=folder,
        agency_id=agency_id,
        content_type="text/plain; charset=utf-8"
    )
    return res.get("path") if res else None

def get_text_from_r2(key: str) -> Optional[str]:
    """Retrieve UTF-8 string from R2 object key."""
    if not key:
        return None
    raw_bytes = get_file_from_r2(key)
    if raw_bytes is None:
        return None
    try:
        return raw_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"[R2 Storage] Failed to decode text from key {key}: {e}")
        return None

def upload_json_to_r2(
    data: Any,
    filename: str,
    folder: str = "ai-cache",
    agency_id: Optional[str] = None
) -> Optional[str]:
    """Serialize data to JSON and upload to R2, returning the stored object key."""
    if data is None:
        return None
    try:
        json_str = json.dumps(data, ensure_ascii=False)
        res = upload_file_to_r2(
            file_bytes=json_str.encode("utf-8"),
            filename=filename if filename.endswith(".json") else f"{filename}.json",
            folder=folder,
            agency_id=agency_id,
            content_type="application/json"
        )
        return res.get("path") if res else None
    except Exception as e:
        logger.error(f"[R2 Storage] Failed to serialize or upload JSON: {e}")
        return None

def get_json_from_r2(key: str) -> Optional[Any]:
    """Retrieve JSON object from R2 object key."""
    text = get_text_from_r2(key)
    if text is None:
        return None
    try:
        return json.loads(text)
    except Exception as e:
        logger.error(f"[R2 Storage] Failed to parse JSON from key {key}: {e}")
        return None

