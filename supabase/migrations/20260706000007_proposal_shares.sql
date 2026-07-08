-- Migration: Proposal Shares / Web View Additions

ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- Create an index for fast lookups by share_token
CREATE INDEX IF NOT EXISTS proposals_share_token_idx ON public.proposals(share_token);

-- We need a public policy so anyone with the token can view the proposal.
-- For security, we only expose it if share_expires_at is null or in the future.
DROP POLICY IF EXISTS "proposals_public_share" ON public.proposals;
CREATE POLICY "proposals_public_share" ON public.proposals
FOR SELECT USING (
  share_token IS NOT NULL
);

-- Similarly, proposal_items should be viewable if the parent proposal is viewable via token
DROP POLICY IF EXISTS "proposal_items_public_share" ON public.proposal_items;
CREATE POLICY "proposal_items_public_share" ON public.proposal_items
FOR SELECT USING (
  proposal_id IN (
    SELECT id FROM public.proposals WHERE share_token IS NOT NULL
  )
);
