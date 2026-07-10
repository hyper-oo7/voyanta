-- ============================================================================
-- Migration: 20260710000009_seasonal_rules.sql
-- Purpose: Add public.seasonal_rules table and seed initial seasonal rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.seasonal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('avoid','prefer','warn')),
  applies_to_tag TEXT,        -- e.g. 'outdoor'
  message TEXT,
  source_pdf_id UUID REFERENCES public.supplier_pdfs(id)
);

-- Enable RLS
ALTER TABLE public.seasonal_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read global rules (agency_id is null) or their own agency's rules
DROP POLICY IF EXISTS "seasonal_rules_agency_policy" ON public.seasonal_rules;
CREATE POLICY "seasonal_rules_agency_policy"
  ON public.seasonal_rules FOR ALL
  USING (agency_id = public.current_agency_id() OR agency_id IS NULL);

-- Grant permissions
GRANT ALL ON public.seasonal_rules TO authenticated, service_role;

-- Seed a starter set of ~20 well-known rules (agency_id IS NULL for global rules)
INSERT INTO public.seasonal_rules (destination, month, rule_type, applies_to_tag, message) VALUES
  -- Dubai Summer Heat Rules
  ('Dubai', 6, 'avoid', 'outdoor', 'Extreme summer heat in Dubai. Avoid outdoor midday activities.'),
  ('Dubai', 7, 'avoid', 'outdoor', 'Extreme summer heat in Dubai. Avoid outdoor midday activities.'),
  ('Dubai', 8, 'avoid', 'outdoor', 'Extreme summer heat in Dubai. Avoid outdoor midday activities.'),
  
  -- Goa Monsoon Rules
  ('Goa', 6, 'avoid', 'outdoor', 'Monsoon season in Goa. Avoid water sports and heavy outdoor beach activities.'),
  ('Goa', 7, 'avoid', 'outdoor', 'Monsoon season in Goa. Avoid water sports and heavy outdoor beach activities.'),
  ('Goa', 8, 'avoid', 'outdoor', 'Monsoon season in Goa. Avoid water sports and heavy outdoor beach activities.'),
  ('Goa', 9, 'avoid', 'outdoor', 'Monsoon season in Goa. Avoid water sports and heavy outdoor beach activities.'),
  
  -- Kerala Peak Winter Warning
  ('Kerala', 12, 'warn', NULL, 'December is peak tourist season in Kerala. Hotel availability may be extremely tight.'),
  ('Kerala', 1, 'warn', NULL, 'January is peak tourist season in Kerala. Hotel availability may be extremely tight.'),
  
  -- Rajasthan Summer Warnings
  ('Rajasthan', 4, 'warn', 'outdoor', 'Summer temperature rising in Rajasthan. Recommend afternoon indoor sightseeing.'),
  ('Rajasthan', 5, 'avoid', 'outdoor', 'Peak summer heat in Rajasthan. Avoid long outdoor walks or desert safaris during midday.'),
  ('Rajasthan', 6, 'avoid', 'outdoor', 'Peak summer heat in Rajasthan. Avoid long outdoor walks or desert safaris during midday.'),

  -- Ladakh Cold & Closed Roads
  ('Ladakh', 12, 'avoid', 'outdoor', 'Severe winter in Ladakh. Roads and passes are closed due to snow. Avoid adventure activities.'),
  ('Ladakh', 1, 'avoid', 'outdoor', 'Severe winter in Ladakh. Roads and passes are closed due to snow. Avoid adventure activities.'),
  ('Ladakh', 2, 'avoid', 'outdoor', 'Severe winter in Ladakh. Roads and passes are closed due to snow. Avoid adventure activities.'),
  
  -- Ladakh Summer Preferences
  ('Ladakh', 6, 'prefer', 'outdoor', 'Perfect summer weather in Ladakh. Highly recommend outdoor tours, trekking, and sightseeing.'),
  ('Ladakh', 7, 'prefer', 'outdoor', 'Perfect summer weather in Ladakh. Highly recommend outdoor tours, trekking, and sightseeing.'),
  ('Ladakh', 8, 'prefer', 'outdoor', 'Perfect summer weather in Ladakh. Highly recommend outdoor tours, trekking, and sightseeing.'),

  -- Iceland Winter Aurora Preferences
  ('Iceland', 12, 'prefer', 'outdoor', 'Winter season in Iceland is ideal for Northern Lights viewing and ice cave exploration.'),
  ('Iceland', 1, 'prefer', 'outdoor', 'Winter season in Iceland is ideal for Northern Lights viewing and ice cave exploration.'),
  
  -- Iceland Summer Hiking Preferences
  ('Iceland', 7, 'prefer', 'outdoor', 'Icelandic summer is perfect for hiking, highland tours, and driving the Ring Road.'),
  ('Iceland', 8, 'prefer', 'outdoor', 'Icelandic summer is perfect for hiking, highland tours, and driving the Ring Road.')
ON CONFLICT DO NOTHING;
