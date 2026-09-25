-- Forgotten passwords go to IT: staff ask from the login page, IT/CEO approve
-- and send a one-time link that opens the branded reset page.
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz
);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests (status, requested_at desc);

alter table public.password_reset_requests enable row level security;

drop policy if exists "it and ceo read reset requests" on public.password_reset_requests;
create policy "it and ceo read reset requests" on public.password_reset_requests
  for select using (public.current_role() in ('it', 'ceo'));

drop policy if exists "it and ceo handle reset requests" on public.password_reset_requests;
create policy "it and ceo handle reset requests" on public.password_reset_requests
  for update using (public.current_role() in ('it', 'ceo'))
  with check (public.current_role() in ('it', 'ceo'));

-- Called from the public "Forgot password" form. Always succeeds silently so it
-- never reveals whether an email has an account.
create or replace function public.request_password_reset(p_email text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  target_name text;
  clean_email text := lower(trim(coalesce(p_email, '')));
  clean_note text := nullif(left(trim(coalesce(p_note, '')), 300), '');
  new_id uuid;
begin
  if clean_email = '' or length(clean_email) > 254 then
    return;
  end if;

  -- Crude flood protection for an endpoint anyone can reach.
  if (select count(*) from password_reset_requests where requested_at > now() - interval '1 hour') >= 30 then
    return;
  end if;

  select u.id, p.full_name into target_id, target_name
  from auth.users u
  join profiles p on p.id = u.id
  where lower(u.email) = clean_email and p.is_active;

  if target_id is null then
    return;
  end if;

  -- One open request per person is enough.
  if exists (select 1 from password_reset_requests where user_id = target_id and status = 'pending') then
    return;
  end if;

  insert into password_reset_requests (user_id, email, note)
  values (target_id, clean_email, clean_note)
  returning id into new_id;

  insert into notifications (recipient_id, title, body, type, entity_type, entity_id)
  select pr.id,
         'Password reset request',
         target_name || ' (' || clean_email || ') forgot their password. Approve it on Team & access to send a reset link.',
         'password_reset', 'password_reset', new_id
  from profiles pr
  where pr.is_active and pr.role in ('it', 'ceo');
end;
$$;

revoke all on function public.request_password_reset(text, text) from public;
grant execute on function public.request_password_reset(text, text) to anon, authenticated;
