#!/usr/bin/env python3
"""
backup_supabase_to_r2.py
========================
Uploads a generated SQL dump file to Cloudflare R2 private bucket under folder 'database-backups'.
Usage:
    python backup_supabase_to_r2.py <path_to_dump_file>
"""
import sys
import os
import logging
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from src.services.r2_storage_service import upload_file_to_r2

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("backup_supabase_to_r2")

def main():
    if len(sys.argv) < 2:
        logger.error("Usage: python backup_supabase_to_r2.py <path_to_dump_file>")
        sys.exit(1)

    dump_file_path = sys.argv[1]
    if not os.path.exists(dump_file_path):
        logger.error(f"Dump file not found: {dump_file_path}")
        sys.exit(1)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"supabase_backup_{timestamp}.sql.gz"

    logger.info(f"Uploading backup file {dump_file_path} to R2 as {filename}...")
    try:
        with open(dump_file_path, "rb") as f:
            file_bytes = f.read()

        res = upload_file_to_r2(
            file_bytes=file_bytes,
            filename=filename,
            folder="database-backups",
            agency_id="system",
            content_type="application/gzip"
        )
        if res and res.get("path"):
            logger.info(f"Successfully uploaded backup to R2: {res['path']}")
            sys.exit(0)
        else:
            logger.error("Upload returned no path. Backup failed.")
            sys.exit(1)
    except Exception as e:
        logger.exception("Exception occurred while uploading backup to R2")
        sys.exit(1)

if __name__ == "__main__":
    main()
