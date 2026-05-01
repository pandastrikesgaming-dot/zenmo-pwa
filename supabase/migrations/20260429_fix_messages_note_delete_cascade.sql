do $$
declare
  fk_name text;
begin
  for fk_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'messages'
      and rn.nspname = 'public'
      and rt.relname = 'notes'
      and exists (
        select 1
        from unnest(c.conkey) as key(attnum)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum
        where a.attname = 'note_id'
      )
  loop
    execute format('alter table public.messages drop constraint %I', fk_name);
  end loop;
end $$;

alter table public.messages
add constraint messages_note_id_fkey
foreign key (note_id)
references public.notes(id)
on delete cascade;
