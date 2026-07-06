-- Voyanta — Master Supabase Schema
-- Consolidates v1–v6 into a single multi-tenant deployment script.
-- All RLS is agency-scoped (Enterprise plan only — all agents in an agency see everything).

create extension if not exists "pgcrypto";

-- Grant schema usage to standard roles to prevent "permission denied for schema public"
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on all tables in schema public to postgres, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

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
  plan text default 'Enterprise' check (plan in ('Enterprise')),
  status text default 'active',
  created_at timestamptz default now()
);

-- TEAM INVITATIONS ------------------------------------------------------------
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  email text not null,
  role text default 'agent',
  invited_by uuid,
  status text default 'pending',
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
  select (select agency_id from public.users where id = auth.uid());
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
create index if not exists proposals_created_by_idx on public.proposals (created_by);

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

-- ANALYTICS EVENTS (v6) — Replaces localStorage analytics --------------------
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
create index if not exists analytics_events_agency_idx on public.analytics_events (agency_id, created_at desc);
create index if not exists analytics_events_type_idx on public.analytics_events (agency_id, event_type);
create index if not exists analytics_events_dest_idx on public.analytics_events (agency_id, destination);

-- ACTIVITY LOGS v2 (v6) — Replaces localStorage activity logs ----------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  user_id uuid,
  action text not null,
  details jsonb,
  entity_type text,
  entity_id uuid,
  created_at timestamptz default now()
);
create index if not exists activity_logs_agency_idx on public.activity_logs (agency_id, created_at desc);

-- NOTIFICATIONS (v6) — Replaces localStorage notifications -------------------
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
create index if not exists notifications_agency_idx on public.notifications (agency_id, is_read, created_at desc);

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

-- Automated User Provisioning Trigger -----------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite_record record;
  v_new_agency_id uuid;
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- Check if there is a pending team invitation for this email
  select * into v_invite_record
  from public.team_invitations
  where email = new.email and status = 'pending'
  limit 1;

  if found then
    -- Link user to the inviting agency with the invited role
    insert into public.users (id, agency_id, email, full_name, role)
    values (new.id, v_invite_record.agency_id, new.email, v_full_name, coalesce(v_invite_record.role, 'agent'))
    on conflict (id) do update
    set agency_id = excluded.agency_id,
        role = excluded.role,
        full_name = excluded.full_name;

    -- Mark invitation as accepted
    update public.team_invitations
    set status = 'accepted'
    where id = v_invite_record.id;
  else
    -- Create a new agency for this user
    insert into public.agencies (name, slug, contact_email)
    values (
      v_full_name || '''s Agency',
      lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 8),
      new.email
    )
    returning id into v_new_agency_id;

    -- Create default Enterprise subscription
    insert into public.subscriptions (agency_id, plan, status)
    values (v_new_agency_id, 'Enterprise', 'active')
    on conflict do nothing;

    -- Create user row as owner
    insert into public.users (id, agency_id, email, full_name, role)
    values (new.id, v_new_agency_id, new.email, v_full_name, 'owner')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'drop trigger if exists on_auth_user_created on auth.users;';
    execute 'create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();';
  end if;
end
$$;

-- RLS & POLICIES (Agency-Level — Enterprise Only) ----------------------------

-- Enable RLS on all tables
alter table public.agencies enable row level security;
alter table public.subscriptions enable row level security;
alter table public.team_invitations enable row level security;
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
alter table public.analytics_events enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

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

-- Subscriptions & Team Invitations policies
drop policy if exists "subscriptions_agency" on public.subscriptions;
create policy "subscriptions_agency" on public.subscriptions for all using (agency_id = public.current_agency_id());

drop policy if exists "team_invitations_agency" on public.team_invitations;
create policy "team_invitations_agency" on public.team_invitations for all using (agency_id = public.current_agency_id());

-- Proposals policy (Agency-level: all agents see all proposals in their agency)
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

-- Analytics, Activity Logs, Notifications policies
drop policy if exists "analytics_events_agency" on public.analytics_events;
create policy "analytics_events_agency" on public.analytics_events for all using (agency_id = public.current_agency_id());

drop policy if exists "activity_logs_agency" on public.activity_logs;
create policy "activity_logs_agency" on public.activity_logs for all using (agency_id = public.current_agency_id());

drop policy if exists "notifications_agency" on public.notifications;
create policy "notifications_agency" on public.notifications for all using (agency_id = public.current_agency_id());

-- STORAGE BUCKET (v3) ---------------------------------------------------------
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
create index if not exists proposals_agency_archived_created_idx on public.proposals (agency_id, is_archived, created_at desc);
create index if not exists proposal_items_proposal_position_idx on public.proposal_items (proposal_id, position asc);

-- HIGH PERFORMANCE RPC FOR DASHBOARD ANALYTICS --------------------------------
create or replace function public.get_dashboard_summary(p_agency_id uuid)
returns jsonb as $$
declare
  v_total_proposals int;
  v_total_templates int;
  v_active_clients int;
  v_total_downloads int;
  v_total_shares int;
  v_total_approvals int;
  v_total_modifications int;
begin
  select count(*) into v_total_proposals 
  from public.proposals where agency_id = p_agency_id and coalesce(is_archived, false) = false;

  select count(*) into v_total_templates 
  from public.templates where agency_id = p_agency_id;

  select count(distinct client_name) into v_active_clients 
  from public.proposals where agency_id = p_agency_id and client_name is not null and client_name != '';

  select coalesce(count(*), 0) into v_total_downloads
  from public.analytics_events where agency_id = p_agency_id and event_type = 'download';

  select coalesce(count(*), 0) into v_total_shares
  from public.analytics_events where agency_id = p_agency_id and event_type in ('whatsapp', 'email');

  select coalesce(count(*), 0) into v_total_approvals
  from public.analytics_events where agency_id = p_agency_id and event_type = 'approval';

  select coalesce(count(*), 0) into v_total_modifications
  from public.analytics_events where agency_id = p_agency_id and event_type = 'modification';

  return jsonb_build_object(
    'totalProposals', v_total_proposals,
    'totalTemplates', v_total_templates,
    'activeClients', v_active_clients,
    'totalDownloads', v_total_downloads,
    'totalShares', v_total_shares,
    'totalApprovals', v_total_approvals,
    'totalModifications', v_total_modifications
  );
end;
$$ language plpgsql stable security definer;

-- RPC: Destination analytics breakdown
create or replace function public.get_destination_analytics(p_agency_id uuid)
returns jsonb as $$
begin
  return (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    from (
      select
        destination as name,
        count(*) filter (where event_type = 'download') as pdf,
        count(*) filter (where event_type = 'whatsapp') as whatsapp,
        count(*) filter (where event_type = 'email') as email,
        count(*) filter (where event_type = 'approval') as approvals,
        count(*) filter (where event_type = 'modification') as modifications,
        count(*) as "totalGenerated"
      from public.analytics_events
      where agency_id = p_agency_id and destination is not null and destination != ''
      group by destination
      order by count(*) desc
      limit 50
    ) t
  );
end;
$$ language plpgsql stable security definer;

-- SEED DATA -------------------------------------------------------------------
-- Demo agency acts as default agency for local dev/testing
insert into public.agencies (id, name, slug) values ('00000000-0000-0000-0000-000000000001', 'Voyanta Demo Agency', 'voyanta-demo') on conflict do nothing;
