"""
tenancy_selfheal.py
===================
Re-stamps rows written under legacy tenant keys onto the shared default tenant.

This is migration 20260823000001_canonical_agency_id.sql codified: the SQL file
requires someone to run it in the Supabase editor, and until that happens every
chunk ingested under the old 'demo-agency' / 'global' fallbacks — plus packages
saved with a NULL agency — stays invisible to every read. Running the same
idempotent updates at startup removes the manual step: any restart heals the
data, locally and in production.

Requires the service-role client; with only the public key the updates are
rejected by the grants and this becomes a no-op with a warning.
"""
import logging
from typing import Any, Optional

from src.core.tenancy import DEFAULT_AGENCY_ID

logger = logging.getLogger(__name__)

# Text sentinels that legacy code paths used as an agency id. Only possible on
# document_chunks (text column); the uuid-typed tables could at worst hold NULL.
_LEGACY_TEXT_KEYS = ["demo-agency", "global", "", "null", "undefined", "none"]


def heal_legacy_tenants(sb: Optional[Any] = None) -> dict:
    """
    Idempotent: each pass only touches rows still carrying a legacy key, so a
    healed database results in zero updates. Never raises — a failure here must
    not stop the app from booting.
    """
    summary = {"document_chunks": 0, "vault_packages": 0, "destination_knowledge": 0, "agency_packing_rules": 0}

    if sb is None:
        from src.services.supabase_client import get_supabase_client
        sb = get_supabase_client()
    if not sb:
        logger.warning("[TenancyHeal] No Supabase client — skipping legacy tenant heal.")
        return summary

    stamp = {"agency_id": DEFAULT_AGENCY_ID}

    try:
        res = (
            sb.table("document_chunks")
            .update(stamp)
            .in_("agency_id", _LEGACY_TEXT_KEYS)
            .execute()
        )
        summary["document_chunks"] = len(res.data or []) if res else 0
    except Exception as e:
        logger.warning(f"[TenancyHeal] document_chunks heal skipped: {e}")

    for table in ("vault_packages", "agency_packing_rules"):
        try:
            res = sb.table(table).update(stamp).is_("agency_id", "null").execute()
            summary[table] = len(res.data or []) if res else 0
        except Exception as e:
            logger.warning(f"[TenancyHeal] {table} heal skipped: {e}")

    # destination_knowledge has a unique key on (agency, user, destination,
    # section), so a bulk re-stamp aborts entirely when any NULL row duplicates
    # a row that already exists under the canonical tenant. Heal row by row and
    # leave conflicting rows behind: each is a duplicate of knowledge the
    # canonical row already carries, and the accumulate path keeps updating the
    # canonical one, so they are inert.
    try:
        res = sb.table("destination_knowledge").select("id").is_("agency_id", "null").execute()
        conflicted = 0
        for row in (res.data or []) if res else []:
            try:
                sb.table("destination_knowledge").update(stamp).eq("id", row["id"]).execute()
                summary["destination_knowledge"] += 1
            except Exception:
                conflicted += 1
        if conflicted:
            logger.info(
                f"[TenancyHeal] destination_knowledge: left {conflicted} duplicate row(s) untouched "
                "(canonical rows already hold this knowledge)."
            )
    except Exception as e:
        logger.warning(f"[TenancyHeal] destination_knowledge heal skipped: {e}")

    healed = sum(summary.values())
    if healed:
        logger.info(f"[TenancyHeal] Re-stamped {healed} legacy-tenant row(s): {summary}")
    else:
        logger.info("[TenancyHeal] No legacy-tenant rows found — database already canonical.")
    return summary
