alter table public.profiles
add column if not exists section_id text;

alter table public.notes
add column if not exists section_id text;

comment on column public.profiles.section_id is 'Uppercase section identifier used for note scoping.';
comment on column public.notes.section_id is 'Uppercase section identifier copied from the uploader profile for note scoping.';

update public.notes as n
set section_id = p.section_id
from public.profiles as p
where n.user_id = p.id
  and n.section_id is null
  and p.section_id is not null;

create index if not exists notes_scope_with_section_idx
  on public.notes (school_id, class_id, section_id, uploaded_at desc);

create index if not exists profiles_school_class_section_idx
  on public.profiles (school_id, class_id, section_id);

-- If your current notes SELECT policy scopes by school_id + class_id, update it to include section_id.
-- Replace the existing policy name with the one in your project if it differs.
--
-- Example:
-- drop policy if exists "students can read scoped notes" on public.notes;
-- create policy "students can read scoped notes"
-- on public.notes
-- for select
-- to authenticated
-- using (
--   exists (
--     select 1
--     from public.profiles p
--     where p.id = auth.uid()
--       and p.school_id = notes.school_id
--       and p.class_id = notes.class_id
--       and p.section_id is not null
--       and p.section_id = notes.section_id
--   )
-- );
