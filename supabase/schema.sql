-- Voyanta — Master Supabase Schema
-- Consolidates v1, v2, v3, v4, v5 into a single multi-tenant deployment script.
-- Includes Row Level Security (RLS) scoped to agency_id.

create extension if not exists "pgcrypto";

-- Grant schema usage to standard roles to prevent "permission denied for schema public"
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- AGENCIES --------------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  primary_color text,
  font_family text,
  address text,
  contact_email text,
  contact_phone text,
  website text,
  social_links jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- SUBSCRIPTIONS ---------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade unique,
  plan text default 'Starter' check (plan in ('Starter','Pro','Enterprise')),
  status text default 'active',
  created_at timestamptz default now()
);

-- TEAM INVITATIONS ------------------------------------------------------------
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  email text not null,
  role text default 'agent',
  invited_by uuid, -- points to users(id), but we'll leave it loosely coupled
  status text default 'pending',
  created_at timestamptz default now()
);

-- ACTIVITY LOGS (Audit Trail) -------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  user_id uuid, -- who performed the action
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- USERS (mirrors auth.users for app-level metadata) ---------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete set null,
  email text,
  full_name text,
  role text default 'agent',
  created_at timestamptz default now()
);

-- RLS helper function
create or replace function public.current_agency_id()
returns uuid as $$
  select coalesce(
    (select agency_id from public.users where id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$ language sql stable security definer;

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

-- STATUS CHECKS (Replaces MongoDB) --------------------------------------------
create table if not exists public.status_checks (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  timestamp timestamptz default now()
);
alter table public.status_checks enable row level security;
drop policy if exists "status_checks_all" on public.status_checks;
create policy "status_checks_all" on public.status_checks for all using (true);

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
  is_archived boolean default false,
  arrival_city text,
  arrival_airport text,
  departure_city text,
  departure_airport text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists proposals_created_at_idx on public.proposals (created_at desc);
create index if not exists proposals_status_idx on public.proposals (status);

-- PROPOSAL ITEMS (v2) ---------------------------------------------------------
create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade,
  kind text not null check (kind in ('hotel','flight','activity','transfer','visa','tax','margin','custom')),
  ref_id uuid,
  label text not null,
  qty numeric default 1,
  unit_price numeric default 0,
  currency text default 'INR',
  meta jsonb,
  position int default 0,
  created_at timestamptz default now()
);
create index if not exists proposal_items_proposal_idx on public.proposal_items (proposal_id);

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
  cover_image text,
  gallery_images jsonb,
  supplier text,
  raw jsonb,
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
  depart_date date,
  supplier text,
  raw jsonb,
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
  supplier text,
  raw jsonb,
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
  raw jsonb,
  created_at timestamptz default now()
);

-- ITINERARIES (v4) ------------------------------------------------------------
create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  destination text,
  cover_image text,
  gallery_images jsonb,
  description text,
  duration int default 1,
  tags text[],
  country text,
  state text,
  city text,
  theme text,
  included_items jsonb default '[]'::jsonb,
  excluded_items jsonb default '[]'::jsonb,
  terms_conditions text,
  cancellation_policy text,
  important_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.itinerary_blocks (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references public.itineraries(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  block_type text not null check (block_type in ('arrival', 'day', 'departure')),
  day_number int,
  title text,
  description text,
  content jsonb default '[]'::jsonb,
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- IMPORTS (v2) ----------------------------------------------------------------
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  resource text not null check (resource in ('hotels','flights','activities','templates')),
  filename text,
  file_format text check (file_format in ('xlsx','csv','pdf')),
  status text default 'parsed' check (status in ('parsed','mapped','imported','failed')),
  source_columns text[],
  raw_rows jsonb,
  mapping jsonb,
  imported_count int default 0,
  created_by uuid,
  created_at timestamptz default now()
);

-- FIELD MAPPINGS (v2) ---------------------------------------------------------
create table if not exists public.field_mappings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  resource text not null,
  name text default 'default',
  mapping jsonb not null,
  created_at timestamptz default now(),
  unique (agency_id, resource, name)
);

-- updated_at triggers ---------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch before update on public.proposals for each row execute function public.touch_updated_at();

drop trigger if exists itineraries_touch on public.itineraries;
create trigger itineraries_touch before update on public.itineraries for each row execute function public.touch_updated_at();

drop trigger if exists itinerary_blocks_touch on public.itinerary_blocks;
create trigger itinerary_blocks_touch before update on public.itinerary_blocks for each row execute function public.touch_updated_at();

-- RLS & POLICIES (Multi-tenancy) ----------------------------------------------

-- Enable RLS on all tables
alter table public.agencies enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.hotels enable row level security;
alter table public.flights enable row level security;
alter table public.activities enable row level security;
alter table public.templates enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_blocks enable row level security;
alter table public.imports enable row level security;
alter table public.field_mappings enable row level security;

-- Agency policy: Users can only see their own agency
-- Agency policy: Users can only see their own agency
drop policy if exists "users_agency_select" on public.agencies;
create policy "users_agency_select" on public.agencies for select using (id = public.current_agency_id());

