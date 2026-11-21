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
- **AI Chat (Dost Chat):** deterministic answers computed from the live tables —
  headcount, department breakdown, salary totals / average / highest, today's
  attendance, who is on leave, pending leave, payroll for a month, and
  employee lookup by name or department. English and Roman Urdu understood.
  Chat history is kept in the browser session only — the backend plan's
  `chat_messages` table was not created (its `role` column was rejected as
  unsafe), so nothing is written there.

## Roles (day one)

The workspace owner is the Company Admin / CEO. The approved backend plan
expressly limits sharing: cross-user company access cannot be safely expressed
with `owner_id` alone, so a second user cannot yet see the same company — that
needs a future membership / role table and review before enabling. The app
says this honestly in Settings instead of pretending multi-user roles exist.

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
