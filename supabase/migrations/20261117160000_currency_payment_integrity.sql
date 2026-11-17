
-- Keep all payment and invoice calculations separated by currency.

-- 1. Recalculate sale and rental payment status using only matching currency.
create or replace function public.refresh_parent_payment_status(
  p_sale uuid,
  p_rental uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  due numeric;
  collected numeric;
  next_status payment_status;
  parent_currency text;
begin
  if p_sale is not null then
    select sale_price, coalesce(currency, 'GHS')
      into due, parent_currency
    from sales
    where id = p_sale;

    select coalesce(sum(amount), 0)
      into collected
    from payments
    where sale_id = p_sale
      and status = 'paid'
      and coalesce(currency, 'GHS') = parent_currency;

    next_status := (
      case
        when collected >= due and due > 0 then 'paid'
        when collected > 0 then 'partial'
        else 'pending'
      end
    )::payment_status;

    update sales
    set payment_status = next_status
    where id = p_sale
      and payment_status is distinct from next_status;
  end if;

  if p_rental is not null then
    select total_amount, coalesce(currency, 'GHS')
      into due, parent_currency
    from rentals
    where id = p_rental;

    select coalesce(sum(amount), 0)
      into collected
    from payments
    where rental_id = p_rental
      and status = 'paid'
      and coalesce(currency, 'GHS') = parent_currency
      and (
        payment_for is null
        or payment_for in ('Monthly rent', 'Short-stay booking')
      );

    next_status := (
      case
        when collected >= due and due > 0 then 'paid'
        when collected > 0 then 'partial'
        else 'pending'
      end
    )::payment_status;

    update rentals
    set payment_status = next_status
    where id = p_rental
      and payment_status is distinct from next_status;
  end if;
end;
$$;


-- 2. Recalculate invoice paid amount using only its own currency.
create or replace function public.refresh_invoice_payment_status(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total numeric;
  paid numeric;
  last_paid date;
  invoice_currency text;
begin
  if target is null then
    return;
  end if;

  select
    coalesce(sum(ii.amount), 0) + coalesce(max(i.tax), 0),
    coalesce(i.currency, 'GHS')
  into total, invoice_currency
  from invoices i
  left join invoice_items ii on ii.invoice_id = i.id
  where i.id = target
  group by i.id, i.currency;

  if not found then
    return;
  end if;

  select
    coalesce(sum(p.amount + coalesce(p.tax, 0)), 0),
    max(p.paid_date)
  into paid, last_paid
  from payments p
  where p.invoice_id = target
    and p.status = 'paid'
    and coalesce(p.currency, 'GHS') = invoice_currency;

  update invoices
  set amount_paid = paid,
      paid_at = case
        when paid >= total and total > 0 then last_paid
        else null
      end,
      status = case
        when status = 'cancelled' then 'cancelled'
        when paid >= total and total > 0 then 'paid'
        when paid > 0 then 'part_paid'
        else 'unpaid'
      end
  where id = target;
end;
$$;


-- 3. Mark an invoice paid and record the payment in the correct currency.
-- Also preserves the existing automatic sale creation for unit-purchase invoices.
create or replace function public.mark_invoice_paid(
  p_invoice uuid,
  p_paid_date date default current_date,
  p_sale uuid default null,
  p_rental uuid default null,
  p_payment_for text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invoices;
  target_client uuid;
  target_sale uuid;
  target_rental uuid;
  other_buyer text;
  total numeric;
  paid_so_far numeric;
  linked_count integer;
  balance numeric;
  pay_amount numeric;
  pay_tax numeric;
  label text;
  receipt text;
  new_id uuid;
  digits text;
  v_price numeric;
  transaction_currency text;
begin
  if public.current_role() is null
     or public.current_role() not in ('ceo', 'management', 'finance', 'it') then
    raise exception 'Only finance, management, IT or the CEO can record payments.';
  end if;

  select *
  into inv
  from invoices
  where id = p_invoice
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if inv.status = 'cancelled' then
    raise exception 'This invoice is cancelled. Restore it first.';
  end if;

  target_sale := coalesce(inv.sale_id, p_sale);
  target_rental := case
    when target_sale is null then coalesce(inv.rental_id, p_rental)
  end;

  -- Invoice for buying a unit: find or create the client and sale.
  if target_sale is null
     and target_rental is null
     and inv.unit_id is not null then

    target_client := inv.client_id;

    if target_client is null then
      digits := nullif(
        regexp_replace(coalesce(inv.bill_to_phone, ''), '\D', '', 'g'),
        ''
      );

      select id
      into target_client
      from clients
      where (
        digits is not null
        and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9)
            = right(digits, 9)
      )
      or (
        inv.bill_to_email is not null
        and lower(email) = lower(inv.bill_to_email)
      )
      order by created_at
      limit 1;
    end if;

    if target_client is null then
      insert into clients (
        full_name,
        phone,
        email,
        location
      )
      values (
        inv.bill_to_name,
        inv.bill_to_phone,
        inv.bill_to_email,
        inv.bill_to_address
      )
      returning id into target_client;
    end if;

    select id
    into target_sale
    from sales
    where unit_id = inv.unit_id
      and client_id = target_client
    order by sale_date desc nulls last
    limit 1;

    if target_sale is null then
      select c.full_name
      into other_buyer
      from sales s
      join clients c on c.id = s.client_id
      where s.unit_id = inv.unit_id
      limit 1;

      if other_buyer is not null then
        raise exception
          'This unit has already been sold to %. Check the unit on the invoice.',
          other_buyer;
      end if;

      select coalesce(inv.agreed_price, u.price)
      into v_price
      from units u
      where u.id = inv.unit_id;

      if v_price is null or v_price <= 0 then
        raise exception
          'The unit has no price. Set the agreed price on the invoice.';
      end if;

      insert into sales (
        client_id,
        unit_id,
        agent_id,
        sale_price,
        sale_date,
        payment_status,
        currency
      )
      values (
        target_client,
        inv.unit_id,
        auth.uid(),
        v_price,
        p_paid_date,
        'pending',
        coalesce(inv.currency, 'GHS')
      )
      returning id into target_sale;

      update units
      set availability = 'sold'
      where id = inv.unit_id;
    end if;

    update invoices
    set client_id = target_client,
        sale_id = target_sale
    where id = inv.id;
  end if;

  -- Determine the currency from the linked transaction.
  if target_sale is not null then
    select coalesce(currency, 'GHS')
    into transaction_currency
    from sales
    where id = target_sale;
  elsif target_rental is not null then
    select coalesce(currency, 'GHS')
    into transaction_currency
    from rentals
    where id = target_rental;
  else
    transaction_currency := coalesce(inv.currency, 'GHS');
  end if;

  if transaction_currency not in ('GHS', 'USD') then
    raise exception 'Unsupported transaction currency.';
  end if;

  -- Keep the invoice aligned with its linked transaction.
  if coalesce(inv.currency, 'GHS') <> transaction_currency then
    update invoices
    set currency = transaction_currency
    where id = inv.id;

    inv.currency := transaction_currency;
  end if;

  select coalesce(sum(amount), 0) + coalesce(inv.tax, 0)
  into total
  from invoice_items
  where invoice_id = inv.id;

  -- Not tied to a sale or rental: mark the invoice itself.
  if target_sale is null and target_rental is null then
    update invoices
    set status = 'paid',
        amount_paid = total,
        paid_at = p_paid_date
    where id = inv.id;

    return null;
  end if;

  if inv.sale_id is null and inv.rental_id is null then
    update invoices
    set sale_id = target_sale,
        rental_id = target_rental
    where id = inv.id;
  end if;

  -- Count only payments in this invoice's currency.
  select
    coalesce(sum(amount + coalesce(tax, 0)), 0),
    count(*)
  into paid_so_far, linked_count
  from payments
  where invoice_id = inv.id
    and status = 'paid'
    and coalesce(currency, 'GHS') = transaction_currency;

  balance := total - paid_so_far;

  if balance <= 0 then
    perform public.refresh_invoice_payment_status(inv.id);
    return null;
  end if;

  -- First payment carries invoice tax; later payments carry the remainder.
  if linked_count = 0
     and coalesce(inv.tax, 0) > 0
     and balance = total then
    pay_tax := inv.tax;
    pay_amount := balance - inv.tax;
  else
    pay_tax := 0;
    pay_amount := balance;
  end if;

  if target_sale is not null then
    label := coalesce(
      nullif(trim(p_payment_for), ''),
      'Property purchase installment'
    );
  else
    select coalesce(
      nullif(trim(p_payment_for), ''),
      case
        when rental_type = 'monthly' then 'Monthly rent'
        else 'Short-stay booking'
      end
    )
    into label
    from rentals
    where id = target_rental;
  end if;

  -- Receipt number: REMP{yy}/{n}/{ddmm}.
  select
    'REMP'
    || to_char(p_paid_date, 'YY')
    || '/'
    || lpad((count(*) + 1)::text, 3, '0')
    || '/'
    || to_char(p_paid_date, 'DDMM')
  into receipt
  from payments
  where status = 'paid';

  insert into payments (
    sale_id,
    rental_id,
    invoice_id,
    amount,
    tax,
    currency,
    due_date,
    paid_date,
    status,
    receipt_number,
    payment_for,
    recorded_by
  )
  values (
    target_sale,
    target_rental,
    inv.id,
    pay_amount,
    pay_tax,
    transaction_currency,
    inv.due_date,
    p_paid_date,
    'paid',
    receipt,
    label,
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;


-- Restore the intended permissions.
revoke execute on function public.refresh_parent_payment_status(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.refresh_invoice_payment_status(uuid)
  from public, anon, authenticated;

revoke execute on function public.mark_invoice_paid(uuid, date, uuid, uuid, text)
  from public, anon;

grant execute on function public.mark_invoice_paid(uuid, date, uuid, uuid, text)
  to authenticated;

grant execute on function public.refresh_invoice_payment_status(uuid)
  to authenticated;


-- Recalculate existing sale and rental statuses using their own currencies.
select public.refresh_parent_payment_status(id, null)
from sales;

select public.refresh_parent_payment_status(null, id)
from rentals;

-- Recalculate existing invoice totals using their own currencies.
select public.refresh_invoice_payment_status(id)
from invoices;
