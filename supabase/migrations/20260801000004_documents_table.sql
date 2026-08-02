-- Migration: 20260801000004_documents_table.sql
-- Description: Create public.documents table for tracking uploaded supplier PDFs and travel documents

CREATE TABLE IF NOT EXISTS public.documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_id TEXT NOT NULL DEFAULT 'global',
    filename TEXT NOT NULL,
    document_type TEXT DEFAULT 'pdf',
    tags TEXT[] DEFAULT '{}',
    extracted_entities JSONB DEFAULT '{}'::jsonb,
    page_count INT DEFAULT 1,
    status TEXT DEFAULT 'processed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_documents_agency ON public.documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);

-- Security Isolation RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Read Documents" ON public.documents
    FOR SELECT USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Tenant Insert Documents" ON public.documents
    FOR INSERT WITH CHECK (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Tenant Delete Documents" ON public.documents
    FOR DELETE USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));
