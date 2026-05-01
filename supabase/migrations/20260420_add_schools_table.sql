create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'pending',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_status_check check (status in ('pending', 'approved', 'rejected'))
);

create unique index if not exists schools_name_unique_idx
  on public.schools (lower(name));

create index if not exists schools_status_name_idx
  on public.schools (status, name);

alter table public.schools enable row level security;

create policy "authenticated users can read approved schools"
on public.schools
for select
to authenticated
using (status = 'approved');

create policy "authenticated users can insert pending school requests"
on public.schools
for insert
to authenticated
with check (
  status = 'pending'
  and created_by = auth.uid()
);

insert into public.schools (name, slug, status)
values
  ('National Public School, Indiranagar', 'national-public-school-indiranagar', 'approved'),
  ('Delhi Public School, Bangalore East', 'delhi-public-school-bangalore-east', 'approved'),
  ('St. Joseph''s Boys'' High School', 'st-josephs-boys-high-school', 'approved'),
  ('Kendriya Vidyalaya, Hebbal', 'kendriya-vidyalaya-hebbal', 'approved'),
  ('Bishop Cotton Boys'' School', 'bishop-cotton-boys-school', 'approved')
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  updated_at = now();
