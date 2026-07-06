-- Complete and secure the eV&V persistence model used by the frontend.

alter table public.evv_submissions
  add column if not exists review_status text,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists signature_data text,
  add column if not exists signed_at timestamptz;

alter table public.evv_submissions
  drop constraint if exists evv_submissions_status_check,
  add constraint evv_submissions_status_check
    check (status in ('draft', 'completed', 'not_synced')),
  drop constraint if exists evv_submissions_review_status_check,
  add constraint evv_submissions_review_status_check
    check (review_status is null or review_status in ('pending', 'approved', 'rejected')),
  drop constraint if exists evv_review_consistency_check,
  add constraint evv_review_consistency_check check (
    (review_status is null and reviewed_by is null and reviewed_at is null)
    or
    (review_status = 'pending' and reviewed_by is null and reviewed_at is null)
    or
    (review_status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  ),
  drop constraint if exists evv_rejection_notes_check,
  add constraint evv_rejection_notes_check check (
    review_status <> 'rejected'
    or length(trim(coalesce(review_notes, ''))) >= 5
  );

update public.evv_submissions
set review_status = 'pending'
where status = 'completed' and review_status is null;

create unique index if not exists evv_submissions_client_id_key
  on public.evv_submissions(client_id);
create index if not exists evv_submissions_org_updated_idx
  on public.evv_submissions(organization_id, updated_at desc);
create index if not exists evv_submissions_user_updated_idx
  on public.evv_submissions(user_id, updated_at desc);
create index if not exists evv_submissions_review_idx
  on public.evv_submissions(organization_id, review_status, submitted_at desc);

create table if not exists public.evv_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evv_submissions(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  file_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists evv_attachments_submission_idx
  on public.evv_attachments(submission_id, created_at);

alter table public.evv_submissions enable row level security;
alter table public.evv_attachments enable row level security;

grant select, insert, update, delete on public.evv_submissions to authenticated;
grant select, insert, delete on public.evv_attachments to authenticated;
revoke all on public.evv_submissions from anon;
revoke all on public.evv_attachments from anon;

create or replace function private.can_review_evv(
  p_user_id uuid,
  p_organization_id uuid,
  p_scope jsonb
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_platform_owner(p_user_id)
    or (
      public.user_belongs_to_organization(p_user_id, p_organization_id)
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p_user_id
          and ur.role in ('admin', 'admin_master', 'supervisor')
      )
      and not exists (
        select 1
        from jsonb_array_elements_text(coalesce(p_scope -> 'vessel_ids', '[]'::jsonb)) vessel(value)
        where not public.user_has_ship_access(p_user_id, vessel.value::uuid)
      )
    );
$$;

revoke all on function private.can_review_evv(uuid, uuid, jsonb) from public, anon, authenticated;

drop policy if exists evv_delete_own on public.evv_submissions;
drop policy if exists evv_insert_own on public.evv_submissions;
drop policy if exists evv_select_own_org on public.evv_submissions;
drop policy if exists evv_update_own on public.evv_submissions;

create policy evv_select_authorized
on public.evv_submissions for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.can_review_evv((select auth.uid()), organization_id, scope)
);

create policy evv_insert_own
on public.evv_submissions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.user_belongs_to_organization((select auth.uid()), organization_id)
  and not exists (
    select 1
    from jsonb_array_elements_text(coalesce(scope -> 'vessel_ids', '[]'::jsonb)) vessel(value)
    where not public.user_has_ship_access((select auth.uid()), vessel.value::uuid)
  )
);

create policy evv_update_authorized
on public.evv_submissions for update
to authenticated
using (
  (
    (select auth.uid()) = user_id
    and coalesce(review_status, 'pending') in ('pending', 'rejected')
  )
  or private.can_review_evv((select auth.uid()), organization_id, scope)
)
with check (
  (select auth.uid()) = user_id
  or private.can_review_evv((select auth.uid()), organization_id, scope)
);

create policy evv_delete_authorized
on public.evv_submissions for delete
to authenticated
using (
  (
    (select auth.uid()) = user_id
    and coalesce(review_status, 'pending') in ('pending', 'rejected')
  )
  or (
    private.can_review_evv((select auth.uid()), organization_id, scope)
    and coalesce(review_status, 'pending') <> 'approved'
  )
);

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

drop trigger if exists enforce_evv_update on public.evv_submissions;
create trigger enforce_evv_update
before update on public.evv_submissions
for each row execute function private.enforce_evv_update();

drop policy if exists evv_attachments_select on public.evv_attachments;
drop policy if exists evv_attachments_insert on public.evv_attachments;
drop policy if exists evv_attachments_delete on public.evv_attachments;

create policy evv_attachments_select
on public.evv_attachments for select
to authenticated
using (
  exists (
    select 1 from public.evv_submissions s
    where s.id = submission_id
  )
);

create policy evv_attachments_insert
on public.evv_attachments for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.evv_submissions s
    where s.id = submission_id
      and s.user_id = (select auth.uid())
      and coalesce(s.review_status, 'pending') in ('pending', 'rejected')
  )
);

create policy evv_attachments_delete
on public.evv_attachments for delete
to authenticated
using (
  uploaded_by = (select auth.uid())
  or exists (
    select 1
    from public.evv_submissions s
    where s.id = submission_id
      and private.can_review_evv((select auth.uid()), s.organization_id, s.scope)
      and coalesce(s.review_status, 'pending') <> 'approved'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evv-attachments',
  'evv-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evv_storage_select on storage.objects;
drop policy if exists evv_storage_insert on storage.objects;
drop policy if exists evv_storage_delete on storage.objects;

create policy evv_storage_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'evv-attachments'
  and exists (
    select 1
    from public.evv_submissions s
    where s.id = ((storage.foldername(name))[1])::uuid
  )
);

create policy evv_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'evv-attachments'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.evv_submissions s
    where s.id = ((storage.foldername(name))[1])::uuid
      and s.user_id = (select auth.uid())
      and coalesce(s.review_status, 'pending') in ('pending', 'rejected')
  )
);

create policy evv_storage_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'evv-attachments'
  and (
    owner_id = (select auth.uid()::text)
    or exists (
      select 1
      from public.evv_submissions s
      where s.id = ((storage.foldername(name))[1])::uuid
        and private.can_review_evv((select auth.uid()), s.organization_id, s.scope)
        and coalesce(s.review_status, 'pending') <> 'approved'
    )
  )
);
