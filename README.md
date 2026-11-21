# HR Dost — Apne employees, ek jagah. Sawal poochho, jawab pao.

Multi-tenant HR SaaS for Pakistani companies (10–500 employees). One company
signs up, creates its workspace, and manages employees, attendance, leave and
payroll in PKR — then asks questions in plain English or Roman Urdu in the AI
chat, and gets answers from live data only. HR Dost never invents an answer:
if the data is not entered yet, it says so.

## What is inside

- **Auth:** Supabase Auth — sign up (email + password + display name), log in,
  log out, session kept in sync with `onAuthStateChange`.
- **Workspace:** each signed-in user creates their company (the tenant).
  All rows carry `owner_id`, protected by row-level security.
- **Employees:** name, email, department, job title, salary in PKR, hire date,
  active / inactive.
- **Attendance:** daily Present / Absent / Late / On Leave per employee.
- **Leave:** requests with dates, type and Pending / Approved / Rejected status.
- **Payroll:** monthly payroll per employee in PKR (gross = salary, net = salary;
  no tax/EOBI deduction is calculated — check before paying).
- **Employee module (My HR):** an employee logs in with the same email HR
  entered for them and gets a self-service portal — company policies, their
  salary and payroll, their leaves (plus filing a new leave request, which
  lands with HR as Pending), their attendance, and clock in / out with PKT
  times and hours worked. Backend: `company_policies` and `clock_events`
  tables, plus "self" RLS policies on employees / companies / attendance /
  leave_requests / payroll_records keyed on the login's email, so an employee
  sees only their own records and a stranger sees nothing. Employee-filed
  leave and clock rows carry the company owner's id, so HR still sees them.
  HR manages policies in the Policies tab (with starter templates) and sees
  the day's clock ins/outs on the Attendance tab.
- **AI Chat (Dost Chat):** deterministic answers computed from the live tables —
  headcount, department breakdown, salary totals / average / highest, today's
  attendance, who is on leave, pending leave, payroll for a month, and
  employee lookup by name or department. English and Roman Urdu understood.
  Chat history is kept in the browser session only — the backend plan's
  `chat_messages` table was not created (its `role` column was rejected as
  unsafe), so nothing is written there.

## Roles (day one)

The workspace owner is the Company Admin / CEO. **Employees** can now log in
with their own account (same email HR entered for them) and see only their
own records in My HR — never another employee's, and never the company-wide
HR views. That sharing is expressed safely through the email-keyed "self" RLS
policies (verified: a stranger sees 0 rows, an employee sees only their own).
A second HR officer still cannot yet see the same company — that needs a
future membership / role table and review before enabling. The app says this
honestly in Settings instead of pretending multi-user roles exist.

## Stack

React + Vite, `@supabase/supabase-js` (single shared client in
`src/supabaseClient.js`). Supabase project `aeqkzgekrzbytbmkfbqb`,
tables: `profiles`, `companies`, `employees`, `attendance`,
`leave_requests`, `payroll_records`. Dates shown as DD MMM YYYY, times PKT.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Deployed on Vercel from this repo.
