alter table public.note_requests
add column if not exists fulfilled_by_user_id uuid null references public.profiles(id) on delete set null;

alter table public.note_requests
add column if not exists fulfilled_by_note_id uuid null references public.notes(id) on delete set null;

alter table public.note_requests
add column if not exists fulfilled_at timestamptz null;

create index if not exists note_requests_fulfilled_note_idx
  on public.note_requests (fulfilled_by_note_id);

create index if not exists note_requests_fulfilled_user_idx
  on public.note_requests (fulfilled_by_user_id, fulfilled_at desc);

create or replace function public.fulfill_note_request(target_request_id uuid, target_note_id uuid)
returns public.note_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  requester_scope public.note_requests%rowtype;
  uploader_note public.notes%rowtype;
  current_profile public.profiles%rowtype;
  updated_request public.note_requests%rowtype;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = current_user_id;

  if current_profile.id is null then
    raise exception 'Profile required';
  end if;

  select *
  into requester_scope
  from public.note_requests
  where id = target_request_id;

  if requester_scope.id is null then
    raise exception 'Request not found';
  end if;

  if requester_scope.status <> 'open' then
    raise exception 'Only open requests can be fulfilled';
  end if;

  if requester_scope.school_id <> current_profile.school_id
    or requester_scope.class_id <> current_profile.class_id
    or requester_scope.section_id <> current_profile.section_id then
    raise exception 'Request is outside your scope';
  end if;

  select *
  into uploader_note
  from public.notes
  where id = target_note_id
    and user_id = current_user_id;

  if uploader_note.id is null then
    raise exception 'Uploaded note not found';
  end if;

  if uploader_note.school_id <> requester_scope.school_id
    or uploader_note.class_id <> requester_scope.class_id
    or uploader_note.section_id <> requester_scope.section_id then
    raise exception 'Uploaded note does not match request scope';
  end if;

  update public.note_requests
  set
    status = 'fulfilled',
    fulfilled_by_user_id = current_user_id,
    fulfilled_by_note_id = target_note_id,
    fulfilled_at = now()
  where id = target_request_id
    and status = 'open'
  returning *
  into updated_request;

  if updated_request.id is null then
    raise exception 'Unable to fulfill request';
  end if;

  return updated_request;
end;
$$;

revoke all on function public.fulfill_note_request(uuid, uuid) from public;
grant execute on function public.fulfill_note_request(uuid, uuid) to authenticated;
