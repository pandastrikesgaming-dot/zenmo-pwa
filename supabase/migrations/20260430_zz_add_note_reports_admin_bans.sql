alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz null,
  add column if not exists banned_reason text null;

create table if not exists public.note_reports (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles(id),
  constraint note_reports_status_check check (status in ('pending', 'reviewed', 'dismissed', 'action_taken')),
  constraint note_reports_unique_reporter_note unique (note_id, reporter_id)
);

create index if not exists note_reports_status_created_idx
  on public.note_reports (status, created_at desc);

create index if not exists note_reports_reported_user_idx
  on public.note_reports (reported_user_id, created_at desc);

create index if not exists note_reports_reporter_idx
  on public.note_reports (reporter_id, created_at desc);

alter table public.note_reports enable row level security;

create or replace function public.is_admin_user(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = user_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.is_not_banned(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select not p.is_banned
      from public.profiles p
      where p.id = user_id
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_not_banned(uuid) to authenticated;

drop policy if exists "users can submit their own note reports" on public.note_reports;
drop policy if exists "users can view their own note reports" on public.note_reports;
drop policy if exists "admins can view all note reports" on public.note_reports;
drop policy if exists "admins can update note reports" on public.note_reports;

create policy "users can submit their own note reports"
on public.note_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and public.is_not_banned(auth.uid())
  and exists (
    select 1
    from public.notes n
    where n.id = note_reports.note_id
      and n.user_id = note_reports.reported_user_id
  )
);

create policy "users can view their own note reports"
on public.note_reports
for select
to authenticated
using (reporter_id = auth.uid());

create policy "admins can view all note reports"
on public.note_reports
for select
to authenticated
using (public.is_admin_user(auth.uid()));

create policy "admins can update note reports"
on public.note_reports
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

create or replace function public.prevent_banned_user_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if not public.is_not_banned(auth.uid()) then
    raise exception 'Your account has been restricted due to policy violations.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (
    old.is_admin is distinct from new.is_admin
    or old.is_banned is distinct from new.is_banned
    or old.banned_at is distinct from new.banned_at
    or old.banned_reason is distinct from new.banned_reason
  ) and not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can update moderation fields.';
  end if;

  if auth.uid() = new.id and not public.is_not_banned(auth.uid()) then
    raise exception 'Your account has been restricted due to policy violations.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_banned_notes_write on public.notes;
create trigger prevent_banned_notes_write
before insert on public.notes
for each row execute function public.prevent_banned_user_writes();

drop trigger if exists prevent_banned_messages_write on public.messages;
create trigger prevent_banned_messages_write
before insert on public.messages
for each row execute function public.prevent_banned_user_writes();

drop trigger if exists prevent_banned_note_requests_write on public.note_requests;
create trigger prevent_banned_note_requests_write
before insert on public.note_requests
for each row execute function public.prevent_banned_user_writes();

drop trigger if exists prevent_banned_note_reports_write on public.note_reports;
create trigger prevent_banned_note_reports_write
before insert on public.note_reports
for each row execute function public.prevent_banned_user_writes();

drop trigger if exists protect_profile_moderation_columns on public.profiles;
create trigger protect_profile_moderation_columns
before update on public.profiles
for each row execute function public.protect_profile_moderation_columns();

drop policy if exists "users can create classroom or existing direct messages" on public.messages;

create policy "users can create classroom or existing direct messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.is_not_banned(auth.uid())
  and not public.dm_is_blocked(auth.uid(), messages.receiver_id)
  and exists (
    select 1
    from public.profiles sender_profile
    join public.profiles receiver_profile on receiver_profile.id = messages.receiver_id
    where sender_profile.id = auth.uid()
      and (
        (
          sender_profile.school_id = receiver_profile.school_id
          and sender_profile.class_id = receiver_profile.class_id
          and coalesce(sender_profile.section_id, '') = coalesce(receiver_profile.section_id, '')
        )
        or exists (
          select 1
          from public.messages history
          where (history.sender_id = auth.uid() and history.receiver_id = messages.receiver_id)
             or (history.receiver_id = auth.uid() and history.sender_id = messages.receiver_id)
        )
      )
  )
);

drop policy if exists "owners can create scoped note requests" on public.note_requests;

