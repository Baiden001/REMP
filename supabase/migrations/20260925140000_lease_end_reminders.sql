-- Lease-end reminders: 30 and 7 days before a monthly tenancy ends, unless the
-- same tenant already has a follow-on tenancy on the unit.
create or replace function public.create_lease_end_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  days_left integer;
  n_title text;
  n_body text;
  created integer := 0;
  inserted integer;
begin
  for r in
    select rentals.*, clients.full_name as client_name, units.unit_code
    from rentals
    join clients on clients.id = rentals.client_id
    join units on units.id = rentals.unit_id
    where rentals.rental_type = 'monthly'
      and rentals.end_date - current_date in (30, 7)
      and not exists (
        select 1 from rentals nxt
        where nxt.unit_id = rentals.unit_id
          and nxt.client_id = rentals.client_id
          and nxt.id <> rentals.id
          and nxt.start_date >= rentals.end_date - 1
      )
  loop
    days_left := r.end_date - current_date;
    n_title := 'Tenancy ends in ' || days_left || ' days';
    n_body := r.client_name || ' · ' || r.unit_code || ': tenancy ends '
      || to_char(r.end_date, 'DD Mon YYYY') || '. Renew it or plan the next let.';

    insert into notifications (recipient_id, title, body, type, entity_type, entity_id)
    select pr.id, n_title, n_body, 'lease_ending', 'rental', r.id
    from profiles pr
    where pr.is_active
      and (pr.role in ('ceo', 'management', 'finance', 'it', 'sales') or pr.id = r.agent_id)
      and not exists (
        select 1 from notifications n
        where n.recipient_id = pr.id and n.entity_id = r.id and n.type = 'lease_ending' and n.body = n_body
      );

    get diagnostics inserted = row_count;
    created := created + inserted;
  end loop;

  return created;
end;
$$;

revoke execute on function public.create_lease_end_notifications() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'rental-daily';
select cron.schedule(
  'rental-daily',
  '0 6 * * *',
  $$select public.sync_rental_unit_availability(); select public.create_rental_due_notifications(); select public.create_lease_end_notifications();$$
);
