-- Run these in the Supabase SQL editor (or dashboard).
-- All statements are safe to re-run (IF NOT EXISTS / on conflict do nothing).

-- 1) Add font_family + extended contact columns to agencies if missing
alter table public.agencies add column if not exists font_family text;
alter table public.agencies add column if not exists address text;
alter table public.agencies add column if not exists contact_email text;
alter table public.agencies add column if not exists contact_phone text;
alter table public.agencies add column if not exists website text;
alter table public.agencies add column if not exists social_links jsonb default '{}'::jsonb;
alter table public.agencies add column if not exists primary_color text;

-- 2) Public bucket for branding assets (logos, cover images).
--    Run from the dashboard → Storage → Create bucket, OR via SQL:
insert into storage.buckets (id, name, public)
  values ('agency-assets', 'agency-assets', true)
  on conflict (id) do nothing;

-- 3) Permissive policies for MVP (RLS off / public read & insert).
--    Tighten before going live (e.g. require auth.role() = 'authenticated' on insert).
create policy "Public read agency assets"
  on storage.objects for select
  using (bucket_id = 'agency-assets');

create policy "Anyone can upload agency assets"
  on storage.objects for insert
  with check (bucket_id = 'agency-assets');

create policy "Anyone can update agency assets"
  on storage.objects for update
  using (bucket_id = 'agency-assets');
