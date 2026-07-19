-- Migration: 20260719000001_user_terms_acceptances.sql
-- Purpose: Store user terms and conditions acceptance under the DPDP Act 2023.

-- 1. Helper function to extract IP from request headers if available
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS text AS $$
DECLARE
  r_headers text;
  ip_val text;
BEGIN
  r_headers := current_setting('request.headers', true);
  IF r_headers IS NULL OR r_headers = '' THEN
    RETURN '127.0.0.1';
  END IF;
  
  BEGIN
    ip_val := r_headers::json->>'x-forwarded-for';
    IF ip_val IS NOT NULL THEN
      -- Grab the first IP in the forwarded list
      ip_val := split_part(ip_val, ',', 1);
      RETURN trim(ip_val);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback
  END;

  BEGIN
    ip_val := r_headers::json->>'cf-connecting-ip';
    IF ip_val IS NOT NULL THEN
      RETURN trim(ip_val);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback
  END;

  RETURN '127.0.0.1';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Create the acceptances table
CREATE TABLE IF NOT EXISTS public.user_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL DEFAULT 'v1.0',
  ip_address text NOT NULL DEFAULT public.get_client_ip(),
  user_agent text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.user_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies
DROP POLICY IF EXISTS "users_read_own_acceptances" ON public.user_terms_acceptances;
CREATE POLICY "users_read_own_acceptances" ON public.user_terms_acceptances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_acceptances" ON public.user_terms_acceptances;
CREATE POLICY "users_insert_own_acceptances" ON public.user_terms_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Grant permissions on tables
GRANT SELECT, INSERT ON public.user_terms_acceptances TO authenticated;
