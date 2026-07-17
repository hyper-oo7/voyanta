-- VOYANTA MIGRATION: FIX INVOICES AND TENANT RLS CONTEXT
-- Ensures public.current_agency_id() safely extracts active tenant ID from headers/JWT/user table
-- and secures invoices table without throwing RLS violations.

create or replace function public.current_agency_id()
returns uuid as $$
declare
  v_headers jsonb;
  v_header_tenant text;
  v_jwt_tenant text;
  v_user_agency uuid;
begin
  -- 1. Try extracting x-tenant-id from request headers
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    if v_headers is not null and v_headers ? 'x-tenant-id' then
      v_header_tenant := v_headers->>'x-tenant-id';
      if v_header_tenant is not null and v_header_tenant <> '' and v_header_tenant <> 'null' and v_header_tenant <> 'undefined' then
        return v_header_tenant::uuid;
      end if;
    end if;
  exception
    when others then
      -- ignore invalid json or cast errors
  end;

  -- 2. Try extracting from JWT claims (agency_id or tenant_id)
  begin
    v_jwt_tenant := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'agency_id';
    if v_jwt_tenant is null or v_jwt_tenant = '' or v_jwt_tenant = 'null' then
      v_jwt_tenant := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'tenant_id';
    end if;
    if v_jwt_tenant is not null and v_jwt_tenant <> '' and v_jwt_tenant <> 'null' and v_jwt_tenant <> 'undefined' then
      return v_jwt_tenant::uuid;
    end if;
  exception
    when others then
      -- ignore
  end;

  -- 3. Fallback to auth.uid() query on public.users table
  if auth.uid() is not null then
    begin
      select agency_id into v_user_agency from public.users where id = auth.uid() limit 1;
      if v_user_agency is not null then
        return v_user_agency;
      end if;
    exception
      when others then
        -- ignore
    end;
  end if;

  return null;
end;
$$ language plpgsql stable security definer;

-- Secure public.invoices with robust RLS check against current_agency_id or direct user agency
alter table if exists public.invoices enable row level security;
drop policy if exists "invoices_agency" on public.invoices;
create policy "invoices_agency" on public.invoices
  for all
  using (
    agency_id = public.current_agency_id()
    or (auth.uid() is not null and agency_id = (select u.agency_id from public.users u where u.id = auth.uid() limit 1))
  )
  with check (
    agency_id = public.current_agency_id()
    or (auth.uid() is not null and agency_id = (select u.agency_id from public.users u where u.id = auth.uid() limit 1))
  );
