-- ============================================================================
-- Migration: 20260710000005_knowledge_objects.sql
-- Purpose: Add public.knowledge_objects table for atomic knowledge storage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN
    ('destination','hotel','activity','restaurant','transfer','visa_note')),
  name TEXT NOT NULL,
  destination TEXT,          -- e.g. "Dubai"
  area TEXT,                 -- e.g. "Marina"
  attributes JSONB DEFAULT '{}'::JSONB,  -- rating, price, duration, amenities, etc
  source_pdf_id UUID REFERENCES public.supplier_pdfs(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_knowledge_objects_lookup ON public.knowledge_objects (agency_id, object_type, destination);

-- Enable RLS
ALTER TABLE public.knowledge_objects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can select/modify knowledge objects scoped to their agency
DROP POLICY IF EXISTS "knowledge_objects_agency_policy" ON public.knowledge_objects;
CREATE POLICY "knowledge_objects_agency_policy"
  ON public.knowledge_objects FOR ALL
  USING (agency_id = public.current_agency_id() OR agency_id IS NULL);

-- Auto updated_at touch trigger
DROP TRIGGER IF EXISTS knowledge_objects_touch ON public.knowledge_objects;
CREATE TRIGGER knowledge_objects_touch
  BEFORE UPDATE ON public.knowledge_objects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
