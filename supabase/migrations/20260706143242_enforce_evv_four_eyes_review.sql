create or replace function private.enforce_evv_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_reviewer boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if new.user_id <> old.user_id
     or new.organization_id <> old.organization_id
     or new.client_id <> old.client_id then
    raise exception 'Immutable eV&V ownership fields cannot be changed';
  end if;

  v_is_reviewer := private.can_review_evv(v_uid, old.organization_id, old.scope);

  if old.review_status = 'approved' and not public.is_platform_owner(v_uid) then
    raise exception 'Approved eV&V submissions are immutable';
  end if;

  if new.review_status is distinct from old.review_status
     or new.review_notes is distinct from old.review_notes
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    if not v_is_reviewer then
      raise exception 'Only an authorized reviewer can review eV&V submissions';
    end if;
    if v_uid = old.user_id and not public.is_platform_owner(v_uid) then
      raise exception 'Reviewers cannot approve or reject their own eV&V submissions';
    end if;
    if new.review_status in ('approved', 'rejected') then
      new.reviewed_by := v_uid;
      new.reviewed_at := now();
    end if;
  end if;

  if new.signature_data is distinct from old.signature_data
     or new.signed_at is distinct from old.signed_at then
    if v_uid <> old.user_id then
      raise exception 'Only the submission owner can sign it';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_evv_update() from public, anon, authenticated;
