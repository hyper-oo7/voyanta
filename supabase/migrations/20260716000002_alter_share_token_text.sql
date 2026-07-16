-- Migration: 20260716000002_alter_share_token_text.sql
-- Alters proposals.share_token from UUID to TEXT to support secure random human-friendly links

-- 1. Drop existing constraints, index, and policies depending on the column type or requiring recreation
drop policy if exists "proposals_public_share" on public.proposals;
drop policy if exists "proposal_items_public_share" on public.proposal_items;
drop index if exists public.proposals_share_token_idx;
alter table public.proposals drop constraint if exists proposals_share_token_key;

-- 2. Alter column type to text
alter table public.proposals alter column share_token type text;

-- 3. Re-create unique constraint and index
alter table public.proposals add constraint proposals_share_token_key unique (share_token);
create index if not exists proposals_share_token_idx on public.proposals(share_token);

-- 4. Re-create public share policies to work with the updated share_token text column
create policy "proposals_public_share" on public.proposals for select using (
  share_token is not null and (share_expires_at is null or share_expires_at > now())
);

create policy "proposal_items_public_share" on public.proposal_items for select using (
  proposal_id in (
    select id from public.proposals where share_token is not null and (share_expires_at is null or share_expires_at > now())
  )
);
