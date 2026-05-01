alter table public.profiles
add column if not exists profile_edit_count integer not null default 0;

update public.profiles
set profile_edit_count = 0
where profile_edit_count is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_profile_edit_count_range'
  ) then
    alter table public.profiles
    add constraint profiles_profile_edit_count_range
    check (profile_edit_count >= 0 and profile_edit_count <= 2);
  end if;
end
$$;

create or replace function public.enforce_profile_edit_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_edit_count integer;
  new_edit_count integer;
  editable_changed boolean;
begin
  if tg_op = 'INSERT' then
    new.profile_edit_count := 0;
    return new;
  end if;

  old_edit_count := coalesce(old.profile_edit_count, 0);
  new_edit_count := coalesce(new.profile_edit_count, old_edit_count);
  editable_changed :=
    new.full_name is distinct from old.full_name
    or new.username is distinct from old.username
    or new.school_id is distinct from old.school_id
    or new.class_id is distinct from old.class_id
    or new.section_id is distinct from old.section_id
    or new.avatar_url is distinct from old.avatar_url
    or new.user_code is distinct from old.user_code;

  if new_edit_count < old_edit_count then
    raise exception 'Profile edit count cannot be decreased';
  end if;

  if editable_changed then
    if old_edit_count >= 2 then
      raise exception 'You have reached the maximum profile edit limit.';
    end if;

    if new_edit_count <> old_edit_count + 1 then
      raise exception 'Profile edit count must increment after profile changes';
    end if;
  elsif new_edit_count not in (old_edit_count, old_edit_count + 1) then
    raise exception 'Profile edit count cannot skip edits';
  end if;

  if new_edit_count > 2 then
    raise exception 'You have reached the maximum profile edit limit.';
  end if;

  new.profile_edit_count := new_edit_count;
  return new;
end;
$$;

drop trigger if exists enforce_profile_edit_limit_trigger on public.profiles;

create trigger enforce_profile_edit_limit_trigger
before insert or update on public.profiles
for each row
execute function public.enforce_profile_edit_limit();

create or replace function public.save_profile_with_edit_limit(
  profile_full_name text,
  profile_school_id text,
  profile_class_id text,
  profile_section_id text
)
returns table (
  id uuid,
  full_name text,
  username text,
  school_id text,
  class_id text,
  section_id text,
  user_code text,
  avatar_url text,
  profile_edit_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  saved_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if btrim(coalesce(profile_full_name, '')) = '' then
    raise exception 'Full name is required';
  end if;

  if btrim(coalesce(profile_school_id, '')) = '' then
    raise exception 'School is required';
  end if;

  if btrim(coalesce(profile_class_id, '')) = '' then
    raise exception 'Class is required';
  end if;

  if btrim(coalesce(profile_section_id, '')) !~ '^[A-Z]$' then
    raise exception 'Section must be a single letter (A-Z)';
  end if;

  select *
  into current_profile
  from public.profiles
  where profiles.id = auth.uid()
  for update;

  if not found then
    insert into public.profiles (
      id,
      full_name,
      school_id,
      class_id,
      section_id,
      profile_edit_count
    )
    values (
      auth.uid(),
      btrim(profile_full_name),
      btrim(profile_school_id),
      btrim(profile_class_id),
      btrim(profile_section_id),
      0
    )
    returning profiles.id into saved_profile_id;
  else
    if coalesce(current_profile.profile_edit_count, 0) >= 2 then
      raise exception 'You have reached the maximum profile edit limit.';
    end if;

    update public.profiles
    set
      full_name = btrim(profile_full_name),
      school_id = btrim(profile_school_id),
      class_id = btrim(profile_class_id),
      section_id = btrim(profile_section_id),
      profile_edit_count = coalesce(public.profiles.profile_edit_count, 0) + 1
    where profiles.id = auth.uid()
    returning profiles.id into saved_profile_id;
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.username,
    p.school_id,
    p.class_id,
    p.section_id,
    p.user_code,
    p.avatar_url,
    p.profile_edit_count,
    p.created_at
  from public.profiles p
  where p.id = saved_profile_id;
end;
$$;

grant execute on function public.save_profile_with_edit_limit(text, text, text, text) to authenticated;
