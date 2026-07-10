-- ============================================================================
-- Migration: 20260710000007_object_affinity.sql
-- Purpose: Add public.object_affinity table for Phase 3 training signal loop
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.object_affinity (
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  object_id UUID REFERENCES public.knowledge_objects(id) ON DELETE CASCADE,
  times_suggested INT DEFAULT 0,
  times_added INT DEFAULT 0,
  times_rejected INT DEFAULT 0,
  affinity_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (agency_id, object_id)
);

-- Enable RLS
ALTER TABLE public.object_affinity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see/modify affinity records of objects scoped to their agency
DROP POLICY IF EXISTS "object_affinity_agency_policy" ON public.object_affinity;
CREATE POLICY "object_affinity_agency_policy"
  ON public.object_affinity FOR ALL
  USING (agency_id = public.current_agency_id() OR agency_id IS NULL);

-- Touch updated_at trigger
DROP TRIGGER IF EXISTS touch_object_affinity_trigger ON public.object_affinity;
CREATE TRIGGER touch_object_affinity_trigger
  BEFORE UPDATE ON public.object_affinity
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Grant permissions
GRANT ALL ON public.object_affinity TO authenticated, service_role;
