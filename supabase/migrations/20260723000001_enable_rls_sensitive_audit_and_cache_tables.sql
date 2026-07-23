-- Migration: 20260723000001_enable_rls_sensitive_audit_and_cache_tables.sql
-- Purpose: Enable Row Level Security (RLS) safely on ai_cache, ai_cache_stats, billing_payment_logs, and compliance_consent_logs tables.
-- Ensures strict multi-tenant isolation and prevents unauthorized direct access via PostgREST/Supabase client.

-- 1. Enable RLS on compliance_consent_logs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'compliance_consent_logs') THEN
        EXECUTE 'ALTER TABLE public.compliance_consent_logs ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "compliance_consent_logs_agency" ON public.compliance_consent_logs;';
        EXECUTE 'CREATE POLICY "compliance_consent_logs_agency" ON public.compliance_consent_logs
            FOR ALL
            USING (
                agency_id = public.current_agency_id()
                OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
            )
            WITH CHECK (
                agency_id = public.current_agency_id()
                OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
            );';
        EXECUTE 'GRANT SELECT, INSERT ON public.compliance_consent_logs TO authenticated;';
    END IF;
END $$;

-- 2. Enable RLS on billing_payment_logs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_payment_logs') THEN
        EXECUTE 'ALTER TABLE public.billing_payment_logs ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "billing_payment_logs_agency" ON public.billing_payment_logs;';
        EXECUTE 'CREATE POLICY "billing_payment_logs_agency" ON public.billing_payment_logs
            FOR ALL
            USING (
                agency_id = public.current_agency_id()
            )
            WITH CHECK (
                agency_id = public.current_agency_id()
            );';
        EXECUTE 'GRANT SELECT ON public.billing_payment_logs TO authenticated;';
    END IF;
END $$;

-- 3. Enable RLS on ai_cache
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_cache') THEN
        EXECUTE 'ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "ai_cache_agency" ON public.ai_cache;';
        EXECUTE 'CREATE POLICY "ai_cache_agency" ON public.ai_cache
            FOR ALL
            USING (
                agency_id = public.current_agency_id() OR agency_id IS NULL
            )
            WITH CHECK (
                agency_id = public.current_agency_id() OR agency_id IS NULL
            );';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.ai_cache TO authenticated;';
    END IF;
END $$;

-- 4. Enable RLS on ai_cache_stats (Safely create table if missing, or enable RLS)
CREATE TABLE IF NOT EXISTS public.ai_cache_stats (
    id TEXT PRIMARY KEY DEFAULT 'global',
    cache_hits INT DEFAULT 0,
    cache_misses INT DEFAULT 0,
    saved_tokens_estimate INT DEFAULT 0
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_cache_stats') THEN
        EXECUTE 'ALTER TABLE public.ai_cache_stats ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "ai_cache_stats_admin_only" ON public.ai_cache_stats;';
        EXECUTE 'CREATE POLICY "ai_cache_stats_admin_only" ON public.ai_cache_stats
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = auth.uid()
                    AND role IN (''owner'', ''admin'')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = auth.uid()
                    AND role IN (''owner'', ''admin'')
                )
            );';
    END IF;
END $$;
