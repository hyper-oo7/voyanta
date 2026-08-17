-- Migration: 20260817000001_ai_telemetry_and_cache_rpc.sql
-- Structured AI Telemetry Table & Atomic Cache Stats Function

CREATE TABLE IF NOT EXISTS ai_telemetry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    agency_id       TEXT,
    event_type      TEXT NOT NULL,        -- 'llm_call', 'cache_hit', 'cache_miss', 'rag_retrieval'
    provider        TEXT,                 -- 'gemini', 'openai', 'cache'
    model           TEXT,
    entity_type     TEXT,                 -- 'vault_package', 'orchestrated_proposal', 'general', 'rag'
    cache_hit       BOOLEAN DEFAULT FALSE,
    latency_ms      INTEGER DEFAULT 0,
    tokens_in_est   INTEGER DEFAULT 0,
    tokens_out_est  INTEGER DEFAULT 0,
    cost_usd_est    NUMERIC(10, 6) DEFAULT 0.0,
    error           TEXT,
    metadata        JSONB DEFAULT '{}'
);

-- Indexes for dashboards and monitoring
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_agency_created 
    ON ai_telemetry (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_telemetry_event_type 
    ON ai_telemetry (event_type, created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies see own telemetry" ON ai_telemetry
    FOR SELECT USING (agency_id = auth.uid()::text OR agency_id IS NULL);

CREATE POLICY "Allow system insert on telemetry" ON ai_telemetry
    FOR INSERT WITH CHECK (true);

-- Atomic Cache Stat Counter Function (for multi-tenant race-safe counters)
CREATE OR REPLACE FUNCTION increment_cache_stat(stat_name TEXT, delta INTEGER DEFAULT 1)
RETURNS VOID LANGUAGE sql AS $$
    UPDATE ai_cache_stats 
    SET cache_hits = CASE WHEN stat_name = 'hits' THEN cache_hits + delta ELSE cache_hits END,
        cache_misses = CASE WHEN stat_name = 'misses' THEN cache_misses + delta ELSE cache_misses END,
        saved_tokens_estimate = CASE WHEN stat_name = 'tokens' THEN saved_tokens_estimate + delta ELSE saved_tokens_estimate END
    WHERE id = 'global';
$$;
