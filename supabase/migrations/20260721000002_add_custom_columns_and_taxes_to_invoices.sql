-- Migration: Add custom_columns and taxes jsonb columns to public.invoices if not exist
alter table if exists public.invoices 
  add column if not exists custom_columns jsonb default '[]'::jsonb,
  add column if not exists taxes jsonb default '[]'::jsonb;
