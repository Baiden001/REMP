-- Allow every active, authenticated staff member to edit and delete
-- projects and units. Existing read permissions remain unchanged.

-- Remove the previous role-restricted project policies.
drop policy if exists "ceo and it manage projects" on public.projects;
drop policy if exists "ceo and it delete projects" on public.projects;

-- Remove the previous role-restricted unit policy.
drop policy if exists "management/it manage units" on public.units;

-- Projects: all active staff can update.
create policy "active staff update projects"
on public.projects
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);

-- Projects: all active staff can delete.
create policy "active staff delete projects"
on public.projects
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);

-- Units: all active staff can update.
create policy "active staff update units"
on public.units
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);

-- Units: all active staff can delete.
create policy "active staff delete units"
on public.units
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);
