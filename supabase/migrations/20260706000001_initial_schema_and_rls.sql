-- VOYANTA ENTERPRISE MULTI-TENANCY SCHEMA (MIGRATION 1)
-- Requires PostgreSQL 15+ & Supabase Extensions

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- CURRENT AGENCY ID RESOLVER FUNCTION
create or replace function public.current_agency_id()
returns uuid as $$
declare
  v_agency_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select agency_id into v_agency_id
  from public.users
  where id = auth.uid()
  limit 1;

  return v_agency_id;
end;
$$ language plpgsql stable security definer;

-- AGENCIES TABLE
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  primary_color text default '#0f172a',
  secondary_color text default '#f8fafc',
  custom_domain text unique,
  address text,
  contact_email text,
  contact_phone text,
  website text,
  gst_number text,
  default_currency text default 'INR',
  default_tax_rate numeric default 5.0,
  terms_conditions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- USERS TABLE
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  email text not null,
  full_name text,
  role text default 'agent' check (role in ('owner', 'admin', 'agent', 'readonly')),
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade unique,
  plan text not null default 'Trial' check (plan in ('Trial', 'Starter', 'Professional', 'Enterprise')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing')),
  current_period_start timestamptz default now(),
  current_period_end timestamptz default (now() + interval '14 days'),
  max_users int default 5,
  max_proposals_per_month int default 50,
  features jsonb default '{"ai_assistant": true, "custom_branding": true, "pdf_export": true}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TEAM INVITATIONS
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent', 'readonly')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.users(id) on delete set null,
  token text unique default gen_random_uuid()::text,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

-- CLIENTS
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  destination text,
  status text default 'Inquiry' check (status in ('Inquiry', 'Proposal Sent', 'Approved', 'Booked', 'Completed', 'Cancelled')),
  notes text,
  tags text[],
  total_spend numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROPOSALS
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  client_name text,
  client_email text,
  client_phone text,
  status text default 'Draft' check (status in ('Draft', 'Sent', 'Approved', 'Modified', 'Archived', 'Rejected')),
  destination text,
  start_date date,
  end_date date,
  travelers int default 2,
  budget_min numeric,
  budget_max numeric,
  currency text default 'INR',
  total_cost numeric default 0,
  is_archived boolean default false,
  arrival_city text,
  arrival_airport text,
  departure_city text,
  departure_airport text,
  preferences jsonb,
  trip_details jsonb,
  brief jsonb,
  itinerary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROPOSAL ITEMS
create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade,
  kind text not null check (kind in ('hotel', 'flight', 'activity', 'transfer', 'insurance', 'fee', 'custom', 'itinerary_day')),
  ref_id text,
  title text not null,
  description text,
  qty numeric default 1,
  unit_price numeric default 0,
  total_price numeric default 0,
  currency text default 'INR',
  supplier text,
  meta jsonb default '{}'::jsonb,
  position int default 0,
  created_at timestamptz default now()
);

-- INVOICES
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  invoice_number text unique not null,
  client_name text not null,
  client_email text,
  client_phone text,
  destination text,
  status text default 'Sent' check (status in ('Draft', 'Sent', 'Partially Paid', 'Paid', 'Cancelled', 'Refunded')),
  issue_date date default CURRENT_DATE,
  due_date date default (CURRENT_DATE + interval '10 days'),
  currency text default 'INR',
  subtotal numeric default 0,
  tax_rate numeric default 5.0,
  tax_amount numeric default 0,
  total_amount numeric default 0,
  paid_amount numeric default 0,
  remaining_balance numeric default 0,
  parent_invoice_id uuid references public.invoices(id) on delete set null,
  items jsonb default '[]'::jsonb,
  notes text,
  terms text,
  upi_id text,
  upi_payee_name text,
  branding jsonb,
  activity_log jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- INVENTORY LIBRARIES
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  location text,
  star_rating numeric,
  room_types jsonb,
  amenities text[],
  description text,
  image_url text,
  supplier text,
  raw jsonb,
  created_at timestamptz default now()
);

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

-- ITINERARIES & BLOCKS
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

-- IMPORTS & MAPPINGS
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

create table if not exists public.field_mappings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  resource text not null,
  name text default 'default',
  mapping jsonb not null,
  created_at timestamptz default now(),
  unique (agency_id, resource, name)
);

-- ANALYTICS, LOGS & NOTIFICATIONS
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  user_id uuid,
  proposal_id uuid references public.proposals(id) on delete set null,
  event_type text not null check (event_type in ('download','whatsapp','email','approval','modification')),
  destination text,
  client_name text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  user_id uuid,
  action text not null,
  details jsonb,
  entity_type text,
  entity_id text,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  user_id uuid,
  icon text default 'notifications',
  title text not null,
  description text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ENABLE ROW LEVEL SECURITY
alter table public.agencies enable row level security;
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.team_invitations enable row level security;
alter table public.clients enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.invoices enable row level security;
alter table public.hotels enable row level security;
alter table public.flights enable row level security;
alter table public.activities enable row level security;
alter table public.templates enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_blocks enable row level security;
alter table public.imports enable row level security;
alter table public.field_mappings enable row level security;
alter table public.analytics_events enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

-- RLS POLICIES
create policy "users_agency_select" on public.agencies for select using (id = public.current_agency_id());
create policy "users_agency_update" on public.agencies for update using (id = public.current_agency_id());
create policy "users_read" on public.users for select using (agency_id = public.current_agency_id() or id = auth.uid());
create policy "users_update" on public.users for update using (id = auth.uid());
create policy "clients_agency" on public.clients for all using (agency_id = public.current_agency_id());
create policy "subscriptions_agency" on public.subscriptions for all using (agency_id = public.current_agency_id());
create policy "team_invitations_agency" on public.team_invitations for all using (agency_id = public.current_agency_id());
create policy "proposals_agency" on public.proposals for all using (agency_id = public.current_agency_id());
create policy "proposal_items_agency" on public.proposal_items for all using (proposal_id in (select id from public.proposals where agency_id = public.current_agency_id()));
create policy "invoices_agency" on public.invoices for all using (agency_id = public.current_agency_id());
create policy "hotels_agency" on public.hotels for all using (agency_id = public.current_agency_id());
create policy "flights_agency" on public.flights for all using (agency_id = public.current_agency_id());
create policy "activities_agency" on public.activities for all using (agency_id = public.current_agency_id());
create policy "templates_agency" on public.templates for all using (agency_id = public.current_agency_id());
create policy "itineraries_agency" on public.itineraries for all using (agency_id = public.current_agency_id());
create policy "itinerary_blocks_agency" on public.itinerary_blocks for all using (agency_id = public.current_agency_id());
create policy "imports_agency" on public.imports for all using (agency_id = public.current_agency_id());
create policy "field_mappings_agency" on public.field_mappings for all using (agency_id = public.current_agency_id());
create policy "analytics_events_agency" on public.analytics_events for all using (agency_id = public.current_agency_id());
create policy "activity_logs_agency" on public.activity_logs for all using (agency_id = public.current_agency_id());
create policy "notifications_agency" on public.notifications for all using (agency_id = public.current_agency_id());

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('agency-assets', 'agency-assets', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('proposal-assets', 'proposal-assets', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('generated-documents', 'generated-documents', true) on conflict (id) do nothing;
