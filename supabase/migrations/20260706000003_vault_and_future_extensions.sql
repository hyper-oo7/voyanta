-- VOYANTA VAULT & STORAGE EXTENSIONS (MIGRATION 3)
-- Scaffolding for 'My Vault' document management and enterprise storage assets

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  title text not null,
  category text default 'Document' check (category in ('Document', 'Contract', 'Brochure', 'Template', 'ID_Proof', 'Other')),
  file_url text not null,
  file_name text,
  file_size_bytes bigint default 0,
  mime_type text,
  tags text[],
  is_confidential boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.vault_items enable row level security;

-- Agency-scoped RLS policies for vault
create policy "vault_items_agency_select" on public.vault_items
  for select using (agency_id = public.current_agency_id());

create policy "vault_items_agency_insert" on public.vault_items
  for insert with check (agency_id = public.current_agency_id());

create policy "vault_items_agency_update" on public.vault_items
  for update using (agency_id = public.current_agency_id());

create policy "vault_items_agency_delete" on public.vault_items
  for delete using (agency_id = public.current_agency_id());

-- Vault storage bucket
insert into storage.buckets (id, name, public) values ('vault-documents', 'vault-documents', false) on conflict (id) do nothing;

create policy "Auth users read vault docs" on storage.objects
  for select using (bucket_id = 'vault-documents' and auth.uid() is not null);

create policy "Auth users upload vault docs" on storage.objects
  for insert with check (bucket_id = 'vault-documents' and auth.uid() is not null);
