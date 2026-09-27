-- ============================================================================
-- Nelly & Nova — customer records, dog records, documents, waivers, enquiries
-- ============================================================================
-- Run once in Supabase → SQL Editor (or `supabase db push`). Safe to re-run:
-- everything is "if not exists" / "create or replace" / drop-then-create for
-- policies, and it only ADDS to the existing `profiles` and `dogs` tables.
--
-- What it sets up:
--   profiles  + contact details (phone, address, emergency contacts, email)
--   dogs      + full dog record (breed, sex, DOB, microchip, health, vet, notes)
--   dog_documents   vaccination records, signed waivers, other files per dog
--   waivers         each signed consent & waiver (answers + signature)
--   enquiries       contact-form and meet & greet requests (the onboarding list)
--   storage buckets dog-photos (public) and dog-documents (private)
--   RLS: customers see/edit only their own account + dogs; trainers see all;
--        anyone (incl. logged-out visitors) can SUBMIT an enquiry but not read one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Trainer check. SECURITY DEFINER so policies on `profiles` can call it
-- without recursing through their own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.nn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.nn_is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles — the account holder's contact details
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists postcode text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists emergency_contact_1 text;
alter table public.profiles add column if not exists emergency_contact_2 text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Keep a copy of the login email on the profile so trainers can see it
-- (auth.users isn't readable from the app).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

create or replace function public.nn_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or new.email = '' then
    select email into new.email from auth.users where id = new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists nn_profile_email on public.profiles;
create trigger nn_profile_email
  before insert or update on public.profiles
  for each row execute function public.nn_profile_email();

-- Customers may edit their own contact details but never their role.
create or replace function public.nn_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.nn_is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists nn_protect_profile_role on public.profiles;
create trigger nn_protect_profile_role
  before update on public.profiles
  for each row execute function public.nn_protect_profile_role();

alter table public.profiles enable row level security;

drop policy if exists "nn: read own profile" on public.profiles;
create policy "nn: read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: update own profile" on public.profiles;
create policy "nn: update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.nn_is_admin())
  with check (id = auth.uid() or public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- dogs — one row per dog, owned by an account (account_id = auth user id)
-- ---------------------------------------------------------------------------
alter table public.dogs add column if not exists breed text;
alter table public.dogs add column if not exists sex text;
alter table public.dogs add column if not exists date_of_birth date;
alter table public.dogs add column if not exists microchip text;
alter table public.dogs add column if not exists vaccinations_confirmed boolean default false;
alter table public.dogs add column if not exists kennel_cough boolean;
alter table public.dogs add column if not exists medical_conditions text;
alter table public.dogs add column if not exists allergies text;
alter table public.dogs add column if not exists vet_name text;
alter table public.dogs add column if not exists vet_phone text;
alter table public.dogs add column if not exists vet_address text;
alter table public.dogs add column if not exists notes text;
alter table public.dogs add column if not exists waiver_signed_at timestamptz;
alter table public.dogs add column if not exists sort_order integer default 0;
alter table public.dogs add column if not exists created_at timestamptz default now();
alter table public.dogs add column if not exists updated_at timestamptz default now();

create index if not exists dogs_account_id_idx on public.dogs (account_id);

alter table public.dogs enable row level security;

drop policy if exists "nn: read own dogs" on public.dogs;
create policy "nn: read own dogs" on public.dogs
  for select to authenticated using (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: add own dogs" on public.dogs;
create policy "nn: add own dogs" on public.dogs
  for insert to authenticated with check (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: update own dogs" on public.dogs;
create policy "nn: update own dogs" on public.dogs
  for update to authenticated
  using (account_id = auth.uid() or public.nn_is_admin())
  with check (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: trainers delete dogs" on public.dogs;
create policy "nn: trainers delete dogs" on public.dogs
  for delete to authenticated using (public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- dog_documents — files kept against a dog (stored in the dog-documents bucket
-- at {account_id}/{dog_id or "pending"}/{file})
-- ---------------------------------------------------------------------------
create table if not exists public.dog_documents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('vaccination', 'waiver', 'insurance', 'vet', 'other')),
  path text not null,
  file_name text,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists dog_documents_dog_id_idx on public.dog_documents (dog_id);
create index if not exists dog_documents_account_id_idx on public.dog_documents (account_id);

alter table public.dog_documents enable row level security;

drop policy if exists "nn: read own documents" on public.dog_documents;
create policy "nn: read own documents" on public.dog_documents
  for select to authenticated using (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: add own documents" on public.dog_documents;
create policy "nn: add own documents" on public.dog_documents
  for insert to authenticated with check (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: update own documents" on public.dog_documents;
create policy "nn: update own documents" on public.dog_documents
  for update to authenticated
  using (account_id = auth.uid() or public.nn_is_admin())
  with check (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: delete own documents" on public.dog_documents;
create policy "nn: delete own documents" on public.dog_documents
  for delete to authenticated using (account_id = auth.uid() or public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- waivers — each signed Final Consent & Waiver (a legal record: no updates or
-- deletes from the app; sign again to replace)
-- ---------------------------------------------------------------------------
create table if not exists public.waivers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete set null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  signature_path text,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists waivers_dog_id_idx on public.waivers (dog_id);
create index if not exists waivers_account_id_idx on public.waivers (account_id);

alter table public.waivers enable row level security;

drop policy if exists "nn: read own waivers" on public.waivers;
create policy "nn: read own waivers" on public.waivers
  for select to authenticated using (account_id = auth.uid() or public.nn_is_admin());

drop policy if exists "nn: sign own waiver" on public.waivers;
create policy "nn: sign own waiver" on public.waivers
  for insert to authenticated with check (account_id = auth.uid());

-- ---------------------------------------------------------------------------
-- enquiries — every contact-form message and meet & greet request. This is
-- the trainer's onboarding list; the website saves here even if email isn't
-- set up, so no lead is lost.
-- ---------------------------------------------------------------------------
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'booking')),
  status text not null default 'new'
    check (status in ('new', 'meet_greet_booked', 'onboarding', 'closed')),
  name text not null,
  email text not null,
  phone text,
  message text,
  service text,
  dog_names text,
  details jsonb not null default '{}'::jsonb,
  meet_greet_at timestamptz,
  meet_greet_notes text,
  account_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enquiries_status_idx on public.enquiries (status, created_at desc);

alter table public.enquiries enable row level security;

-- Visitors (logged in or not) can submit, but only as a brand-new enquiry.
drop policy if exists "nn: anyone can submit an enquiry" on public.enquiries;
create policy "nn: anyone can submit an enquiry" on public.enquiries
  for insert to anon, authenticated
  with check (status = 'new' and meet_greet_at is null);

drop policy if exists "nn: trainers read enquiries" on public.enquiries;
create policy "nn: trainers read enquiries" on public.enquiries
  for select to authenticated using (public.nn_is_admin());

drop policy if exists "nn: trainers update enquiries" on public.enquiries;
create policy "nn: trainers update enquiries" on public.enquiries
  for update to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());

drop policy if exists "nn: trainers delete enquiries" on public.enquiries;
create policy "nn: trainers delete enquiries" on public.enquiries
  for delete to authenticated using (public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets
--   dog-photos     public read (profile pictures), owner-folder writes
--   dog-documents  PRIVATE — owner folder + trainers only, read via signed URLs
-- Paths always start with the account id: {auth.uid()}/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('dog-documents', 'dog-documents', false, 10485760) -- 10 MB per file
on conflict (id) do nothing;

drop policy if exists "nn: dog photos are public" on storage.objects;
create policy "nn: dog photos are public" on storage.objects
  for select using (bucket_id = 'dog-photos');

drop policy if exists "nn: upload own dog photos" on storage.objects;
create policy "nn: upload own dog photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dog-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.nn_is_admin())
  );

drop policy if exists "nn: replace own dog photos" on storage.objects;
create policy "nn: replace own dog photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'dog-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.nn_is_admin())
  );

drop policy if exists "nn: read own dog documents" on storage.objects;
create policy "nn: read own dog documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dog-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.nn_is_admin())
  );

drop policy if exists "nn: upload own dog documents" on storage.objects;
create policy "nn: upload own dog documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dog-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.nn_is_admin())
  );

drop policy if exists "nn: delete own dog documents" on storage.objects;
create policy "nn: delete own dog documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dog-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.nn_is_admin())
  );