create policy "owners can create scoped note requests"
on public.note_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_not_banned(auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.school_id = note_requests.school_id
      and p.class_id = note_requests.class_id
      and p.section_id = note_requests.section_id
  )
);

create or replace function public.send_direct_message(target_user_id uuid, message_content text, target_code text default null)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  normalized_code text;
  is_same_scope boolean;
  has_existing_history boolean;
  inserted_message public.messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into sender_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Sender profile not found';
  end if;

  if sender_profile.is_banned then
    raise exception 'Your account has been restricted due to policy violations.';
  end if;

  select * into target_profile from public.profiles where id = target_user_id;
  if not found then
    raise exception 'Recipient not found';
  end if;

  if sender_profile.id = target_profile.id then
    raise exception 'You cannot message yourself';
  end if;

  if public.dm_is_blocked(sender_profile.id, target_profile.id) then
    raise exception 'Message cannot be sent.';
  end if;

  normalized_code := nullif(upper(trim(coalesce(target_code, ''))), '');
  is_same_scope :=
    sender_profile.school_id = target_profile.school_id
    and sender_profile.class_id = target_profile.class_id
    and coalesce(sender_profile.section_id, '') = coalesce(target_profile.section_id, '');

  select exists (
    select 1
    from public.messages history
    where (history.sender_id = sender_profile.id and history.receiver_id = target_profile.id)
       or (history.sender_id = target_profile.id and history.receiver_id = sender_profile.id)
  ) into has_existing_history;

  if not is_same_scope and not has_existing_history and (normalized_code is null or normalized_code <> target_profile.user_code) then
    raise exception 'A valid user code is required to message outside your class';
  end if;

  insert into public.messages (sender_id, receiver_id, content, message_type)
  values (sender_profile.id, target_profile.id, trim(message_content), 'text')
  returning * into inserted_message;

  return inserted_message;
end;
$$;

create or replace function public.admin_get_note_reports()
returns table (
  id uuid,
  note_id uuid,
  reporter_id uuid,
  reported_user_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  note_title text,
  note_subject text,
  note_file_type text,
  note_file_url text,
  note_pages integer,
  note_school_id text,
  note_class_id text,
  note_section_id text,
  note_uploaded_at timestamptz,
  reporter_name text,
  reported_user_name text,
  reported_user_is_banned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    r.id,
    r.note_id,
    r.reporter_id,
    r.reported_user_id,
    r.reason,
    r.details,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.reviewed_by,
    n.title as note_title,
    n.subject as note_subject,
    n.file_type as note_file_type,
    n.file_url as note_file_url,
    n.pages as note_pages,
    n.school_id as note_school_id,
    n.class_id as note_class_id,
    n.section_id as note_section_id,
    n.uploaded_at as note_uploaded_at,
    coalesce(reporter.full_name, reporter.username, 'Zenmo Student') as reporter_name,
    coalesce(reported.full_name, reported.username, n.user_name, 'Zenmo Student') as reported_user_name,
    coalesce(reported.is_banned, false) as reported_user_is_banned
  from public.note_reports r
  join public.notes n on n.id = r.note_id
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles reported on reported.id = r.reported_user_id
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_update_report_status(target_report_id uuid, next_status text)
returns public.note_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_report public.note_reports%rowtype;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  if next_status not in ('pending', 'reviewed', 'dismissed', 'action_taken') then
    raise exception 'Invalid report status';
  end if;

  update public.note_reports
  set status = next_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = target_report_id
  returning * into updated_report;

  if not found then
    raise exception 'Report not found';
  end if;

  return updated_report;
end;
$$;

create or replace function public.admin_set_user_ban(target_user_id uuid, should_ban boolean, reason text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles%rowtype;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  if target_user_id = auth.uid() and should_ban then
    raise exception 'Admins cannot ban their own account';
  end if;

  update public.profiles
  set is_banned = should_ban,
      banned_at = case when should_ban then now() else null end,
      banned_reason = case when should_ban then nullif(trim(coalesce(reason, '')), '') else null end
  where id = target_user_id
  returning * into updated_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.admin_get_note_reports() to authenticated;
grant execute on function public.admin_update_report_status(uuid, text) to authenticated;
grant execute on function public.admin_set_user_ban(uuid, boolean, text) to authenticated;
