-- ============================================================================
-- Migration: 20260710000008_supplier_rates.sql
-- Purpose: Add public.supplier_rates table for supplier rate management
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  knowledge_object_id UUID REFERENCES public.knowledge_objects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  valid_from DATE,
  valid_to DATE,
  source_pdf_id UUID REFERENCES public.supplier_pdfs(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see/modify rates scoped to their agency
DROP POLICY IF EXISTS "supplier_rates_agency_policy" ON public.supplier_rates;
CREATE POLICY "supplier_rates_agency_policy"
  ON public.supplier_rates FOR ALL
  USING (agency_id = public.current_agency_id() OR agency_id IS NULL);

-- Grant permissions
GRANT ALL ON public.supplier_rates TO authenticated, service_role;
