-- An invoice can be for buying a unit. When it's paid, REMP finds or creates the
-- client and the sale for that unit, then records the payment with a receipt,
-- so nobody has to create the sale by hand.
alter table public.invoices
  add column if not exists unit_id uuid references public.units(id) on delete set null,
  add column if not exists agreed_price numeric check (agreed_price is null or agreed_price > 0);
create index if not exists invoices_unit_id_idx on public.invoices (unit_id);

-- Now SECURITY DEFINER (finance may not create clients or mark units sold
-- directly); the role check below is the gate.
create or replace function public.mark_invoice_paid(
  p_invoice uuid,
  p_paid_date date default current_date,
  p_sale uuid default null,
  p_rental uuid default null,
  p_payment_for text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
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
begin
  if public.current_role() is null or public.current_role() not in ('ceo', 'management', 'finance', 'it') then
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

  -- Invoice for buying a unit: find or create the client and the sale.
  if target_sale is null and target_rental is null and inv.unit_id is not null then
    target_client := inv.client_id;

    if target_client is null then
      digits := nullif(regexp_replace(coalesce(inv.bill_to_phone, ''), '\D', '', 'g'), '');
      select id into target_client from clients
      where (digits is not null and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = right(digits, 9))
         or (inv.bill_to_email is not null and lower(email) = lower(inv.bill_to_email))
      order by created_at
      limit 1;
    end if;

    if target_client is null then
      insert into clients (full_name, phone, email, location)
      values (inv.bill_to_name, inv.bill_to_phone, inv.bill_to_email, inv.bill_to_address)
      returning id into target_client;
    end if;

    select id into target_sale from sales
    where unit_id = inv.unit_id and client_id = target_client
    order by sale_date desc nulls last
    limit 1;

    if target_sale is null then
      select c.full_name into other_buyer
      from sales s join clients c on c.id = s.client_id
      where s.unit_id = inv.unit_id
      limit 1;
      if other_buyer is not null then
        raise exception 'This unit has already been sold to %. Check the unit on the invoice.', other_buyer;
      end if;

      select coalesce(inv.agreed_price, u.price) into v_price from units u where u.id = inv.unit_id;
      if v_price is null or v_price <= 0 then
        raise exception 'The unit has no price. Set the agreed price on the invoice.';
      end if;

      insert into sales (client_id, unit_id, agent_id, sale_price, sale_date, payment_status)
      values (target_client, inv.unit_id, auth.uid(), v_price, p_paid_date, 'pending')
      returning id into target_sale;

      update units set availability = 'sold' where id = inv.unit_id;
    end if;

    update invoices set client_id = target_client, sale_id = target_sale where id = inv.id;
  end if;

  select coalesce(sum(amount), 0) + coalesce(inv.tax, 0) into total
  from invoice_items where invoice_id = inv.id;

  -- Not tied to a sale or rental: just mark the invoice itself.
  if target_sale is null and target_rental is null then
    update invoices set status = 'paid', amount_paid = total, paid_at = p_paid_date where id = inv.id;
    return null;
  end if;

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
