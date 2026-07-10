-- ============================================================================
-- Migration: 20260710000006_object_tags.sql
-- Purpose: Add public.object_tags table for taxonomical categorization
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.object_tags (
  object_id UUID REFERENCES public.knowledge_objects(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_category TEXT NOT NULL CHECK (tag_category IN
    ('audience','pace','setting','price_tier','season','duration')),
  PRIMARY KEY (object_id, tag)
);

-- Enable RLS
ALTER TABLE public.object_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see/modify tags of objects scoped to their agency
DROP POLICY IF EXISTS "object_tags_agency_policy" ON public.object_tags;
CREATE POLICY "object_tags_agency_policy"
  ON public.object_tags FOR ALL
  USING (object_id IN (
    SELECT id FROM public.knowledge_objects 
    WHERE agency_id = public.current_agency_id() OR agency_id IS NULL
  ));
