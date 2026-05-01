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

drop policy if exists "users can read classmate profiles" on public.profiles;
drop policy if exists "users can read existing dm contacts" on public.profiles;

create policy "users can read classmate profiles"
on public.profiles
for select
to authenticated
using (public.can_read_classmate_profile(id, school_id, class_id, section_id));

create policy "users can read existing dm contacts"
on public.profiles
for select
to authenticated
using (public.has_dm_contact(id));
