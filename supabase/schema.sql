-- REMP (Resilience Estate Management Portal) — Supabase schema
-- Based on PRD section 10 "Core Database Entities"
-- Run this in the Supabase SQL editor, top to bottom, on a fresh project.

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('ceo', 'management', 'sales', 'marketing', 'finance', 'it');
create type project_status as enum ('upcoming', 'off_plan', 'under_construction', 'completed');
create type unit_availability as enum ('available', 'reserved', 'sold', 'unavailable');
create type lead_stage as enum ('new', 'contacted', 'qualified', 'viewing_scheduled', 'negotiation', 'sale', 'after_sales');
create type lead_source as enum ('website', 'instagram', 'facebook', 'tiktok', 'referral', 'walk_in', 'advertisement', 'other');
create type viewing_status as enum ('requested', 'confirmed', 'completed', 'cancelled', 'no_show');
create type payment_status as enum ('pending', 'partial', 'paid', 'overdue');

-- ============================================================
-- USERS, ROLES, DEPARTMENTS
-- profiles extends Supabase's built-in auth.users
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null,
  department text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS & UNITS
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  location text,
  map_lat double precision,
  map_lng double precision,
  status project_status not null default 'upcoming',
  construction_progress smallint not null default 0 check (construction_progress between 0 and 100),
  expected_completion date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_code text not null,
  unit_type text,
  bedrooms smallint,
  bathrooms smallint,
  floor_area_sqm numeric,
  price numeric not null,
  availability unit_availability not null default 'available',
  payment_plan text,
  features text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, unit_code)
);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image', -- image | video | floor_plan | brochure
  caption text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (project_id is not null or unit_id is not null)
);

create table public.construction_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  notes text,
  progress_percent smallint check (progress_percent between 0 and 100),
  storage_path text, -- optional progress photo
  posted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- CRM: CLIENTS, LEADS, ACTIVITIES, VIEWINGS
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  location text,
  budget numeric,
  preferred_project_id uuid references public.projects(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  stage lead_stage not null default 'new',
  source lead_source not null default 'other',
  assigned_agent uuid references public.profiles(id),
  interest_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null, -- call | email | whatsapp | note | stage_change
  notes text,
  performed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id),
  unit_id uuid references public.units(id),
  assigned_agent uuid references public.profiles(id),
  scheduled_at timestamptz not null,
  status viewing_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SALES & PAYMENTS
-- ============================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  unit_id uuid not null references public.units(id),
  agent_id uuid references public.profiles(id),
  sale_price numeric not null,
  sale_date date not null default current_date,
  payment_status payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric not null,
  due_date date,
  paid_date date,
  status payment_status not null default 'pending',
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- MARKETING: CAMPAIGNS & CONTENT
-- ============================================================
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text, -- instagram | facebook | tiktok | linkedin
  project_id uuid references public.projects(id),
  budget numeric,
  leads_generated integer not null default 0,
  reach integer not null default 0,
  engagements integer not null default 0,
  starts_on date,
  ends_on date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  title text not null,
  content_type text, -- description | price_sheet | photo | video | brochure | floor_plan
  storage_path text,
  approved boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTS, NOTIFICATIONS, AUDIT LOG
-- ============================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  folder text not null default 'general', -- project_documents | sales_contracts | marketing_assets | company_docs
  project_id uuid references public.projects(id),
  storage_path text not null,
  file_size_bytes bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Baseline: every authenticated staff member can read most business data.
-- Writes are scoped by role. Tighten further per-department as needed.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.units enable row level security;
alter table public.property_media enable row level security;
alter table public.construction_updates enable row level security;
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.viewings enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.campaigns enable row level security;
alter table public.marketing_content enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: current user's role
create or replace function public.current_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- profiles: everyone can read all staff profiles; only IT/CEO can edit others; users can edit their own
create policy "profiles are readable by any staff" on public.profiles
  for select using (auth.uid() is not null);
create policy "users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "it and ceo can manage profiles" on public.profiles
  for all using (public.current_role() in ('it', 'ceo'));

-- Generic staff-read policy for core business tables
create policy "staff can read projects" on public.projects for select using (auth.uid() is not null);
create policy "staff can read units" on public.units for select using (auth.uid() is not null);
create policy "staff can read media" on public.property_media for select using (auth.uid() is not null);
create policy "staff can read construction updates" on public.construction_updates for select using (auth.uid() is not null);
create policy "staff can read clients" on public.clients for select using (auth.uid() is not null);
create policy "staff can read leads" on public.leads for select using (auth.uid() is not null);
create policy "staff can read lead activities" on public.lead_activities for select using (auth.uid() is not null);
create policy "staff can read viewings" on public.viewings for select using (auth.uid() is not null);
create policy "staff can read sales" on public.sales for select using (auth.uid() is not null);
create policy "staff can read payments" on public.payments for select using (auth.uid() is not null);
create policy "staff can read campaigns" on public.campaigns for select using (auth.uid() is not null);
create policy "staff can read marketing content" on public.marketing_content for select using (auth.uid() is not null);
create policy "staff can read documents" on public.documents for select using (auth.uid() is not null);

-- Write policies scoped by role (management/it can manage most things; sales manages CRM; marketing manages content)
create policy "management/it manage projects" on public.projects for all using (public.current_role() in ('ceo','management','it'));
create policy "management/it manage units" on public.units for all using (public.current_role() in ('ceo','management','it'));
create policy "management/it manage construction updates" on public.construction_updates for all using (public.current_role() in ('ceo','management','it'));
create policy "management/it manage media" on public.property_media for all using (public.current_role() in ('ceo','management','it','marketing'));

create policy "sales manage clients" on public.clients for all using (public.current_role() in ('ceo','management','sales','it'));
create policy "sales manage leads" on public.leads for all using (public.current_role() in ('ceo','management','sales','it'));
create policy "sales manage lead activities" on public.lead_activities for all using (public.current_role() in ('ceo','management','sales','it'));
create policy "sales manage viewings" on public.viewings for all using (public.current_role() in ('ceo','management','sales','it'));

create policy "finance manage sales" on public.sales for all using (public.current_role() in ('ceo','management','finance','it'));
create policy "finance manage payments" on public.payments for all using (public.current_role() in ('ceo','management','finance','it'));

create policy "marketing manage campaigns" on public.campaigns for all using (public.current_role() in ('ceo','management','marketing','it'));
create policy "marketing manage content" on public.marketing_content for all using (public.current_role() in ('ceo','management','marketing','it'));

create policy "staff manage documents" on public.documents for all using (auth.uid() is not null);

-- notifications & audit logs: private to the user / read-only for staff
create policy "users read own notifications" on public.notifications
  for select using (auth.uid() = recipient_id);
create policy "users update own notifications" on public.notifications
  for update using (auth.uid() = recipient_id);
create policy "system inserts notifications" on public.notifications
  for insert with check (auth.uid() is not null);

create policy "staff read audit logs" on public.audit_logs for select using (auth.uid() is not null);
create policy "staff write audit logs" on public.audit_logs for insert with check (auth.uid() is not null);

-- ============================================================
-- Auto-create a profile row whenever a new auth user signs up
-- (role defaults to 'sales' — an admin should update it after invite)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'sales');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
