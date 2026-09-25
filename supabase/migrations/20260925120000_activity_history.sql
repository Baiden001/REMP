-- Activity history: every create / edit / delete on the main tables is written
-- to audit_logs by a trigger (so it can't be skipped or faked from the app).

create or replace function public.audit_label(tbl text, rec jsonb)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case tbl
    when 'sales' then
      coalesce((select c.full_name from clients c where c.id = (rec->>'client_id')::uuid), 'Client')
      || ' · ' || coalesce((select u.unit_code from units u where u.id = (rec->>'unit_id')::uuid), 'unit')
    when 'rentals' then
      coalesce((select c.full_name from clients c where c.id = (rec->>'client_id')::uuid), 'Client')
      || ' · ' || coalesce((select u.unit_code from units u where u.id = (rec->>'unit_id')::uuid), 'unit')
    when 'payments' then
      'GH₵' || to_char((rec->>'amount')::numeric, 'FM999,999,999,990.00')
      || coalesce(' · ' || (rec->>'payment_for'), '')
      || coalesce(' (' || (rec->>'receipt_number') || ')', '')
    when 'leads' then
      coalesce((select c.full_name from clients c where c.id = (rec->>'client_id')::uuid), 'Lead')
    when 'viewings' then
      coalesce((select c.full_name from clients c where c.id = (rec->>'client_id')::uuid), 'Client')
      || ' · ' || to_char((rec->>'scheduled_at')::timestamptz, 'DD Mon YYYY HH24:MI')
    when 'property_media' then
      coalesce(rec->>'caption', regexp_replace(rec->>'storage_path', '^.*/\d+-', ''))
    else
      coalesce(rec->>'name', rec->>'full_name', rec->>'unit_code', rec->>'invoice_number', rec->>'title', rec->>'id')
  end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_rec jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_rec jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  changed jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(new_rec) loop
      if k not in ('updated_at') and (old_rec->k) is distinct from (new_rec->k) then
        changed := changed || jsonb_build_object(k, jsonb_build_object('from', old_rec->k, 'to', new_rec->k));
      end if;
    end loop;
    if changed = '{}'::jsonb then
      return null; -- nothing meaningful changed
    end if;
  end if;

  insert into audit_logs (actor_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((new_rec->>'id')::uuid, (old_rec->>'id')::uuid),
    jsonb_build_object(
      'label', audit_label(tg_table_name, coalesce(new_rec, old_rec)),
      'changes', case when tg_op = 'UPDATE' then changed end
    )
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'units', 'clients', 'leads', 'viewings', 'sales', 'payments', 'rentals',
    'invoices', 'documents', 'property_media', 'campaigns', 'marketing_content', 'profiles'
  ] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.audit_row_change()', t);
  end loop;
end
$$;

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- Only leadership and IT can read the history; nobody can write it directly.
drop policy if exists "staff read audit logs" on public.audit_logs;
drop policy if exists "staff write audit logs" on public.audit_logs;
drop policy if exists "leadership reads audit logs" on public.audit_logs;
create policy "leadership reads audit logs" on public.audit_logs
  for select using (public.current_role() in ('ceo', 'management', 'it'));

-- Keep history when a staff account is removed (the name shows as "Former staff").
alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
