"""
tenancy.py
==========
Single source of truth for the effective agency (tenant) id of a request.

Why this exists
---------------
The agency id used to be re-derived independently at every call site, each with
its own fallback, and the fallbacks disagreed:

    /import/process   ->  Form default "demo-agency"   (chunks written here)
    /import/confirm   ->  None                         (packages written here)
    /api/rag/query    ->  "global"                     (chunks read here)
    frontend          ->  "00000000-0000-0000-0000-000000000001"

So a document ingested by an anonymous session landed under "demo-agency" while
every later lookup asked for "global" or the zero-uuid, and nothing ever matched.
The data was there; the tenant key was not.

Only the zero-uuid is actually writable everywhere: vault_packages,
destination_knowledge and agency_packing_rules all declare agency_id as `uuid`,
so "global" and "demo-agency" are not merely inconsistent, they are invalid
input for three of the four tables. That makes the uuid the canonical default,
and the bare strings legacy sentinels meaning "nothing was supplied".

Security note
-------------
For writes the agency id must come from verified token claims, never from a
client-supplied field: the backend persists with the service-role client, so a
caller who could name their own agency_id could write into someone else's
tenant. resolve_agency_id() therefore always prefers the token, and
resolve_write_agency_id() refuses client input outright.
"""
from typing import Any, Optional

# Every agency_id column except document_chunks.agency_id is uuid-typed, so the
# shared default has to be a valid uuid. Mirrors DEMO_AGENCY_ID in
# frontend/src/lib/supabaseClient.js — keep the two in sync.
DEFAULT_AGENCY_ID = "00000000-0000-0000-0000-000000000001"

# Values that historically meant "caller supplied nothing". They are not valid
# uuids, so they can never be a real tenant and are always treated as unset.
_LEGACY_SENTINELS = frozenset(
    {"", "global", "demo-agency", "demo-agency-id", "null", "undefined", "none"}
)


def agency_id_from_user(user: Any) -> Optional[str]:
    """Pull the agency id out of verified token claims, or None."""
    if not isinstance(user, dict):
        return None
    claim = (
        (user.get("user_metadata") or {}).get("agency_id")
        or (user.get("app_metadata") or {}).get("agency_id")
        or user.get("agency_id")
    )
    return str(claim) if claim else None


def is_unset(value: Any) -> bool:
    """True for None and for the legacy 'nothing was supplied' sentinels."""
    return value is None or str(value).strip().lower() in _LEGACY_SENTINELS


def resolve_agency_id(user: Any = None, explicit: Optional[str] = None) -> str:
    """
    Effective tenant for a read.

    Verified claims win, then an explicitly requested agency, then the shared
    default. Legacy sentinels are treated as absent so an old client that still
    sends "global" resolves to the same tenant the ingest path writes to.
    """
    from_token = agency_id_from_user(user)
    if from_token and not is_unset(from_token):
        return from_token
    if not is_unset(explicit):
        return str(explicit).strip()
    return DEFAULT_AGENCY_ID


def resolve_write_agency_id(user: Any = None) -> str:
    """
    Effective tenant for a write. Token claims or the shared default — never a
    client-supplied value, so a request cannot address another agency's rows.
    """
    from_token = agency_id_from_user(user)
    if from_token and not is_unset(from_token):
        return from_token
    return DEFAULT_AGENCY_ID
