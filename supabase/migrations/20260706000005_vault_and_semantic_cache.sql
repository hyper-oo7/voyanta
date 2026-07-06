-- Migration: Semantic Cache and 15-Day Supplier PDFs Vault

create table if not exists public.semantic_cache (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  hash text unique not null,
  destination text,
  budget numeric,
  parsed_json jsonb not null,
  created_at timestamptz default now()
);

create index if not exists semantic_cache_hash_idx on public.semantic_cache (hash);
create index if not exists semantic_cache_destination_idx on public.semantic_cache (destination);
create index if not exists semantic_cache_agency_idx on public.semantic_cache (agency_id);

create table if not exists public.supplier_pdfs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  filename text not null,
  file_path text not null,
  size_bytes bigint default 0,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  status text default 'active'
);

create index if not exists supplier_pdfs_expires_at_idx on public.supplier_pdfs (expires_at);

alter table public.semantic_cache enable row level security;
alter table public.supplier_pdfs enable row level security;

drop policy if exists "semantic_cache_read_all" on public.semantic_cache;
drop policy if exists "semantic_cache_agency" on public.semantic_cache;
create policy "semantic_cache_agency" on public.semantic_cache for all using (agency_id = public.current_agency_id() or agency_id is null);

drop policy if exists "supplier_pdfs_agency" on public.supplier_pdfs;
create policy "supplier_pdfs_agency" on public.supplier_pdfs for all using (agency_id = public.current_agency_id() or agency_id is null);

