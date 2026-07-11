-- Migration to add preferences column to public.clients
alter table public.clients add column if not exists preferences jsonb default '{}'::jsonb;
