-- Voyanta — Supabase schema (RLS-disabled, early-development friendly).
-- Paste into Supabase Studio → SQL editor → Run.
-- Tables intentionally accept anon writes so the app works without auth flows
-- during early iteration. Enable RLS later (commented stub at bottom).

create extension if not exists "pgcrypto";

-- AGENCIES --------------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  primary_color text,
  created_at timestamptz default now()
);

-- USERS (mirrors auth.users for app-level metadata) ---------------------------
create table if not exists public.users (
  id uuid primary key,
  agency_id uuid references public.agencies(id) on delete set null,
  email text,
  full_name text,
  role text default 'agent',
  created_at timestamptz default now()
);

-- CLIENTS ---------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  preferences jsonb,
  created_at timestamptz default now()
);

-- PROPOSALS -------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete set null,
  created_by uuid,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  client_name text,
  status text default 'Draft' check (status in ('Draft','Sent','Accepted','Declined')),
  destination text,
  start_date date,
  end_date date,
  travelers int default 1,
  budget_min numeric,
  budget_max numeric,
  currency text default 'INR',
  total_cost numeric,
  preferences jsonb,
  trip_details jsonb,
  brief jsonb,
  itinerary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists proposals_created_at_idx on public.proposals (created_at desc);
create index if not exists proposals_status_idx on public.proposals (status);

-- HOTELS ----------------------------------------------------------------------
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  location text,
  country text,
  category text,
  rating numeric,
  price_per_night numeric,
  currency text default 'INR',
  amenities text[],
  image_url text,
  created_at timestamptz default now()
);

-- FLIGHTS ---------------------------------------------------------------------
create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  airline text not null,
  class text,
  origin text,
  destination text,
  duration text,
  flight_no text,
  cost numeric,
  currency text default 'INR',
  created_at timestamptz default now()
);

-- ACTIVITIES ------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  type text,
  location text,
  duration_hours numeric,
  price numeric,
  currency text default 'INR',
  description text,
  image_url text,
  created_at timestamptz default now()
);

-- TEMPLATES -------------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  category text,
  days int,
  destination text,
  price_from numeric,
  currency text default 'INR',
  image_url text,
  data jsonb,
  created_at timestamptz default now()
);

-- updated_at trigger ----------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch
  before update on public.proposals
  for each row execute function public.touch_updated_at();

-- SEED a default agency so the app has somewhere to attach records ------------
insert into public.agencies (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Voyanta Demo Agency', 'voyanta-demo')
on conflict (id) do nothing;

-- =============================================================================
-- LATER: turn on agency-scoped RLS (uncomment when ready for multi-tenant)
-- alter table public.proposals enable row level security;
-- create policy "agency members read"
--   on public.proposals for select
--   using (agency_id = (select agency_id from public.users where id = auth.uid()));
-- create policy "agency members write"
--   on public.proposals for all
--   using (agency_id = (select agency_id from public.users where id = auth.uid()));
-- =============================================================================
