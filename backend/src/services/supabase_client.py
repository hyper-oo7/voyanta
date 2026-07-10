"""
Supabase Python client — shared backend utility.
Used by vault_knowledge_service and packing_rules_router.
"""
import os
import logging

logger = logging.getLogger(__name__)

_sb_client = None

def get_supabase_client():
    """
    Returns an initialized Supabase Python client, or None if not configured.
    Lazily initialised on first call. Thread-safe for read-only use.
    """
    global _sb_client
    if _sb_client is not None:
        return _sb_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        logger.warning("[Supabase] SUPABASE_URL or SUPABASE_KEY not set — Supabase features disabled.")
        return None

    try:
        from supabase import create_client, Client
        _sb_client = create_client(url, key)
        logger.info("[Supabase] Client initialised successfully.")
        return _sb_client
    except ImportError:
        logger.warning("[Supabase] supabase-py not installed — pip install supabase. Running in offline mode.")
        return None
    except Exception as e:
        logger.error(f"[Supabase] Client init failed: {e}")
        return None
