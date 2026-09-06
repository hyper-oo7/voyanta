-- Migration: 20260823000001_canonical_agency_id.sql
-- Description:
--   Backfill rows that were written under a tenant key nothing ever queries.
--
-- Background
--   The agency id was derived independently at each call site with disagreeing
--   fallbacks: ingest wrote chunks under the literal 'demo-agency', /import/confirm
--   left agency_id NULL, and every read asked for 'global' or the zero-uuid. The
--   documents were stored correctly but were unreachable, so RAG returned no
--   matches and the proposal UI reported "no vault inventory / no matching
--   documents".
--
--   src/core/tenancy.py now resolves one canonical value for reads and writes.
--   This migration re-stamps the rows written before that so existing uploads
--   become visible instead of only new ones.
--
--   Note agency_id is uuid on vault_packages / destination_knowledge /
--   agency_packing_rules and text on document_chunks, which is why the bare
--   strings could only ever appear in document_chunks.

-- The shared default tenant, mirroring DEFAULT_AGENCY_ID in src/core/tenancy.py
-- and DEMO_AGENCY_ID in frontend/src/lib/supabaseClient.js.

-- ============================================================
-- document_chunks (agency_id is text)
-- ============================================================
UPDATE public.document_chunks
   SET agency_id = '00000000-0000-0000-0000-000000000001'
 WHERE agency_id IS NULL
    OR lower(btrim(agency_id)) IN ('', 'global', 'demo-agency', 'null', 'undefined', 'none');

-- ============================================================
-- vault_packages (agency_id is uuid, so only NULL can be orphaned)
-- ============================================================
UPDATE public.vault_packages
   SET agency_id = '00000000-0000-0000-0000-000000000001'::uuid
 WHERE agency_id IS NULL;

-- ============================================================
-- destination_knowledge (agency_id is uuid)
-- ============================================================
UPDATE public.destination_knowledge
   SET agency_id = '00000000-0000-0000-0000-000000000001'::uuid
 WHERE agency_id IS NULL;

-- ============================================================
-- agency_packing_rules (agency_id is uuid)
-- ============================================================
UPDATE public.agency_packing_rules
   SET agency_id = '00000000-0000-0000-0000-000000000001'::uuid
 WHERE agency_id IS NULL;

-- ============================================================
-- Defence in depth: an omitted agency_id now lands on the shared tenant rather
-- than NULL, so a future code path that forgets to set it degrades to
-- "visible in the default tenant" instead of "silently unreachable".
-- Deliberately not NOT NULL, to avoid failing writes in older code paths.
-- ============================================================
ALTER TABLE public.document_chunks
  ALTER COLUMN agency_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.vault_packages
  ALTER COLUMN agency_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

ALTER TABLE public.destination_knowledge
  ALTER COLUMN agency_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

ALTER TABLE public.agency_packing_rules
  ALTER COLUMN agency_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
