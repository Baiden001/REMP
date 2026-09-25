-- Invoices track whether they've been paid; payments can be recorded against one.

alter table public.invoices
  add column if not exists status text not null default 'unpaid'
    check (status in ('unpaid', 'part_paid', 'paid', 'cancelled')),
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists paid_at date;

alter table public.payments
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists payments_invoice_id_idx on public.payments (invoice_id);

-- Recalculate an invoice's paid amount and status from the payments linked to it.
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
begin
  if target is null then
    return;
  end if;

  select coalesce(sum(ii.amount), 0) + coalesce(max(i.tax), 0)
    into total
  from invoices i
  left join invoice_items ii on ii.invoice_id = i.id
  where i.id = target;

  select coalesce(sum(p.amount + coalesce(p.tax, 0)), 0), max(p.paid_date)
    into paid, last_paid
  from payments p
  where p.invoice_id = target and p.status = 'paid';

  update invoices
  set amount_paid = paid,
      paid_at = case when paid >= total and total > 0 then last_paid else null end,
      status = case
        when status = 'cancelled' then 'cancelled'
        when paid >= total and total > 0 then 'paid'
        when paid > 0 then 'part_paid'
        else 'unpaid'
      end
  where id = target;
end;
$$;

create or replace function public.payments_refresh_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_invoice_payment_status(new.invoice_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_invoice_payment_status(old.invoice_id);
  else
    perform public.refresh_invoice_payment_status(old.invoice_id);
    if new.invoice_id is distinct from old.invoice_id then
      perform public.refresh_invoice_payment_status(new.invoice_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists payments_refresh_invoice on public.payments;
create trigger payments_refresh_invoice
  after insert or update or delete on public.payments
  for each row execute function public.payments_refresh_invoice();

revoke execute on function public.refresh_invoice_payment_status(uuid) from public, anon, authenticated;
