-- Migration: 20260717000001_add_proposal_visibility_mode.sql
-- Epic 1: Pricing Visibility Controls
-- Adds visibility_mode column to proposals using a strict ENUM and enforces RLS isolation.

-- 1. Create strict ENUM type proposal_visibility_mode ('ITEMIZED', 'TOTAL_ONLY', 'HIDDEN')
do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_visibility_mode') then
    create type public.proposal_visibility_mode as enum ('ITEMIZED', 'TOTAL_ONLY', 'HIDDEN');
  end if;
end
$$;

-- 2. Add visibility_mode column to proposals table with default 'ITEMIZED'
alter table public.proposals
  add column if not exists visibility_mode public.proposal_visibility_mode not null default 'ITEMIZED';

-- 3. Ensure Row-Level Security (RLS) is enabled on proposals and strictly maintains tenant_id/agency_id isolation for visibility_mode
alter table public.proposals enable row level security;

drop policy if exists "proposals_agency" on public.proposals;
create policy "proposals_agency" on public.proposals
  for all
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());
