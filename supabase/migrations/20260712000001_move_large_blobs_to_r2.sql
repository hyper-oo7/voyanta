-- Migration: 20260712000001_move_large_blobs_to_r2.sql
-- Purpose: Add R2 key columns for offloading large text/JSON blobs from Postgres to R2 storage

ALTER TABLE public.vault_packages
    ADD COLUMN IF NOT EXISTS raw_text_r2_key TEXT;

-- Create ai_cache table if it was not created by a previous migration
CREATE TABLE IF NOT EXISTS public.ai_cache (
    cache_key TEXT PRIMARY KEY,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    entity_type TEXT,
    entity_id TEXT,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    output_json JSONB,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON public.ai_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_agency ON public.ai_cache(agency_id);

ALTER TABLE public.ai_cache
    ADD COLUMN IF NOT EXISTS output_r2_key TEXT;

ALTER TABLE public.ai_cache
    ALTER COLUMN output_json DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_packages_raw_text_r2_key ON public.vault_packages(raw_text_r2_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_output_r2_key ON public.ai_cache(output_r2_key);

