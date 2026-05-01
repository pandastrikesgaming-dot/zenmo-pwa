create table if not exists public.note_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text null,
  school_id text not null,
  class_id text not null,
  section_id text not null,
  subject text not null,
  title text not null,
  description text null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint note_requests_status_check check (status in ('open', 'fulfilled', 'closed'))
);

create index if not exists note_requests_scope_created_idx
  on public.note_requests (school_id, class_id, section_id, created_at desc);

create index if not exists note_requests_scope_status_created_idx
  on public.note_requests (school_id, class_id, section_id, status, created_at desc);

create index if not exists note_requests_user_created_idx
  on public.note_requests (user_id, created_at desc);

alter table public.note_requests enable row level security;

create policy "scoped users can read note requests"
on public.note_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.school_id = note_requests.school_id
      and p.class_id = note_requests.class_id
      and p.section_id = note_requests.section_id
  )
);

create policy "owners can create scoped note requests"
on public.note_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.school_id = note_requests.school_id
      and p.class_id = note_requests.class_id
      and p.section_id = note_requests.section_id
  )
);

create policy "owners can update their note requests"
on public.note_requests
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.school_id = note_requests.school_id
      and p.class_id = note_requests.class_id
      and p.section_id = note_requests.section_id
  )
);

create policy "owners can delete their note requests"
on public.note_requests
for delete
to authenticated
using (auth.uid() = user_id);
