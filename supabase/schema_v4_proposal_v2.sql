-- Voyanta — schema_v4_proposal_v2 (Proposal Builder V2 updates)

-- 1) New Itineraries Architecture
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.itineraries disable row level security;

create table if not exists public.itinerary_blocks (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references public.itineraries(id) on delete cascade,
  block_type text not null check (block_type in ('arrival', 'day', 'departure')),
  day_number int, -- null for arrival/departure
  title text,
  description text,
  morning_notes text,
  afternoon_notes text,
  evening_notes text,
  night_notes text,
  photos jsonb,
  notes text,
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.itinerary_blocks disable row level security;

-- 2) Update existing tables with new fields
alter table public.hotels add column if not exists cover_image text;
alter table public.hotels add column if not exists gallery_images jsonb;

alter table public.proposals add column if not exists is_archived boolean default false;
alter table public.proposals add column if not exists arrival_city text;
alter table public.proposals add column if not exists arrival_airport text;
alter table public.proposals add column if not exists departure_city text;
alter table public.proposals add column if not exists departure_airport text;

-- 3) Ensure triggers exist for updated_at
drop trigger if exists itineraries_touch on public.itineraries;
create trigger itineraries_touch
  before update on public.itineraries
  for each row execute function public.touch_updated_at();

drop trigger if exists itinerary_blocks_touch on public.itinerary_blocks;
create trigger itinerary_blocks_touch
  before update on public.itinerary_blocks
  for each row execute function public.touch_updated_at();
