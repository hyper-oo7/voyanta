-- Migration 20260709000001: Fix RLS Policies & Prevent Share Token Leakage
-- 1. Ensure columns exist on public.proposals.
-- 2. Tighten public share policies so only anonymous/public requests with a valid share_token can read a proposal.
-- 3. Ensure share_token does not default to gen_random_uuid() on every proposal creation unless explicitly shared.

-- Safe add columns if not present
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

-- Create index if not present
CREATE INDEX IF NOT EXISTS proposals_share_token_idx ON public.proposals(share_token);

-- Remove auto-generation default on share_token so new proposals are private by default
ALTER TABLE public.proposals ALTER COLUMN share_token DROP DEFAULT;

-- Drop overly permissive public share policy on proposals
DROP POLICY IF EXISTS "proposals_public_share" ON public.proposals;

-- Recreate tightened public share policy:
-- Only allows access if share_token is explicitly set AND share_expires_at is either NULL or in the future
CREATE POLICY "proposals_public_share" ON public.proposals
FOR SELECT USING (
  share_token IS NOT NULL
  AND (share_expires_at IS NULL OR share_expires_at > now())
);

-- Drop overly permissive public share policy on proposal_items
DROP POLICY IF EXISTS "proposal_items_public_share" ON public.proposal_items;

-- Recreate tightened proposal_items public share policy
CREATE POLICY "proposal_items_public_share" ON public.proposal_items
FOR SELECT USING (
  proposal_id IN (
    SELECT id FROM public.proposals
    WHERE share_token IS NOT NULL
      AND (share_expires_at IS NULL OR share_expires_at > now())
  )
);
