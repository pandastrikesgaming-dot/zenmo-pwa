create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_not_self_check check (blocker_id <> blocked_id),
  constraint blocked_users_unique unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_created_idx
  on public.blocked_users (blocker_id, created_at desc);

create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "users can read their blocked users" on public.blocked_users;
drop policy if exists "users can block users" on public.blocked_users;
drop policy if exists "users can unblock users" on public.blocked_users;

create policy "users can read their blocked users"
on public.blocked_users
for select
to authenticated
using (auth.uid() = blocker_id);

create policy "users can block users"
on public.blocked_users
for insert
to authenticated
with check (
  auth.uid() = blocker_id
  and auth.uid() <> blocked_id
);

create policy "users can unblock users"
on public.blocked_users
for delete
to authenticated
using (auth.uid() = blocker_id);

grant select, insert, delete on public.blocked_users to authenticated;

create or replace function public.dm_is_blocked(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    first_user_id is not null
    and second_user_id is not null
    and exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = first_user_id and b.blocked_id = second_user_id)
         or (b.blocker_id = second_user_id and b.blocked_id = first_user_id)
    );
$$;

grant execute on function public.dm_is_blocked(uuid, uuid) to authenticated;

create or replace function public.get_dm_block_status(target_user_id uuid)
returns table (
  blocked_by_me boolean,
  blocked_me boolean
)
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.blocked_users b
      where b.blocker_id = auth.uid()
        and b.blocked_id = target_user_id
    ) as blocked_by_me,
    exists (
      select 1
      from public.blocked_users b
      where b.blocker_id = target_user_id
        and b.blocked_id = auth.uid()
    ) as blocked_me;
$$;

grant execute on function public.get_dm_block_status(uuid) to authenticated;

drop policy if exists "users can create classroom or existing direct messages" on public.messages;

create policy "users can create classroom or existing direct messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
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

  select *
  into sender_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Sender profile not found';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Recipient not found';
  end if;

  if sender_profile.id = target_profile.id then
    raise exception 'You cannot message yourself';
  end if;

  if public.dm_is_blocked(sender_profile.id, target_profile.id) then
    raise exception 'Message cannot be sent.';
  end if;

  if trim(coalesce(message_content, '')) = '' then
    raise exception 'Message content is required';
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
  )
  into has_existing_history;

  if not is_same_scope and not has_existing_history then
    if normalized_code is null then
      raise exception 'A valid user code is required to start this chat';
    end if;

    if normalized_code <> upper(target_profile.user_code) then
      raise exception 'That code does not match the selected user';
    end if;
  end if;

  insert into public.messages (sender_id, receiver_id, content)
  values (sender_profile.id, target_profile.id, trim(message_content))
  returning * into inserted_message;

  return inserted_message;
end;
$$;

grant execute on function public.send_direct_message(uuid, text, text) to authenticated;

create or replace function public.send_note_direct_message(
  target_user_id uuid,
  shared_note_id uuid,
  target_code text default null
)
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

  select *
  into sender_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Sender profile not found';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Recipient not found';
  end if;

  if sender_profile.id = target_profile.id then
    raise exception 'You cannot message yourself';
  end if;

  if public.dm_is_blocked(sender_profile.id, target_profile.id) then
    raise exception 'Message cannot be sent.';
  end if;

  if not exists (select 1 from public.notes n where n.id = shared_note_id) then
    raise exception 'This note is no longer available.';
  end if;

  if not public.can_view_note(shared_note_id, sender_profile.id) then
    raise exception 'You do not have permission to share this note.';
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
  )
  into has_existing_history;

  if not is_same_scope and not has_existing_history then
    if normalized_code is null then
      raise exception 'A valid user code is required to start this chat';
    end if;

    if target_profile.user_code is null or normalized_code <> upper(target_profile.user_code) then
      raise exception 'That code does not match the selected user';
    end if;
  end if;

  insert into public.note_shares (note_id, shared_by, shared_with)
  values (shared_note_id, sender_profile.id, target_profile.id)
  on conflict (note_id, shared_by, shared_with) do nothing;

  insert into public.messages (sender_id, receiver_id, content, message_type, note_id)
  values (sender_profile.id, target_profile.id, null, 'note', shared_note_id)
  returning * into inserted_message;

  return inserted_message;
end;
$$;

grant execute on function public.send_note_direct_message(uuid, uuid, text) to authenticated;
