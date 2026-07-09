-- ============================================================================
-- Migration: 20260709000003_agency_packing_rules.sql
-- Purpose: Create agency_packing_rules for Agency-Exclusive "What to Pack"
--          and extra sections memory with strict agency_id RLS isolation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_packing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    destination_keyword TEXT NOT NULL,
    section_type TEXT NOT NULL DEFAULT 'what_to_pack', -- e.g. 'what_to_pack', 'important_notes', 'visa_guidelines'
    section_title TEXT NOT NULL DEFAULT 'What to Pack',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, destination_keyword, section_type)
);

CREATE INDEX IF NOT EXISTS idx_agency_packing_rules_agency_dest 
ON public.agency_packing_rules(agency_id, destination_keyword);

-- Enable Row Level Security
ALTER TABLE public.agency_packing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agencies can view their own packing rules" ON public.agency_packing_rules;
CREATE POLICY "Agencies can view their own packing rules"
    ON public.agency_packing_rules
    FOR SELECT
    USING (
        agency_id = public.current_agency_id()
        OR
        agency_id::text = current_setting('request.jwt.claim.sub', true)
    );

DROP POLICY IF EXISTS "Agencies can insert their own packing rules" ON public.agency_packing_rules;
CREATE POLICY "Agencies can insert their own packing rules"
    ON public.agency_packing_rules
    FOR INSERT
    WITH CHECK (
        agency_id = public.current_agency_id()
        OR
        agency_id::text = current_setting('request.jwt.claim.sub', true)
    );

DROP POLICY IF EXISTS "Agencies can update their own packing rules" ON public.agency_packing_rules;
CREATE POLICY "Agencies can update their own packing rules"
    ON public.agency_packing_rules
    FOR UPDATE
    USING (
        agency_id = public.current_agency_id()
        OR
        agency_id::text = current_setting('request.jwt.claim.sub', true)
    );

DROP POLICY IF EXISTS "Agencies can delete their own packing rules" ON public.agency_packing_rules;
CREATE POLICY "Agencies can delete their own packing rules"
    ON public.agency_packing_rules
    FOR DELETE
    USING (
        agency_id = public.current_agency_id()
        OR
        agency_id::text = current_setting('request.jwt.claim.sub', true)
    );
