-- Migration: 20260711000006_ai_extraction_cache.sql
-- Purpose: Define ai_cache and ai_cache_stats tables for AI extraction caching

CREATE TABLE IF NOT EXISTS public.ai_cache (
    cache_key TEXT PRIMARY KEY,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    entity_type TEXT,
    entity_id TEXT,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    output_json JSONB NOT NULL,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON public.ai_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_agency ON public.ai_cache(agency_id);

CREATE TABLE IF NOT EXISTS public.ai_cache_stats (
    id TEXT PRIMARY KEY DEFAULT 'global',
    cache_hits INT DEFAULT 0,
    cache_misses INT DEFAULT 0,
    saved_tokens_estimate INT DEFAULT 0
);

INSERT INTO public.ai_cache_stats (id, cache_hits, cache_misses, saved_tokens_estimate)
VALUES ('global', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;
