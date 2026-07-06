-- Migration 000006: Production Security Hardening
-- 1. Switch proposal/document storage buckets to private and enforce authenticated RLS
-- 2. Scope semantic_cache table RLS policy to the current agency

-- 1. STORAGE BUCKETS HARDENING
update storage.buckets set public = false where id in ('proposal-assets', 'generated-documents');
insert into storage.buckets (id, name, public) values ('proposal-assets', 'proposal-assets', false) on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('generated-documents', 'generated-documents', false) on conflict (id) do update set public = false;

drop policy if exists "Authenticated read proposal assets" on storage.objects;
create policy "Authenticated read proposal assets" on storage.objects for select using (bucket_id in ('proposal-assets', 'generated-documents') and auth.uid() is not null);

drop policy if exists "Authenticated upload proposal assets" on storage.objects;
create policy "Authenticated upload proposal assets" on storage.objects for insert with check (bucket_id in ('proposal-assets', 'generated-documents') and auth.uid() is not null);

drop policy if exists "Authenticated update proposal assets" on storage.objects;
create policy "Authenticated update proposal assets" on storage.objects for update using (bucket_id in ('proposal-assets', 'generated-documents') and auth.uid() is not null);

drop policy if exists "Authenticated delete proposal assets" on storage.objects;
create policy "Authenticated delete proposal assets" on storage.objects for delete using (bucket_id in ('proposal-assets', 'generated-documents') and auth.uid() is not null);

-- 2. SEMANTIC CACHE RLS SCOPING
alter table public.semantic_cache add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
create index if not exists semantic_cache_agency_idx on public.semantic_cache (agency_id);

drop policy if exists "semantic_cache_read_all" on public.semantic_cache;
drop policy if exists "semantic_cache_agency" on public.semantic_cache;
create policy "semantic_cache_agency" on public.semantic_cache for all using (agency_id = public.current_agency_id() or agency_id is null);
