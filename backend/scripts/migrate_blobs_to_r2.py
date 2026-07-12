#!/usr/bin/env python3
"""
migrate_blobs_to_r2.py
======================
One-time migration script that moves existing rows' data to R2 and backfills the new key columns,
then nullifies/clears the legacy inline columns (raw_text and output_json).
"""
import os
import sys
import logging
from pathlib import Path

# Add project backend root to path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from src.services.supabase_client import get_supabase_client
from src.services.r2_storage_service import upload_text_to_r2, upload_json_to_r2

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("migrate_blobs_to_r2")

def migrate_vault_packages_raw_text():
    sb = get_supabase_client()
    if not sb:
        logger.error("Supabase client not configured.")
        return 0

    logger.info("Migrating vault_packages.raw_text -> R2...")
    try:
        # Fetch rows where raw_text is not null and raw_text_r2_key is null
        res = sb.table("vault_packages").select("id, agency_id, pdf_filename, raw_text, raw_text_r2_key").not_.is_("raw_text", "null").execute()
        rows = res.data or []
        migrated = 0

        for row in rows:
            pkg_id = row.get("id")
            raw_text = row.get("raw_text")
            agency_id = row.get("agency_id")
            pdf_filename = row.get("pdf_filename") or "package.pdf"

            if not raw_text:
                continue

            r2_key = upload_text_to_r2(raw_text, pdf_filename, "vault-raw-text", agency_id)
            if r2_key:
                # Update row with new r2 key and nullify old raw_text column
                sb.table("vault_packages").update({
                    "raw_text_r2_key": r2_key,
                    "raw_text": None
                }).eq("id", pkg_id).execute()
                migrated += 1
                logger.info(f"Migrated vault_package id={pkg_id} to R2 key={r2_key}")

        logger.info(f"Completed vault_packages migration: {migrated} rows migrated.")
        return migrated
    except Exception as e:
        logger.exception("Failed during vault_packages migration")
        return 0


def migrate_ai_cache_output_json():
    sb = get_supabase_client()
    if not sb:
        logger.error("Supabase client not configured.")
        return 0

    logger.info("Migrating ai_cache.output_json -> R2...")
    try:
        res = sb.table("ai_cache").select("cache_key, agency_id, output_json, output_r2_key").not_.is_("output_json", "null").execute()
        rows = res.data or []
        migrated = 0

        for row in rows:
            cache_key = row.get("cache_key")
            output_json = row.get("output_json")
            agency_id = row.get("agency_id")

            if output_json is None:
                continue

            r2_key = upload_json_to_r2(output_json, f"{cache_key}.json", "ai-cache", agency_id)
            if r2_key:
                sb.table("ai_cache").update({
                    "output_r2_key": r2_key,
                    "output_json": None
                }).eq("cache_key", cache_key).execute()
                migrated += 1
                logger.info(f"Migrated ai_cache cache_key={cache_key} to R2 key={r2_key}")

        logger.info(f"Completed ai_cache migration: {migrated} rows migrated.")
        return migrated
    except Exception as e:
        logger.exception("Failed during ai_cache migration")
        return 0


def main():
    logger.info("Starting large blob R2 migration...")
    vp_count = migrate_vault_packages_raw_text()
    ai_count = migrate_ai_cache_output_json()
    logger.info(f"Migration finished. Vault packages: {vp_count}, AI cache records: {ai_count}")

if __name__ == "__main__":
    main()
