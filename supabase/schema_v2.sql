-- Voyanta — schema_v2 (MVP additions for the import engine + proposal assembly).
-- Run AFTER schema.sql (or run as-is if you've already deployed schema.sql).

-- 1) DISABLE RLS for early-development friendliness.
--    Anon key reads/writes through. Re-enable + add policies before going live.
alter table public.agencies   disable row level security;
alter table public.users      disable row level security;
alter table public.clients    disable row level security;
alter table public.proposals  disable row level security;
alter table public.hotels     disable row level security;
alter table public.flights    disable row level security;
alter table public.activities disable row level security;
alter table public.templates  disable row level security;

-- 2) Allow arbitrary supplier columns to be preserved on every imported record.
alter table public.hotels      add column if not exists raw jsonb;
alter table public.flights     add column if not exists raw jsonb;
alter table public.activities  add column if not exists raw jsonb;
alter table public.templates   add column if not exists raw jsonb;

-- A few useful per-resource fields not in v1
alter table public.hotels      add column if not exists supplier text;
alter table public.flights     add column if not exists depart_date date;
alter table public.flights     add column if not exists supplier text;
alter table public.activities  add column if not exists supplier text;

-- 3) IMPORTS: raw uploaded files + parse status -----------------------------
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  resource text not null check (resource in ('hotels','flights','activities','templates')),
  filename text,
  file_format text check (file_format in ('xlsx','csv','pdf')),
  status text default 'parsed' check (status in ('parsed','mapped','imported','failed')),
  source_columns text[],
  raw_rows jsonb,
  mapping jsonb,                 -- { source_col: target_field, ... }
  imported_count int default 0,
  created_by uuid,
  created_at timestamptz default now()
);
alter table public.imports disable row level security;

-- 4) FIELD MAPPINGS: saved per-agency, per-resource so future imports prefill
create table if not exists public.field_mappings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  resource text not null,
  name text default 'default',
  mapping jsonb not null,
  created_at timestamptz default now(),
  unique (agency_id, resource, name)
);
alter table public.field_mappings disable row level security;

-- 5) PROPOSAL ITEMS: junction joining a proposal to selected hotels/flights/activities/lines
create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade,
  kind text not null check (kind in ('hotel','flight','activity','transfer','visa','tax','margin','custom')),
  ref_id uuid,                   -- points at hotels/flights/activities row when applicable
  label text not null,
  qty numeric default 1,
  unit_price numeric default 0,
  currency text default 'USD',
  meta jsonb,
  position int default 0,
  created_at timestamptz default now()
);
create index if not exists proposal_items_proposal_idx on public.proposal_items (proposal_id);
alter table public.proposal_items disable row level security;

-- 6) 2 SAMPLES per resource (testing only — agencies will upload their own) -
insert into public.hotels (id, agency_id, name, location, country, category, rating, price_per_night, currency, supplier)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Hotel A','Paris','France','Boutique',4.6,420,'USD','sample'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Hotel B','Tokyo','Japan','Luxury',4.9,890,'USD','sample')
on conflict do nothing;

insert into public.flights (id, agency_id, airline, class, origin, destination, depart_date, flight_no, cost, currency, supplier)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Air Sample','Business','JFK','CDG','2026-03-12','AS101',2150,'USD','sample'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Test Air','Economy','LHR','HND','2026-04-08','TA220', 980,'USD','sample')
on conflict do nothing;

insert into public.activities (id, agency_id, name, type, location, duration_hours, price, currency, description, supplier)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Walking Tour','tour','Paris',2,75,'USD','Sample activity for testing','sample'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Boat Excursion','excursion','Capri',4,180,'USD','Sample activity for testing','sample')
on conflict do nothing;

insert into public.templates (id, agency_id, name, category, days, destination, price_from, currency, data)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Honeymoon Template','Romantic',7,'Bali',4500,'USD','{"days":[]}'::jsonb),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','Sample Family Template','Family',10,'Tokyo',8200,'USD','{"days":[]}'::jsonb)
on conflict do nothing;
