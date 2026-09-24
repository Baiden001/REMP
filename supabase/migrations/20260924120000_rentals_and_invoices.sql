-- Rentals (short stay / monthly) and client invoices.
-- Additive and backward-compatible: existing sale flows keep working unchanged.

-- ============================================================
-- UNITS: sale or rent
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_type') then
    create type listing_type as enum ('sale', 'rent');
  end if;
end
$$;

alter type unit_availability add value if not exists 'rented';

alter table public.units
  add column if not exists listing_type listing_type not null default 'sale',
  add column if not exists nightly_rate numeric check (nightly_rate > 0),
  add column if not exists monthly_rate numeric check (monthly_rate > 0);

-- Rent units are priced by their rates, not a sale price.
alter table public.units alter column price drop not null;

alter table public.units drop constraint if exists units_listing_pricing_check;
alter table public.units add constraint units_listing_pricing_check check (
  (listing_type = 'sale' and price is not null)
  or (listing_type = 'rent' and (nightly_rate is not null or monthly_rate is not null))
);

-- ============================================================
-- RENTALS: a client's short stay or monthly tenancy on a unit
-- ============================================================
create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  unit_id uuid not null references public.units(id),
  agent_id uuid references public.profiles(id),
  rental_type text not null check (rental_type in ('short_stay', 'monthly')),
  start_date date not null,
  end_date date not null,
  rate numeric not null check (rate > 0), -- per night (short stay) or per month (monthly)
  periods numeric not null check (periods > 0), -- number of nights or months
  total_amount numeric not null check (total_amount >= 0),
  payment_status payment_status not null default 'pending',
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);

alter table public.rentals enable row level security;

drop policy if exists "staff can read rentals" on public.rentals;
create policy "staff can read rentals" on public.rentals
  for select using (auth.uid() is not null);

drop policy if exists "authorized staff manage rentals" on public.rentals;
create policy "authorized staff manage rentals" on public.rentals
  for all
  using (public.current_role() in ('ceo', 'management', 'sales', 'finance', 'it'))
  with check (public.current_role() in ('ceo', 'management', 'sales', 'finance', 'it'));

-- ============================================================
-- PAYMENTS: belong to either a sale or a rental
-- ============================================================
alter table public.payments alter column sale_id drop not null;

alter table public.payments
  add column if not exists rental_id uuid references public.rentals(id) on delete cascade,
  add column if not exists payment_for text,
  add column if not exists period_start date,
  add column if not exists period_end date;

alter table public.payments drop constraint if exists payments_sale_or_rental_check;
alter table public.payments add constraint payments_sale_or_rental_check
  check (num_nonnulls(sale_id, rental_id) = 1);

create index if not exists payments_rental_id_idx on public.payments (rental_id);

-- ============================================================
-- INVOICES
-- ============================================================
create sequence if not exists public.invoice_number_seq;

create or replace function public.next_invoice_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'INV' || to_char(current_date, 'YY') || '/' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default public.next_invoice_number(),
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  bill_to_name text not null,
  bill_to_phone text,
  bill_to_email text,
  bill_to_address text,
  invoice_date date not null default current_date,
  due_date date,
  tax numeric not null default 0 check (tax >= 0),
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  amount numeric not null check (amount >= 0),
  position smallint not null default 0
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "staff can read invoices" on public.invoices;
create policy "staff can read invoices" on public.invoices
  for select using (auth.uid() is not null);

drop policy if exists "finance manage invoices" on public.invoices;
create policy "finance manage invoices" on public.invoices
  for all
  using (public.current_role() in ('ceo', 'management', 'finance', 'it'))
  with check (public.current_role() in ('ceo', 'management', 'finance', 'it'));

drop policy if exists "staff can read invoice items" on public.invoice_items;
create policy "staff can read invoice items" on public.invoice_items
  for select using (auth.uid() is not null);

drop policy if exists "finance manage invoice items" on public.invoice_items;
create policy "finance manage invoice items" on public.invoice_items
  for all
  using (public.current_role() in ('ceo', 'management', 'finance', 'it'))
  with check (public.current_role() in ('ceo', 'management', 'finance', 'it'));
