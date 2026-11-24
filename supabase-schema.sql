-- =====================================================================
-- Delta Medical Center & Mother and Child Hospital
-- Reference Supabase SQL Schema & Row-Level Security (RLS) Policies
-- =====================================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  patient_phone text not null,
  doctor_name text not null,
  department text not null,
  appointment_date date not null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

-- 1. Allow public website visitors (anon + authenticated) to submit new serials
drop policy if exists "Public can insert appointments" on public.appointments;
create policy "Public can insert appointments"
  on public.appointments
  for insert
  to anon, authenticated
  with check (true);

-- 2. Allow signed-in reception/admin staff full CRUD access
drop policy if exists "Authenticated staff full access" on public.appointments;
create policy "Authenticated staff full access"
  on public.appointments
  for all
  to authenticated
  using (true)
  with check (true);
