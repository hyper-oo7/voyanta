-- Migration: 20260712000002_activity_logs_retention.sql
-- Purpose: Add aggregated_at timestamp to activity_logs for safe retention cleanup

ALTER TABLE public.activity_logs
    ADD COLUMN IF NOT EXISTS aggregated_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_aggregated_created
    ON public.activity_logs(aggregated_at, created_at);
