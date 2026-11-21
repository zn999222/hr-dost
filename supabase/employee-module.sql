-- HR Dost — Employee Self-Service module (additive migration, 2026-11-22)
-- Adds: company_policies + clock_events tables, and "self" RLS policies so an
-- employee who logs in with the same email HR entered for them can see ONLY
-- their own row/record set. No existing table or policy is changed or dropped.
-- Employee link key: employees.email = the login's JWT email (case-insensitive).
-- Employee-created leave/clock rows carry owner_id = the company owner's id,
-- so HR/Admin still sees them through the existing owner-only policies.

-- ============ New tables ============
create table if not exists public.company_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  title text not null,
  category text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists company_policies_company_idx on public.company_policies (company_id);

create table if not exists public.clock_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists clock_events_employee_day_uidx
  on public.clock_events (employee_id, work_date);

alter table public.company_policies enable row level security;
alter table public.clock_events enable row level security;

grant select, insert, update, delete on public.company_policies to anon, authenticated;
grant select, insert, update, delete on public.clock_events to anon, authenticated;

-- ============ Helper: add a policy only if missing ============
-- (plain CREATE POLICY would fail on a retry; DO blocks make this re-runnable)

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_policies' and policyname='company_policies_select_own') then
    create policy company_policies_select_own on public.company_policies for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_policies' and policyname='company_policies_select_employee') then
    create policy company_policies_select_employee on public.company_policies for select using (
      company_id in (select company_id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_policies' and policyname='company_policies_insert_own') then
    create policy company_policies_insert_own on public.company_policies for insert with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_policies' and policyname='company_policies_update_own') then
    create policy company_policies_update_own on public.company_policies for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_policies' and policyname='company_policies_delete_own') then
    create policy company_policies_delete_own on public.company_policies for delete using (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_select_own') then
    create policy clock_events_select_own on public.clock_events for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_select_employee') then
    create policy clock_events_select_employee on public.clock_events for select using (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_insert_own') then
    create policy clock_events_insert_own on public.clock_events for insert with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_insert_employee') then
    create policy clock_events_insert_employee on public.clock_events for insert with check (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
      and owner_id = (select owner_id from public.employees where id = clock_events.employee_id)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_update_own') then
    create policy clock_events_update_own on public.clock_events for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_update_employee') then
    create policy clock_events_update_employee on public.clock_events for update using (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    ) with check (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
      and owner_id = (select owner_id from public.employees where id = clock_events.employee_id)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clock_events' and policyname='clock_events_delete_own') then
    create policy clock_events_delete_own on public.clock_events for delete using (auth.uid() = owner_id);
  end if;

  -- Employee self-read on existing tables (SELECT only; admin policies untouched)
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees_select_self') then
    create policy employees_select_self on public.employees for select using (
      lower(email) = lower((auth.jwt() ->> 'email'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='companies_select_employee') then
    create policy companies_select_employee on public.companies for select using (
      id in (select company_id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attendance' and policyname='attendance_select_self') then
    create policy attendance_select_self on public.attendance for select using (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leave_requests' and policyname='leave_requests_select_self') then
    create policy leave_requests_select_self on public.leave_requests for select using (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payroll_records' and policyname='payroll_records_select_self') then
    create policy payroll_records_select_self on public.payroll_records for select using (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
    );
  end if;

  -- Employee can file their own leave (Pending only; owner_id must be the company owner so HR sees it)
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leave_requests' and policyname='leave_requests_insert_self') then
    create policy leave_requests_insert_self on public.leave_requests for insert with check (
      employee_id in (select id from public.employees where lower(email) = lower((auth.jwt() ->> 'email')))
      and status = 'Pending'
      and owner_id = (select owner_id from public.employees where id = leave_requests.employee_id)
    );
  end if;
end $$;
