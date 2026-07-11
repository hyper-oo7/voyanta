-- Migration: 20260711000002_object_relations.sql
-- Purpose: Add object_relations table for spatial and logical links between knowledge objects

CREATE TABLE IF NOT EXISTS public.object_relations (
  object_a_id UUID REFERENCES public.knowledge_objects(id) ON DELETE CASCADE,
  object_b_id UUID REFERENCES public.knowledge_objects(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('nearby', 'pairs_well_with', 'alternative_to')),
  distance_minutes INT,
  confidence_level TEXT, -- e.g. 'high', 'medium', 'low'
  is_dismissed BOOLEAN DEFAULT false,
  PRIMARY KEY (object_a_id, object_b_id, relation_type)
);

-- Enable RLS
ALTER TABLE public.object_relations ENABLE ROW LEVEL SECURITY;

-- Add RLS Policy (Users can see/modify relations of objects scoped to their agency or global)
DROP POLICY IF EXISTS "object_relations_agency_policy" ON public.object_relations;
CREATE POLICY "object_relations_agency_policy" ON public.object_relations
  FOR ALL USING (
    object_a_id IN (
      SELECT id FROM public.knowledge_objects 
      WHERE agency_id = public.current_agency_id() OR agency_id IS NULL
    )
  );
