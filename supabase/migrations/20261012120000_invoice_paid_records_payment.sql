-- Marking an invoice paid records a real payment on its sale/rental, and every
-- sale/rental's payment_status is kept in step with its payments automatically.

-- Sale: paid amounts (excluding tax) vs sale price.
-- Rental: rent payments (excluding deposits/service charges and tax) vs total rent.
create or replace function public.refresh_parent_payment_status(p_sale uuid, p_rental uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  due numeric;
  collected numeric;
  next_status payment_status;
begin
  if p_sale is not null then
    select sale_price into due from sales where id = p_sale;
    select coalesce(sum(amount), 0) into collected from payments where sale_id = p_sale and status = 'paid';
    next_status := (case when collected >= due and due > 0 then 'paid' when collected > 0 then 'partial' else 'pending' end)::payment_status;
    update sales set payment_status = next_status where id = p_sale and payment_status is distinct from next_status;
  end if;
  if p_rental is not null then
    select total_amount into due from rentals where id = p_rental;
    select coalesce(sum(amount), 0) into collected from payments
    where rental_id = p_rental and status = 'paid'
      and (payment_for is null or payment_for in ('Monthly rent', 'Short-stay booking'));
    next_status := (case when collected >= due and due > 0 then 'paid' when collected > 0 then 'partial' else 'pending' end)::payment_status;
    update rentals set payment_status = next_status where id = p_rental and payment_status is distinct from next_status;
  end if;
end;
$$;

create or replace function public.payments_refresh_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_parent_payment_status(old.sale_id, old.rental_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_parent_payment_status(new.sale_id, new.rental_id);
  end if;
  return null;
end;
$$;

create or replace trigger payments_refresh_parent
  after insert or update or delete on public.payments
  for each row execute function public.payments_refresh_parent();

-- Price changes move the status too.
create or replace function public.parent_amount_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'sales' then
    perform public.refresh_parent_payment_status(new.id, null);
  else
    perform public.refresh_parent_payment_status(null, new.id);
  end if;
  return null;
end;
$$;

create or replace trigger sales_price_refresh_status
  after update of sale_price on public.sales
  for each row when (old.sale_price is distinct from new.sale_price)
  execute function public.parent_amount_changed();

create or replace trigger rentals_total_refresh_status
  after update of total_amount on public.rentals
  for each row when (old.total_amount is distinct from new.total_amount)
  execute function public.parent_amount_changed();

revoke execute on function public.refresh_parent_payment_status(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.payments_refresh_parent() from public, anon, authenticated;
revoke execute on function public.parent_amount_changed() from public, anon, authenticated;

-- Mark an invoice paid: records the outstanding balance as a paid payment (with a
-- receipt) on the invoice's sale or rental. Runs as the caller, so the usual
-- payment permissions (CEO, management, finance, IT) apply.
create or replace function public.mark_invoice_paid(
  p_invoice uuid,
  p_paid_date date default current_date,
  p_sale uuid default null,
  p_rental uuid default null,
  p_payment_for text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  inv invoices;
  target_sale uuid;
  target_rental uuid;
  total numeric;
  paid_so_far numeric;
  linked_count integer;
  balance numeric;
  pay_amount numeric;
  pay_tax numeric;
  label text;
  receipt text;
  new_id uuid;
begin
  if public.current_role() not in ('ceo', 'management', 'finance', 'it') then
    raise exception 'Only finance, management, IT or the CEO can record payments.';
  end if;

  select * into inv from invoices where id = p_invoice for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;
  if inv.status = 'cancelled' then
    raise exception 'This invoice is cancelled. Restore it first.';
  end if;

  target_sale := coalesce(inv.sale_id, p_sale);
  target_rental := case when target_sale is null then coalesce(inv.rental_id, p_rental) end;

  select coalesce(sum(amount), 0) + coalesce(inv.tax, 0) into total
  from invoice_items where invoice_id = inv.id;

  -- Not tied to a sale or rental: just mark the invoice itself.
  if target_sale is null and target_rental is null then
    update invoices set status = 'paid', amount_paid = total, paid_at = p_paid_date where id = inv.id;
    return null;
  end if;

  -- Remember the link chosen for an invoice that didn't have one.
  if inv.sale_id is null and inv.rental_id is null then
    update invoices set sale_id = target_sale, rental_id = target_rental where id = inv.id;
  end if;

  select coalesce(sum(amount + coalesce(tax, 0)), 0), count(*) into paid_so_far, linked_count
  from payments where invoice_id = inv.id and status = 'paid';

  balance := total - paid_so_far;
  if balance <= 0 then
    perform public.refresh_invoice_payment_status(inv.id);
    return null;
  end if;

  -- First payment against the invoice carries its tax; later ones are the remainder.
  if linked_count = 0 and coalesce(inv.tax, 0) > 0 and balance = total then
    pay_tax := inv.tax;
    pay_amount := balance - inv.tax;
  else
    pay_tax := 0;
    pay_amount := balance;
  end if;

  if target_sale is not null then
    label := coalesce(nullif(trim(p_payment_for), ''), 'Property purchase installment');
  else
    select coalesce(nullif(trim(p_payment_for), ''),
                    case when rental_type = 'monthly' then 'Monthly rent' else 'Short-stay booking' end)
      into label
    from rentals where id = target_rental;
  end if;

  -- Same format the app uses: REMP{yy}/{n}/{ddmm}, n = paid payments so far + 1.
  select 'REMP' || to_char(p_paid_date, 'YY') || '/' || lpad((count(*) + 1)::text, 3, '0') || '/' || to_char(p_paid_date, 'DDMM')
    into receipt
  from payments where status = 'paid';

  insert into payments (sale_id, rental_id, invoice_id, amount, tax, due_date, paid_date, status,
                        receipt_number, payment_for, recorded_by)
  values (target_sale, target_rental, inv.id, pay_amount, pay_tax, inv.due_date, p_paid_date, 'paid',
          receipt, label, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.mark_invoice_paid(uuid, date, uuid, uuid, text) from public, anon;
grant execute on function public.mark_invoice_paid(uuid, date, uuid, uuid, text) to authenticated;
-- Only recalculates an invoice from its recorded payments; needed by mark_invoice_paid and the app's "Mark as unpaid".
grant execute on function public.refresh_invoice_payment_status(uuid) to authenticated;

-- Bring every existing sale and rental into line once.
select public.refresh_parent_payment_status(id, null) from sales;
select public.refresh_parent_payment_status(null, id) from rentals;
