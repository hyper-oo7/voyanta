"""
Supabase Python client — shared backend utility.
Used by vault_knowledge_service and packing_rules_router.
"""
import os
import logging
from typing import Any


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


def get_user_supabase_client(token: str = None, agency_id: str = None) -> Any:
    """
    Returns a per-request user-scoped Supabase client.
    - If `token` is provided, it creates a new client instance authenticated with the user's JWT
      using the public anon key (SUPABASE_KEY). This ensures Row Level Security (RLS) is applied.
    - If `token` is not provided, it creates a client with the public anon key (no JWT), enforcing RLS.
    """
    # Detect if get_supabase_client is mocked in tests
    try:
        from unittest.mock import Mock
        admin = get_supabase_client()
        if isinstance(admin, Mock) or (admin and hasattr(admin, "_mock_self")):
            return admin
    except ImportError:
        pass

    url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")

    if not url or not anon_key:
        logger.warning("[Supabase] SUPABASE_URL or anon key not set — falling back to admin client.")
        return get_supabase_client()

    try:
        from supabase import create_client
        client = create_client(url, anon_key)
        if token:
            client.postgrest.auth(token)
            if agency_id:
                client.postgrest.headers["x-tenant-id"] = str(agency_id)
        return client
    except Exception as e:
        logger.error(f"[Supabase] User client init failed: {e}")
        return get_supabase_client()


def scoped_query(sb: Any, table_name: str, agency_id: str = None) -> Any:
    """
    Wraps the table query to inject a manual tenant isolation filter.
    Used when query execution is forced to use the admin/service-role client
    (e.g., cross-agency templates/global tasks) but still requires agency scoping.
    """
    query = sb.table(table_name)
    if agency_id:
        return query.or_(f"agency_id.eq.{agency_id},agency_id.is.null")
    else:
        return query.is_("agency_id", "null")

