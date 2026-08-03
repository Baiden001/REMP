-- Run this AFTER schema.sql, in the Supabase SQL editor.
-- Creates a public storage bucket for project/unit photos, floor plans, brochures, etc.

insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do nothing;

-- Any signed-in staff member can upload
create policy "staff can upload property media"
  on storage.objects for insert
  with check (bucket_id = 'property-media' and auth.uid() is not null);

-- Anyone can view (bucket is public — images need to load on the site without auth)
create policy "anyone can view property media"
  on storage.objects for select
  using (bucket_id = 'property-media');

-- Staff can delete their own uploads (or extend this to roles if you prefer)
create policy "staff can delete property media"
  on storage.objects for delete
  using (bucket_id = 'property-media' and auth.uid() is not null);
