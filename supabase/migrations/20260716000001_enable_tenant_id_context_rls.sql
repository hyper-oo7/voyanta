-- Migration: 20260716000001_enable_tenant_id_context_rls.sql
-- Enables RLS on proposals, clients, and itinerary_items (safely)
-- Updates current_agency_id() to read tenant_id from Postgres session context headers.

-- 1. Redefine current_agency_id() to support Postgres session context (headers and jwt claims)
create or replace function public.current_agency_id()
returns uuid as $$
declare
  v_headers text;
  v_jwt_claims text;
  v_agency_id text;
begin
  -- 1.1 Try reading request.headers JSON (modern PostgREST)
  begin
    v_headers := current_setting('request.headers', true);
    if v_headers is not null and v_headers <> '' then
      v_agency_id := v_headers::json->>'x-tenant-id';
      if v_agency_id is not null and v_agency_id <> '' then
        return v_agency_id::uuid;
      end if;
    end if;
  exception when others then
  end;

  -- 1.2 Try reading request.header.x-tenant-id (legacy PostgREST / Supabase GUC)
  begin
    v_agency_id := current_setting('request.header.x-tenant-id', true);
    if v_agency_id is not null and v_agency_id <> '' then
      return v_agency_id::uuid;
    end if;
  exception when others then
  end;

  -- 1.3 Try reading request.jwt.claims JSON (modern claims)
  begin
    v_jwt_claims := current_setting('request.jwt.claims', true);
    if v_jwt_claims is not null and v_jwt_claims <> '' then
      v_agency_id := v_jwt_claims::json->>'agency_id';
      if v_agency_id is null or v_agency_id = '' then
        v_agency_id := v_jwt_claims::json->>'tenant_id';
      end if;
      if v_agency_id is not null and v_agency_id <> '' then
        return v_agency_id::uuid;
      end if;
    end if;
  exception when others then
  end;

  -- 1.4 Try reading legacy claim GUCs
  begin
    v_agency_id := current_setting('request.jwt.claim.agency_id', true);
    if v_agency_id is not null and v_agency_id <> '' then
      return v_agency_id::uuid;
    end if;
  exception when others then
  end;

  begin
    v_agency_id := current_setting('request.jwt.claim.tenant_id', true);
    if v_agency_id is not null and v_agency_id <> '' then
      return v_agency_id::uuid;
    end if;
  exception when others then
  end;

  -- 1.5 Fall back to querying the public.users table by auth.uid()
  if auth.uid() is not null then
    select agency_id into v_agency_id
    from public.users
    where id = auth.uid()
    limit 1;
    
    if v_agency_id is not null then
      return v_agency_id::uuid;
    end if;
  end if;

  return null;
end;
$$ language plpgsql stable security definer;

-- 2. Enable RLS and define policies for proposals
alter table if exists public.proposals enable row level security;
drop policy if exists "proposals_agency" on public.proposals;
create policy "proposals_agency" on public.proposals
  for all
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());

-- 3. Enable RLS and define policies for clients
alter table if exists public.clients enable row level security;
drop policy if exists "clients_agency" on public.clients;
create policy "clients_agency" on public.clients
  for all
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());

-- 4. Enable RLS and define policies for proposal_items
alter table if exists public.proposal_items enable row level security;
drop policy if exists "proposal_items_agency" on public.proposal_items;
create policy "proposal_items_agency" on public.proposal_items
  for all
  using (proposal_id in (
    select id from public.proposals where agency_id = public.current_agency_id()
  ))
  with check (proposal_id in (
    select id from public.proposals where agency_id = public.current_agency_id()
  ));

-- 5. Enable RLS and define policies for itinerary_items (safely in block)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'itinerary_items') then
    -- Enable RLS
    execute 'alter table public.itinerary_items enable row level security;';
    -- Drop policy
    execute 'drop policy if exists "itinerary_items_agency" on public.itinerary_items;';
    -- Create policy
    execute 'create policy "itinerary_items_agency" on public.itinerary_items for all using (agency_id = public.current_agency_id()) with check (agency_id = public.current_agency_id());';
  end if;
end
$$;
