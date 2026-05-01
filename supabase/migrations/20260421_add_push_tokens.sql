create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_check check (platform in ('android', 'ios'))
);

create unique index if not exists push_tokens_token_unique_idx
  on public.push_tokens (expo_push_token);

create index if not exists push_tokens_user_updated_idx
  on public.push_tokens (user_id, updated_at desc);

alter table public.push_tokens enable row level security;

create policy "users can read their own push tokens"
on public.push_tokens
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their own push tokens"
on public.push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their own push tokens"
on public.push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete their own push tokens"
on public.push_tokens
for delete
to authenticated
using (auth.uid() = user_id);
