-- ============================================================================
-- Migration: 20260710000001_vault_v2_tables.sql
-- Purpose: Vault V2 — Persistent vault_packages & destination_knowledge tables
-- ============================================================================

-- VAULT PACKAGES — Stores each parsed PDF as a structured package
CREATE TABLE IF NOT EXISTS public.vault_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- per-agent scope
    destination TEXT NOT NULL,
    sub_destinations TEXT[] DEFAULT '{}',
    currency TEXT DEFAULT 'INR',
    total_price NUMERIC,
    duration_days INT,
    overview TEXT,
    cover_image_url TEXT,        -- First image extracted from PDF (base64 or URL)
    pdf_filename TEXT,
    source_pdf_hash TEXT,        -- SHA-256 of PDF bytes for dedup
    parsed_data JSONB NOT NULL,  -- Full structured itinerary JSON (days, hotels, activities, meals, transfers)
    extra_sections JSONB DEFAULT '{}', -- what_to_pack, visa, inclusions, etc.
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_packages_agency ON public.vault_packages(agency_id);
CREATE INDEX IF NOT EXISTS idx_vault_packages_user ON public.vault_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_packages_destination ON public.vault_packages(destination);
CREATE INDEX IF NOT EXISTS idx_vault_packages_hash ON public.vault_packages(source_pdf_hash);

-- DESTINATION KNOWLEDGE — Accumulated static sections per destination per agent
CREATE TABLE IF NOT EXISTS public.destination_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- per-agent scope
    destination TEXT NOT NULL,
    section_type TEXT NOT NULL,   -- 'what_to_pack', 'visa_guidelines', 'inclusions', 'exclusions', 'important_notes', 'damages', 'cancellation_policy', 'dos_and_donts'
    section_title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_count INT DEFAULT 1,   -- How many PDFs contributed to this knowledge
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, user_id, destination, section_type)
);

CREATE INDEX IF NOT EXISTS idx_dest_knowledge_agency ON public.destination_knowledge(agency_id);
CREATE INDEX IF NOT EXISTS idx_dest_knowledge_user ON public.destination_knowledge(user_id);
CREATE INDEX IF NOT EXISTS idx_dest_knowledge_dest ON public.destination_knowledge(destination);

-- Enable Row Level Security
ALTER TABLE public.vault_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see packages belonging to their agency (enterprise team sharing)
DROP POLICY IF EXISTS "vault_packages_agency_rls" ON public.vault_packages;
CREATE POLICY "vault_packages_agency_rls"
    ON public.vault_packages FOR ALL
    USING (agency_id = public.current_agency_id() OR agency_id IS NULL);

DROP POLICY IF EXISTS "dest_knowledge_agency_rls" ON public.destination_knowledge;
CREATE POLICY "dest_knowledge_agency_rls"
    ON public.destination_knowledge FOR ALL
    USING (agency_id = public.current_agency_id() OR agency_id IS NULL);

-- Updated_at trigger
DROP TRIGGER IF EXISTS vault_packages_touch ON public.vault_packages;
CREATE TRIGGER vault_packages_touch
    BEFORE UPDATE ON public.vault_packages
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS dest_knowledge_touch ON public.destination_knowledge;
CREATE TRIGGER dest_knowledge_touch
    BEFORE UPDATE ON public.destination_knowledge
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
