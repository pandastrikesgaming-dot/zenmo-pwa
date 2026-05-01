create table if not exists public.note_pages (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  page_number integer not null,
  image_url text not null,
  image_name text null,
  created_at timestamptz not null default now()
);

create unique index if not exists note_pages_note_id_page_number_key
  on public.note_pages (note_id, page_number);

create index if not exists note_pages_note_id_page_number_idx
  on public.note_pages (note_id, page_number);

alter table public.note_pages enable row level security;

create policy "authenticated users can read visible note pages"
on public.note_pages
for select
to authenticated
using (
  exists (
    select 1
    from public.notes n
    join public.profiles p on p.id = auth.uid()
    where n.id = note_pages.note_id
      and p.school_id = n.school_id
      and p.class_id = n.class_id
      and p.section_id is not null
      and p.section_id = n.section_id
  )
);

create policy "owners can insert note pages"
on public.note_pages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.notes n
    where n.id = note_pages.note_id
      and n.user_id = auth.uid()
  )
);

create policy "owners can update note pages"
on public.note_pages
for update
to authenticated
using (
  exists (
    select 1
    from public.notes n
    where n.id = note_pages.note_id
      and n.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.notes n
    where n.id = note_pages.note_id
      and n.user_id = auth.uid()
  )
);

create policy "owners can delete note pages"
on public.note_pages
for delete
to authenticated
using (
  exists (
    select 1
    from public.notes n
    where n.id = note_pages.note_id
      and n.user_id = auth.uid()
  )
);
