do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'owners can update their notes'
  ) then
    create policy "owners can update their notes"
    on public.notes
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'owners can delete their notes'
  ) then
    create policy "owners can delete their notes"
    on public.notes
    for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;