drop policy if exists "users_agency_update" on public.agencies;
create policy "users_agency_update" on public.agencies for update using (id = public.current_agency_id());

-- Users policy: Users can see themselves and other users in their agency
drop policy if exists "users_read" on public.users;
create policy "users_read" on public.users for select using (agency_id = public.current_agency_id() or id = auth.uid());

drop policy if exists "users_update" on public.users;
create policy "users_update" on public.users for update using (id = auth.uid());

-- Clients policy
drop policy if exists "clients_agency" on public.clients;
create policy "clients_agency" on public.clients for all using (agency_id = public.current_agency_id());

-- Proposals policy
drop policy if exists "proposals_agency" on public.proposals;
create policy "proposals_agency" on public.proposals for all using (agency_id = public.current_agency_id());

drop policy if exists "proposal_items_agency" on public.proposal_items;
create policy "proposal_items_agency" on public.proposal_items for all using (proposal_id in (select id from public.proposals where agency_id = public.current_agency_id()));

-- Inventory & Library policies
drop policy if exists "hotels_agency" on public.hotels;
create policy "hotels_agency" on public.hotels for all using (agency_id = public.current_agency_id());

drop policy if exists "flights_agency" on public.flights;
create policy "flights_agency" on public.flights for all using (agency_id = public.current_agency_id());

drop policy if exists "activities_agency" on public.activities;
create policy "activities_agency" on public.activities for all using (agency_id = public.current_agency_id());

drop policy if exists "templates_agency" on public.templates;
create policy "templates_agency" on public.templates for all using (agency_id = public.current_agency_id());

drop policy if exists "itineraries_agency" on public.itineraries;
create policy "itineraries_agency" on public.itineraries for all using (agency_id = public.current_agency_id());

drop policy if exists "itinerary_blocks_agency" on public.itinerary_blocks;
create policy "itinerary_blocks_agency" on public.itinerary_blocks for all using (agency_id = public.current_agency_id());

-- Import/Mapping policies
drop policy if exists "imports_agency" on public.imports;
create policy "imports_agency" on public.imports for all using (agency_id = public.current_agency_id());

drop policy if exists "field_mappings_agency" on public.field_mappings;
create policy "field_mappings_agency" on public.field_mappings for all using (agency_id = public.current_agency_id());

-- STORAGE BUCKET (v3) ---------------------------------------------------------
-- Note: Buckets are typically created in the Supabase Dashboard, but here is the raw SQL for reference.
insert into storage.buckets (id, name, public) values ('agency-assets', 'agency-assets', true) on conflict (id) do nothing;

drop policy if exists "Public read agency assets" on storage.objects;
create policy "Public read agency assets" on storage.objects for select using (bucket_id = 'agency-assets');

drop policy if exists "Users can upload agency assets" on storage.objects;
create policy "Users can upload agency assets" on storage.objects for insert with check (bucket_id = 'agency-assets' and auth.uid() is not null);

drop policy if exists "Users can update agency assets" on storage.objects;
create policy "Users can update agency assets" on storage.objects for update using (bucket_id = 'agency-assets' and auth.uid() is not null);

drop policy if exists "Users can delete agency assets" on storage.objects;
create policy "Users can delete agency assets" on storage.objects for delete using (bucket_id = 'agency-assets' and auth.uid() is not null);

-- INDEXES FOR PERFORMANCE -----------------------------------------------------
create index if not exists clients_agency_idx on public.clients (agency_id);
create index if not exists hotels_agency_idx on public.hotels (agency_id);
create index if not exists flights_agency_idx on public.flights (agency_id);
create index if not exists activities_agency_idx on public.activities (agency_id);
create index if not exists templates_agency_idx on public.templates (agency_id);
create index if not exists proposal_items_ref_idx on public.proposal_items (ref_id);

-- SEED DATA -------------------------------------------------------------------
-- Demo agency will act as the default agency for local dev/testing
insert into public.agencies (id, name, slug) values ('00000000-0000-0000-0000-000000000001', 'Voyanta Demo Agency', 'voyanta-demo') on conflict do nothing;

-- Add demo data scoped to the demo agency
insert into public.hotels (id, agency_id, name, location, country, category, rating, price_per_night, currency, supplier)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Hotel A','Paris','France','Boutique',4.6,420,'INR','sample'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Hotel B','Tokyo','Japan','Luxury',4.9,890,'INR','sample')
on conflict do nothing;

insert into public.flights (id, agency_id, airline, class, origin, destination, depart_date, flight_no, cost, currency, supplier)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Air Sample','Business','JFK','CDG','2026-03-12','AS101',2150,'INR','sample'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Test Air','Economy','LHR','HND','2026-04-08','TA220', 980,'INR','sample')
on conflict do nothing;

insert into public.activities (id, agency_id, name, type, location, duration_hours, price, currency, description, supplier)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Walking Tour','tour','Paris',2,75,'INR','Sample activity for testing','sample'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Boat Excursion','excursion','Capri',4,180,'INR','Sample activity for testing','sample')
on conflict do nothing;
