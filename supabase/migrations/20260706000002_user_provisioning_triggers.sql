-- VOYANTA USER PROVISIONING TRIGGERS (MIGRATION 2)
-- Automatically provisions agency, subscription, and user rows upon auth sign-up

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite_record record;
  v_new_agency_id uuid;
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- Check if there is a pending team invitation for this email
  select * into v_invite_record
  from public.team_invitations
  where email = new.email and status = 'pending'
  limit 1;

  if found then
    -- Link user to the inviting agency with the invited role
    insert into public.users (id, agency_id, email, full_name, role)
    values (new.id, v_invite_record.agency_id, new.email, v_full_name, coalesce(v_invite_record.role, 'agent'))
    on conflict (id) do update
    set agency_id = excluded.agency_id,
        role = excluded.role,
        full_name = excluded.full_name;

    -- Mark invitation as accepted
    update public.team_invitations
    set status = 'accepted'
    where id = v_invite_record.id;
  else
    -- Create a new agency for this user with idempotent fallback
    insert into public.agencies (name, slug, contact_email)
    values (
      v_full_name || '''s Agency',
      lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 8),
      new.email
    )
    returning id into v_new_agency_id;

    -- Create default Enterprise subscription
    insert into public.subscriptions (agency_id, plan, status)
    values (v_new_agency_id, 'Enterprise', 'active')
    on conflict do nothing;

    -- Create user row as owner
    insert into public.users (id, agency_id, email, full_name, role)
    values (new.id, v_new_agency_id, new.email, v_full_name, 'owner')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Bind trigger to auth.users
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'drop trigger if exists on_auth_user_created on auth.users;';
    execute 'create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();';
  end if;
end
$$;
