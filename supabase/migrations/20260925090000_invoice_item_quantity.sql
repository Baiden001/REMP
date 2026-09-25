-- Invoice lines become Qty × Unit price = Amount.
alter table public.invoice_items
  add column if not exists quantity numeric not null default 1 check (quantity > 0),
  add column if not exists unit_price numeric check (unit_price >= 0);

-- Existing lines: one of the amount.
update public.invoice_items set unit_price = amount where unit_price is null;

-- Left optional so older app versions that only send "amount" keep working;
-- a missing unit price is shown as the amount.
