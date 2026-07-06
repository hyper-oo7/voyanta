-- Migration: Create Invoices Table and RLS Policies
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

alter table public.invoices enable row level security;

drop policy if exists "invoices_agency" on public.invoices;
create policy "invoices_agency" on public.invoices for all using (agency_id = public.current_agency_id());
