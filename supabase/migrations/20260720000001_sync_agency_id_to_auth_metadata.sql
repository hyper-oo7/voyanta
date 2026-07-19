-- Migration: 20260720000001_sync_agency_id_to_auth_metadata.sql
-- Purpose: Sync agency_id to auth.users raw metadata for JWT inclusion

-- 1. Re-define public.handle_new_user() trigger to update auth.users raw metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_invite_record record;
  v_new_agency_id uuid;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- Check if there is a pending team invitation for this email
  SELECT * INTO v_invite_record
  FROM public.team_invitations
  WHERE email = new.email AND status = 'pending'
  LIMIT 1;

  IF found THEN
    -- Link user to the inviting agency with the invited role
    INSERT INTO public.users (id, agency_id, email, full_name, role)
    VALUES (new.id, v_invite_record.agency_id, new.email, v_full_name, COALESCE(v_invite_record.role, 'agent'))
    ON CONFLICT (id) DO UPDATE
    SET agency_id = excluded.agency_id,
        role = excluded.role,
        full_name = excluded.full_name;

    -- Update auth.users metadata with agency_id
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('agency_id', v_invite_record.agency_id),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('agency_id', v_invite_record.agency_id)
    WHERE id = new.id;

    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET status = 'accepted'
    WHERE id = v_invite_record.id;
  ELSE
    -- Create a new agency for this user with idempotent fallback
    INSERT INTO public.agencies (name, slug, contact_email)
    VALUES (
      v_full_name || '''s Agency',
      lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 8),
      new.email
    )
    RETURNING id INTO v_new_agency_id;

    -- Create default Enterprise subscription
    INSERT INTO public.subscriptions (agency_id, plan, status)
    VALUES (v_new_agency_id, 'Enterprise', 'active')
    ON CONFLICT DO NOTHING;

    -- Create user row as owner
    INSERT INTO public.users (id, agency_id, email, full_name, role)
    VALUES (new.id, v_new_agency_id, new.email, v_full_name, 'owner')
    ON CONFLICT (id) DO NOTHING;

    -- Update auth.users metadata with agency_id
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('agency_id', v_new_agency_id),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('agency_id', v_new_agency_id)
    WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update existing auth.users rows to match public.users agency_id
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('agency_id', r.agency_id),
    raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('agency_id', r.agency_id)
FROM public.users r
WHERE u.id = r.id AND r.agency_id IS NOT NULL;
