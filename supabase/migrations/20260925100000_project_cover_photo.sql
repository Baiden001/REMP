-- Projects can pick which photo is shown on their card.
alter table public.projects
  add column if not exists cover_media_id uuid references public.property_media(id) on delete set null;
