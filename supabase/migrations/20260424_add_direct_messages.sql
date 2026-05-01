create extension if not exists pgcrypto;

create or replace function public.generate_user_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'ZM-' || upper(substr(translate(gen_random_uuid()::text, '-', ''), 1, 6));

    exit when not exists (
      select 1
      from public.profiles
      where user_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.build_username_seed(full_name text, user_id uuid)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(full_name, 'zenmo-student')), '[^a-z0-9]+', '-', 'g'))
         || '-'
         || substr(replace(user_id::text, '-', ''), 1, 4);
$$;

alter table public.profiles
add column if not exists username text,
add column if not exists user_code text,
add column if not exists avatar_url text;

update public.profiles
set username = public.build_username_seed(full_name, id)
where username is null or btrim(username) = '';

update public.profiles
set user_code = 'ZM-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where user_code is null or btrim(user_code) = '';

alter table public.profiles
alter column username set not null;

alter table public.profiles
alter column user_code set not null;

create unique index if not exists profiles_username_key
  on public.profiles (username);

create unique index if not exists profiles_user_code_key
  on public.profiles (user_code);

create or replace function public.assign_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if new.username is null or btrim(new.username) = '' then
    new.username := public.build_username_seed(new.full_name, new.id);
  end if;

  new.username := trim(both '-' from regexp_replace(lower(new.username), '[^a-z0-9]+', '-', 'g'));

  if new.user_code is null or btrim(new.user_code) = '' then
    new.user_code := public.generate_user_code();
  else
    new.user_code := upper(new.user_code);
  end if;

  return new;
end;
$$;

drop trigger if exists assign_profile_identity_trigger on public.profiles;

create trigger assign_profile_identity_trigger
before insert or update on public.profiles
for each row
execute function public.assign_profile_identity();

create or replace function public.can_read_classmate_profile(
  target_profile_id uuid,
  target_school_id text,
  target_class_id text,
  target_section_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and auth.uid() <> target_profile_id
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.school_id = target_school_id
        and me.class_id = target_class_id
        and coalesce(me.section_id, '') = coalesce(target_section_id, '')
    );
$$;

create or replace function public.has_dm_contact(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and auth.uid() <> target_profile_id
    and exists (
      select 1
      from public.messages m
      where (m.sender_id = auth.uid() and m.receiver_id = target_profile_id)
         or (m.receiver_id = auth.uid() and m.sender_id = target_profile_id)
    );
$$;

grant execute on function public.can_read_classmate_profile(uuid, text, text, text) to authenticated;
grant execute on function public.has_dm_contact(uuid) to authenticated;

drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can read classmate profiles" on public.profiles;
drop policy if exists "users can read existing dm contacts" on public.profiles;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "users can read classmate profiles"
on public.profiles
for select
to authenticated
using (public.can_read_classmate_profile(id, school_id, class_id, section_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  constraint messages_sender_receiver_check check (sender_id <> receiver_id),
  constraint messages_content_check check (char_length(trim(content)) > 0)
);

create index if not exists messages_sender_receiver_created_idx
  on public.messages (sender_id, receiver_id, created_at desc);

create index if not exists messages_receiver_sender_created_idx
  on public.messages (receiver_id, sender_id, created_at desc);

create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

create index if not exists messages_unread_idx
  on public.messages (receiver_id, is_read, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "users can read their own direct messages" on public.messages;
drop policy if exists "users can create classroom or existing direct messages" on public.messages;
drop policy if exists "receivers can mark their direct messages read" on public.messages;
drop policy if exists "senders can delete their own direct messages" on public.messages;

create policy "users can read their own direct messages"
on public.messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "users can create classroom or existing direct messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
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

create policy "receivers can mark their direct messages read"
on public.messages
for update
to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

create policy "senders can delete their own direct messages"
on public.messages
for delete
to authenticated
using (auth.uid() = sender_id);

create policy "users can read existing dm contacts"
on public.profiles
for select
to authenticated
using (public.has_dm_contact(id));

create or replace function public.find_profile_by_code(search_code text)
returns table (
  id uuid,
  full_name text,
  username text,
  school_id text,
  class_id text,
  section_id text,
  user_code text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.school_id,
    p.class_id,
    p.section_id,
    p.user_code,
    p.avatar_url
  from public.profiles p
  where upper(p.user_code) = upper(trim(search_code))
    and p.id <> auth.uid()
  limit 1;
$$;

grant execute on function public.find_profile_by_code(text) to authenticated;

create or replace function public.get_dm_conversations()
returns table (
  user_id uuid,
  full_name text,
  username text,
  school_id text,
  class_id text,
  section_id text,
  user_code text,
  avatar_url text,
  last_message text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint
)
language sql
security definer
set search_path = public
as $$
  with relevant_messages as (
    select
      m.*,
      case
        when m.sender_id = auth.uid() then m.receiver_id
        else m.sender_id
      end as partner_id
    from public.messages m
    where m.sender_id = auth.uid() or m.receiver_id = auth.uid()
  ),
  ranked_messages as (
    select
      relevant_messages.*,
      row_number() over (
        partition by relevant_messages.partner_id
        order by relevant_messages.created_at desc, relevant_messages.id desc
      ) as row_number_desc
    from relevant_messages
  ),
  unread_messages as (
    select
      relevant_messages.partner_id,
      count(*) as unread_count
    from relevant_messages
    where relevant_messages.receiver_id = auth.uid()
      and relevant_messages.is_read = false
    group by relevant_messages.partner_id
  )
  select
    partner.id as user_id,
    partner.full_name,
    partner.username,
    partner.school_id,
    partner.class_id,
    partner.section_id,
    partner.user_code,
    partner.avatar_url,
    ranked_messages.content as last_message,
    ranked_messages.created_at as last_message_at,
    ranked_messages.sender_id as last_message_sender_id,
    coalesce(unread_messages.unread_count, 0) as unread_count
  from ranked_messages
  join public.profiles partner on partner.id = ranked_messages.partner_id
  left join unread_messages on unread_messages.partner_id = ranked_messages.partner_id
  where ranked_messages.row_number_desc = 1
  order by ranked_messages.created_at desc, partner.full_name asc;
$$;

grant execute on function public.get_dm_conversations() to authenticated;

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

create or replace function public.mark_dm_conversation_read(other_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.messages
  set is_read = true
  where sender_id = other_user_id
    and receiver_id = auth.uid()
    and is_read = false;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.mark_dm_conversation_read(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
