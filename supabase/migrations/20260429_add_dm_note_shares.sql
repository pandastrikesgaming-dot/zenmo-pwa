alter table public.messages
add column if not exists message_type text not null default 'text',
add column if not exists note_id uuid null references public.notes(id) on delete set null;

alter table public.messages
alter column content drop not null;

alter table public.messages
drop constraint if exists messages_content_check;

alter table public.messages
drop constraint if exists messages_message_type_check;

alter table public.messages
add constraint messages_message_type_check
check (message_type in ('text', 'note'));

alter table public.messages
drop constraint if exists messages_payload_check;

alter table public.messages
add constraint messages_payload_check
check (
  (
    message_type = 'text'
    and char_length(trim(coalesce(content, ''))) > 0
    and note_id is null
  )
  or
  (
    message_type = 'note'
    and note_id is not null
  )
);

create index if not exists messages_note_id_idx
  on public.messages (note_id)
  where note_id is not null;

create table if not exists public.note_shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint note_shares_not_self_check check (shared_by <> shared_with)
);

create unique index if not exists note_shares_note_shared_unique
  on public.note_shares (note_id, shared_by, shared_with);

create index if not exists note_shares_shared_with_note_idx
  on public.note_shares (shared_with, note_id, created_at desc);

create index if not exists note_shares_shared_by_note_idx
  on public.note_shares (shared_by, note_id, created_at desc);

alter table public.note_shares enable row level security;

drop policy if exists "users can read their own note shares" on public.note_shares;
drop policy if exists "users can create note shares they own" on public.note_shares;
drop policy if exists "users can delete sent note shares" on public.note_shares;

create or replace function public.can_view_note(target_note_id uuid, viewer_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    viewer_id is not null
    and exists (
      select 1
      from public.notes n
      left join public.profiles p on p.id = viewer_id
      where n.id = target_note_id
        and (
          n.user_id = viewer_id
          or (
            p.id is not null
            and p.school_id = n.school_id
            and p.class_id = n.class_id
            and coalesce(p.section_id, '') = coalesce(n.section_id, '')
          )
          or exists (
            select 1
            from public.note_shares ns
            where ns.note_id = n.id
              and ns.shared_with = viewer_id
          )
        )
    );
$$;

grant execute on function public.can_view_note(uuid, uuid) to authenticated;

create policy "users can read their own note shares"
on public.note_shares
for select
to authenticated
using (auth.uid() = shared_by or auth.uid() = shared_with);

create policy "users can create note shares they own"
on public.note_shares
for insert
to authenticated
with check (
  auth.uid() = shared_by
  and auth.uid() <> shared_with
  and public.can_view_note(note_id, auth.uid())
);

create policy "users can delete sent note shares"
on public.note_shares
for delete
to authenticated
using (auth.uid() = shared_by);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'users can read owned scoped or shared notes'
  ) then
    create policy "users can read owned scoped or shared notes"
    on public.notes
    for select
    to authenticated
    using (public.can_view_note(id, auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'note_pages'
      and policyname = 'users can read owned scoped or shared note pages'
  ) then
    create policy "users can read owned scoped or shared note pages"
    on public.note_pages
    for select
    to authenticated
    using (public.can_view_note(note_id, auth.uid()));
  end if;
end
$$;

create or replace function public.get_visible_note(target_note_id uuid)
returns table (
  id uuid,
  title text,
  subject text,
  file_type text,
  file_url text,
  user_id uuid,
  user_name text,
  pages integer,
  school_id text,
  class_id text,
  section_id text,
  uploaded_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    n.id,
    n.title,
    n.subject,
    n.file_type,
    n.file_url,
    n.user_id,
    n.user_name,
    n.pages,
    n.school_id,
    n.class_id,
    n.section_id,
    n.uploaded_at
  from public.notes n
  where n.id = target_note_id
    and public.can_view_note(n.id, auth.uid())
  limit 1;
$$;

grant execute on function public.get_visible_note(uuid) to authenticated;

create or replace function public.get_shareable_notes()
returns table (
  id uuid,
  title text,
  subject text,
  file_type text,
  file_url text,
  user_id uuid,
  user_name text,
  pages integer,
  school_id text,
  class_id text,
  section_id text,
  uploaded_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    n.id,
    n.title,
    n.subject,
    n.file_type,
    n.file_url,
    n.user_id,
    n.user_name,
    n.pages,
    n.school_id,
    n.class_id,
    n.section_id,
    n.uploaded_at
  from public.notes n
  where public.can_view_note(n.id, auth.uid())
  order by n.uploaded_at desc nulls last, n.id desc
  limit 80;
$$;

grant execute on function public.get_shareable_notes() to authenticated;

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
    case
      when ranked_messages.message_type = 'note' then 'Shared a note'
      else ranked_messages.content
    end as last_message,
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
