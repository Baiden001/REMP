-- Rental availability is derived from bookings, double bookings are blocked,
-- and finance gets rent-due reminders.

-- ============================================================
-- 1. No overlapping bookings on the same unit
-- ============================================================
create extension if not exists btree_gist with schema extensions;

alter table public.rentals drop constraint if exists rentals_no_overlap;
alter table public.rentals add constraint rentals_no_overlap
  exclude using gist (unit_id with =, daterange(start_date, end_date, '[)') with &&);

-- ============================================================
-- 2. Keep rent units' availability in step with their bookings
--    rented    = a booking covers today
--    available = otherwise (units marked "unavailable" are left alone)
-- ============================================================
create or replace function public.sync_rental_unit_availability(target_unit uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update units u
  set availability = case
        when exists (
          select 1 from rentals r
          where r.unit_id = u.id
            and r.start_date <= current_date
            and r.end_date > current_date
        ) then 'rented'::unit_availability
        else 'available'::unit_availability
      end,
      updated_at = now()
  where u.listing_type = 'rent'
    and u.availability <> 'unavailable'
    and (target_unit is null or u.id = target_unit)
    and u.availability is distinct from (
      case
        when exists (
          select 1 from rentals r
          where r.unit_id = u.id
            and r.start_date <= current_date
            and r.end_date > current_date
        ) then 'rented'::unit_availability
        else 'available'::unit_availability
      end
    );
end;
$$;

create or replace function public.rentals_sync_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_rental_unit_availability(old.unit_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_rental_unit_availability(new.unit_id);
  end if;
  return null;
end;
$$;

drop trigger if exists rentals_sync_unit on public.rentals;
create trigger rentals_sync_unit
  after insert or update or delete on public.rentals
  for each row execute function public.rentals_sync_unit();

-- Switching a unit to "rent" (or editing it) should also pick up its bookings.
create or replace function public.units_sync_rent_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  relevant boolean;
begin
  if tg_op = 'INSERT' then
    relevant := true;
  else
    relevant := old.listing_type is distinct from new.listing_type
      or old.availability is distinct from new.availability;
  end if;

  if new.listing_type = 'rent' and new.availability <> 'unavailable' and relevant then
    new.availability := case
      when exists (
        select 1 from rentals r
        where r.unit_id = new.id
          and r.start_date <= current_date
          and r.end_date > current_date
      ) then 'rented'::unit_availability
      else 'available'::unit_availability
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists units_sync_rent_availability on public.units;
create trigger units_sync_rent_availability
  before insert or update on public.units
  for each row execute function public.units_sync_rent_availability();

-- ============================================================
-- 3. Rent-due reminders
--    Monthly: the next unpaid month starts the day after the last rent
--    period paid (or on the start date). Reminders 3 days before, on the
--    day, and once when it becomes overdue.
--    Short stay: reminder the day before check-in and once overdue if the
--    booking is not fully paid.
--    Sent to CEO, management, finance, IT and the rental's agent.
-- ============================================================
create or replace function public.create_rental_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  paid_through date;
  paid_total numeric;
  next_due date;
  n_type text;
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
    where rentals.end_date > current_date - 30
  loop
    n_type := null;

    select max(p.period_end), coalesce(sum(p.amount), 0)
      into paid_through, paid_total
    from payments p
    where p.rental_id = r.id
      and p.status = 'paid'
      and (p.payment_for is null or p.payment_for in ('Monthly rent', 'Short-stay booking'));

    if r.rental_type = 'monthly' then
      next_due := coalesce(paid_through + 1, r.start_date);
      if next_due >= r.end_date then
        continue; -- whole tenancy paid
      end if;

      if next_due = current_date + 3 then
        n_type := 'rent_due_soon';
        n_title := 'Rent due in 3 days';
      elsif next_due = current_date then
        n_type := 'rent_due_today';
        n_title := 'Rent due today';
      elsif next_due < current_date then
        n_type := 'rent_overdue';
        n_title := 'Rent overdue';
      end if;

      n_body := r.client_name || ' · ' || r.unit_code || ': monthly rent of GH₵'
        || to_char(r.rate, 'FM999,999,999,990.00') || ' due ' || to_char(next_due, 'DD Mon YYYY') || '.';
    else
      if paid_total >= r.total_amount then
        continue;
      end if;
      next_due := r.start_date;

      if next_due = current_date + 1 then
        n_type := 'rent_due_soon';
        n_title := 'Short stay unpaid — check-in tomorrow';
      elsif next_due <= current_date then
        n_type := 'rent_overdue';
        n_title := 'Short stay payment outstanding';
      end if;

      n_body := r.client_name || ' · ' || r.unit_code || ': GH₵'
        || to_char(r.total_amount - paid_total, 'FM999,999,999,990.00') || ' outstanding for check-in on '
        || to_char(next_due, 'DD Mon YYYY') || '.';
    end if;

    if n_type is null then
      continue;
    end if;

    insert into notifications (recipient_id, title, body, type, entity_type, entity_id)
    select pr.id, n_title, n_body, n_type, 'rental', r.id
    from profiles pr
    where pr.is_active
      and (pr.role in ('ceo', 'management', 'finance', 'it') or pr.id = r.agent_id)
      and not exists (
        select 1 from notifications n
        where n.recipient_id = pr.id
          and n.entity_id = r.id
          and n.type = n_type
          and n.body = n_body
      );

    get diagnostics inserted = row_count;
    created := created + inserted;
  end loop;

  return created;
end;
$$;

-- Only the scheduler (and the service role) should run these.
revoke execute on function public.create_rental_due_notifications() from public, anon, authenticated;
revoke execute on function public.sync_rental_unit_availability(uuid) from public, anon, authenticated;

-- Daily at 06:00 Ghana time (UTC+0).
select cron.unschedule(jobid) from cron.job where jobname = 'rental-daily';
select cron.schedule(
  'rental-daily',
  '0 6 * * *',
  $$select public.sync_rental_unit_availability(); select public.create_rental_due_notifications();$$
);

-- Bring existing rent units in line now.
select public.sync_rental_unit_availability();
