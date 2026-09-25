-- Share links: a hard-to-guess token that lets a client open one invoice or
-- receipt without logging in. Expires after 90 days; staff can revoke it.
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  kind text not null check (kind in ('invoice', 'receipt')),
  invoice_id uuid references public.invoices(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked boolean not null default false,
  check (
    (kind = 'invoice' and invoice_id is not null and payment_id is null)
    or (kind = 'receipt' and payment_id is not null and invoice_id is null)
  )
);

create index if not exists share_links_invoice_idx on public.share_links (invoice_id);
create index if not exists share_links_payment_idx on public.share_links (payment_id);

alter table public.share_links enable row level security;

drop policy if exists "staff manage share links" on public.share_links;
create policy "staff manage share links" on public.share_links
  for all
  using (public.current_role() in ('ceo', 'management', 'finance', 'it', 'sales'))
  with check (public.current_role() in ('ceo', 'management', 'finance', 'it', 'sales'));

-- The only way the public can read anything: one document, by a valid token.
create or replace function public.get_shared_document(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link share_links;
  pay payments;
  result jsonb;
begin
  select * into link
  from share_links
  where token = p_token and not revoked and expires_at > now();

  if not found then
    return null;
  end if;

  if link.kind = 'invoice' then
    select jsonb_build_object(
      'kind', 'invoice',
      'invoice', jsonb_build_object(
        'invoice_number', i.invoice_number,
        'bill_to_name', i.bill_to_name,
        'bill_to_phone', i.bill_to_phone,
        'bill_to_email', i.bill_to_email,
        'bill_to_address', i.bill_to_address,
        'invoice_date', i.invoice_date,
        'due_date', i.due_date,
        'notes', i.notes,
        'tax', i.tax,
        'status', i.status
      ),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'description', ii.description, 'amount', ii.amount,
          'quantity', ii.quantity, 'unit_price', ii.unit_price
        ) order by ii.position)
        from invoice_items ii where ii.invoice_id = i.id
      ), '[]'::jsonb),
      'issued_by', (select pr.full_name from profiles pr where pr.id = i.created_by)
    )
    into result
    from invoices i
    where i.id = link.invoice_id;
    return result;
  end if;

  select * into pay from payments where id = link.payment_id and status = 'paid';
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'kind', 'receipt',
    'parent', case when pay.sale_id is not null then 'sale' else 'rental' end,
    'payment', jsonb_build_object(
      'id', pay.id, 'amount', pay.amount, 'tax', pay.tax, 'paid_date', pay.paid_date,
      'receipt_number', pay.receipt_number, 'payment_for', pay.payment_for,
      'period_start', pay.period_start, 'period_end', pay.period_end
    ),
    'total_due', coalesce(s.sale_price, r.total_amount),
    'rental_type', r.rental_type,
    'client', jsonb_build_object('full_name', c.full_name, 'phone', c.phone, 'email', c.email),
    'unit', jsonb_build_object('unit_code', u.unit_code, 'unit_type', u.unit_type, 'project', p.name),
    'paid_payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'amount', x.amount, 'tax', x.tax, 'payment_for', x.payment_for)
                       order by x.paid_date, x.created_at)
      from payments x
      where x.status = 'paid'
        and ((pay.sale_id is not null and x.sale_id = pay.sale_id) or (pay.rental_id is not null and x.rental_id = pay.rental_id))
    ), '[]'::jsonb)
  )
  into result
  from (select 1) one
  left join sales s on s.id = pay.sale_id
  left join rentals r on r.id = pay.rental_id
  left join clients c on c.id = coalesce(s.client_id, r.client_id)
  left join units u on u.id = coalesce(s.unit_id, r.unit_id)
  left join projects p on p.id = u.project_id;

  return result;
end;
$$;

revoke all on function public.get_shared_document(text) from public;
grant execute on function public.get_shared_document(text) to anon, authenticated;
