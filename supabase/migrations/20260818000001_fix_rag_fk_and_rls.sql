-- Migration: 20260818000001_fix_rag_fk_and_rls.sql
-- Description: 
--   1. Drop the FK constraint on document_chunks.document_id so vault_package_id can be used as document_id
--   2. Harden current_agency_id() with safe JSON extraction and all fallback paths
--   3. Fix proposals/clients RLS to add auth.uid() lookup fallback
--   4. Fix document_chunks/documents RLS policies

-- ============================================================
-- FIX 1: Drop FK constraint on document_chunks
-- Root cause: store_chunks() passes vault_package_id as document_id,
-- but FK requires it to exist in public.documents, causing silent insert failure
-- ============================================================
ALTER TABLE public.document_chunks
  DROP CONSTRAINT IF EXISTS fk_document;

ALTER TABLE public.document_chunks
  DROP CONSTRAINT IF EXISTS document_chunks_document_id_fkey;

-- ============================================================
-- FIX 2: Harden current_agency_id() with safe JSON extraction
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid AS $$
DECLARE
  v_headers text;
  v_jwt_claims text;
  v_agency_id text;
BEGIN
  -- 1. Try request.headers JSON (modern PostgREST)
  BEGIN
    v_headers := current_setting('request.headers', true);
    IF v_headers IS NOT NULL AND v_headers <> '' THEN
      BEGIN
        v_agency_id := v_headers::json->>'x-tenant-id';
        IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
          RETURN v_agency_id::uuid;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2. Try legacy GUC request.header.x-tenant-id
  BEGIN
    v_agency_id := current_setting('request.header.x-tenant-id', true);
    IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
      RETURN v_agency_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 3. Try app.current_agency_id (set by backend services)
  BEGIN
    v_agency_id := current_setting('app.current_agency_id', true);
    IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
      RETURN v_agency_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 4. Try JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true);
    IF v_jwt_claims IS NOT NULL AND v_jwt_claims <> '' THEN
      BEGIN
        v_agency_id := v_jwt_claims::json->>'agency_id';
        IF v_agency_id IS NULL OR v_agency_id = '' THEN
          v_agency_id := v_jwt_claims::json->>'tenant_id';
        END IF;
        IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
          RETURN v_agency_id::uuid;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 5. Legacy JWT claim GUCs
  BEGIN
    v_agency_id := current_setting('request.jwt.claim.agency_id', true);
    IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
      RETURN v_agency_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    v_agency_id := current_setting('request.jwt.claim.tenant_id', true);
    IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
      RETURN v_agency_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 6. Authoritative fallback: query public.users via auth.uid()
  IF auth.uid() IS NOT NULL THEN
    SELECT u.agency_id::text INTO v_agency_id
    FROM public.users u
    WHERE u.id = auth.uid()
    LIMIT 1;
    IF v_agency_id IS NOT NULL AND v_agency_id <> '' THEN
      RETURN v_agency_id::uuid;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- FIX 3: Proposals RLS — add auth.uid() fallback policy
-- ============================================================
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposals_agency" ON public.proposals;
CREATE POLICY "proposals_agency" ON public.proposals
  FOR ALL
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

DROP POLICY IF EXISTS "proposals_auth_fallback" ON public.proposals;
CREATE POLICY "proposals_auth_fallback" ON public.proposals
  FOR ALL
  USING (
    created_by = auth.uid()
    OR agency_id = (
      SELECT u.agency_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR agency_id = (
      SELECT u.agency_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1
    )
  );

-- ============================================================
-- FIX 4: Clients RLS — same fallback
-- ============================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_agency" ON public.clients;
CREATE POLICY "clients_agency" ON public.clients
  FOR ALL
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

DROP POLICY IF EXISTS "clients_auth_fallback" ON public.clients;
CREATE POLICY "clients_auth_fallback" ON public.clients
  FOR ALL
  USING (
    agency_id = (
      SELECT u.agency_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    agency_id = (
      SELECT u.agency_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1
    )
  );

-- ============================================================
-- FIX 5: document_chunks RLS — multi-path resolution
-- ============================================================
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Read Document Chunks" ON public.document_chunks;
CREATE POLICY "Tenant Read Document Chunks" ON public.document_chunks
  FOR SELECT
  USING (
    agency_id = 'global'
    OR agency_id = coalesce(current_setting('app.current_agency_id', true), '')
    OR agency_id = public.current_agency_id()::text
  );

DROP POLICY IF EXISTS "Tenant Insert Document Chunks" ON public.document_chunks;
CREATE POLICY "Tenant Insert Document Chunks" ON public.document_chunks
  FOR INSERT
  WITH CHECK (
    agency_id = 'global'
    OR agency_id = coalesce(current_setting('app.current_agency_id', true), '')
    OR agency_id = public.current_agency_id()::text
  );

DROP POLICY IF EXISTS "Tenant Delete Document Chunks" ON public.document_chunks;
CREATE POLICY "Tenant Delete Document Chunks" ON public.document_chunks
  FOR DELETE
  USING (
    agency_id = 'global'
    OR agency_id = coalesce(current_setting('app.current_agency_id', true), '')
    OR agency_id = public.current_agency_id()::text
  );

-- ============================================================
-- FIX 6: Documents table RLS — same multi-path resolution
-- ============================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Read Documents" ON public.documents;
CREATE POLICY "Tenant Read Documents" ON public.documents
  FOR SELECT
  USING (
    agency_id = 'global'
    OR agency_id = coalesce(current_setting('app.current_agency_id', true), '')
    OR agency_id = public.current_agency_id()::text
  );

DROP POLICY IF EXISTS "Tenant Insert Documents" ON public.documents;
CREATE POLICY "Tenant Insert Documents" ON public.documents
  FOR INSERT
  WITH CHECK (
    agency_id = 'global'
    OR agency_id = coalesce(current_setting('app.current_agency_id', true), '')
    OR agency_id = public.current_agency_id()::text
  );

DROP POLICY IF EXISTS "Tenant Delete Documents" ON public.documents;
CREATE POLICY "Tenant Delete Documents" ON public.documents
  FOR DELETE
  USING (
    agency_id = 'global'
    OR agency_id = coalesce(current_setting('app.current_agency_id', true), '')
    OR agency_id = public.current_agency_id()::text
  );

-- ============================================================
-- FIX 7: Grant execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.match_document_chunks TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_agency_id TO anon, authenticated, service_role;
