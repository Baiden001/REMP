-- Editing invoices: anyone who manages invoices can edit an unpaid one; once any
-- payment is recorded (or it's marked paid) only IT, management or the CEO can.
-- Every edit is recorded in Activity by the existing audit trigger, including
-- line items via the readable line_items summary kept on the invoice.

alter table public.invoices add column if not exists line_items text;

-- Readable summary for existing invoices, so the first edit shows a real "before".
-- (Not an edit anyone made, so it's kept out of Activity.)
alter table public.invoices disable trigger audit_invoices;
update public.invoices i
set line_items = s.summary
from (
  select invoice_id,
         string_agg(description || ' ×' || trim(to_char(coalesce(quantity, 1), 'FM999990.##'))
                    || ' @ ' || to_char(coalesce(unit_price, amount), 'FM999,999,999,990.00'), '; ' order by position) as summary
  from public.invoice_items
  group by invoice_id
) s
where s.invoice_id = i.id and i.line_items is null;
alter table public.invoices enable trigger audit_invoices;

create or replace function public.guard_paid_invoice_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  inv_status text;
  inv_paid numeric;
begin
  -- System jobs, and IT / management / CEO, may always edit.
  if auth.uid() is null or public.current_role() in ('ceo', 'management', 'it') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'invoices' then
    if (old.status in ('paid', 'part_paid') or coalesce(old.amount_paid, 0) > 0)
       and (new.invoice_number, new.bill_to_name, new.bill_to_phone, new.bill_to_email, new.bill_to_address,
            new.invoice_date, new.due_date, new.tax, new.notes, new.unit_id, new.agreed_price, new.line_items)
           is distinct from
           (old.invoice_number, old.bill_to_name, old.bill_to_phone, old.bill_to_email, old.bill_to_address,
            old.invoice_date, old.due_date, old.tax, old.notes, old.unit_id, old.agreed_price, old.line_items) then
      raise exception 'This invoice has a payment recorded. Only IT, management or the CEO can edit it.';
    end if;
    return new;
  end if;

  -- invoice_items
  target := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  select status, amount_paid into inv_status, inv_paid from invoices where id = target;
  if found and (inv_status in ('paid', 'part_paid') or coalesce(inv_paid, 0) > 0) then
    raise exception 'This invoice has a payment recorded. Only IT, management or the CEO can edit it.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.guard_paid_invoice_edit() from public, anon, authenticated;

create or replace trigger invoices_guard_paid_edit
  before update on public.invoices
  for each row execute function public.guard_paid_invoice_edit();

create or replace trigger invoice_items_guard_paid_edit
  before insert or update or delete on public.invoice_items
  for each row execute function public.guard_paid_invoice_edit();
