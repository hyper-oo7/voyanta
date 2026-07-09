-- Migration 20260709000002: Fix Schema Drift — Add Missing Columns
-- Fixes:
--   1. clients table: add destination, status, notes, tags, total_spend, updated_at
--      Also rename full_name → name if it exists under the old name.
--   2. invoices table: add taxes jsonb column
--   3. clients table: ensure column name is 'name' not 'full_name'

-- ============================================================================
-- CLIENTS TABLE: Add missing columns
-- ============================================================================

-- Rename full_name → name if full_name exists (schema.sql had wrong column name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'full_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN full_name TO name;
  END IF;
END $$;

-- Add missing columns to clients (all IF NOT EXISTS safe)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Inquiry';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spend NUMERIC DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferences JSONB;

-- Add check constraint on status if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_check'
  ) THEN
    BEGIN
      ALTER TABLE public.clients ADD CONSTRAINT clients_status_check
        CHECK (status IN ('Inquiry', 'Proposal Sent', 'Approved', 'Booked', 'Completed', 'Cancelled'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- INVOICES TABLE: Add missing taxes column
-- ============================================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS taxes JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- PROPOSALS TABLE: Ensure share columns exist (in case previous migration was skipped)
-- ============================================================================

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS share_token UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- Safe add unique constraint if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_share_token_key'
  ) THEN
    ALTER TABLE public.proposals ADD CONSTRAINT proposals_share_token_key UNIQUE (share_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS proposals_share_token_idx ON public.proposals(share_token);

-- Remove auto-generation default on share_token
ALTER TABLE public.proposals ALTER COLUMN share_token DROP DEFAULT;

-- ============================================================================
-- RLS: Tighten public share policies
-- ============================================================================

DROP POLICY IF EXISTS "proposals_public_share" ON public.proposals;
CREATE POLICY "proposals_public_share" ON public.proposals
FOR SELECT USING (
  share_token IS NOT NULL
  AND (share_expires_at IS NULL OR share_expires_at > now())
);

DROP POLICY IF EXISTS "proposal_items_public_share" ON public.proposal_items;
CREATE POLICY "proposal_items_public_share" ON public.proposal_items
FOR SELECT USING (
  proposal_id IN (
    SELECT id FROM public.proposals
    WHERE share_token IS NOT NULL
      AND (share_expires_at IS NULL OR share_expires_at > now())
  )
);
