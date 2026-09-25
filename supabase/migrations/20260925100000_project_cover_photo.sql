-- Projects can pick which photo is shown on their card.
-- Deliberately no foreign key: a second link between projects and
-- property_media makes PostgREST embeds like projects -> property_media(...)
-- ambiguous and they fail. The app falls back to the newest photo if the
-- cover photo no longer exists.
alter table public.projects
  add column if not exists cover_media_id uuid;
