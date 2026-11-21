// Dost Chat — deterministic answers computed ONLY from live Supabase data.
// No language model, no guessing: every number comes from the tables passed
// in. If the data is not there, the answer says so plainly.
// Understands English and Roman Urdu keywords (kitne, kon, kis, chhutti,
// hazri, salary, aaj, dikhao, batao, list).

export function formatPKR(n) {
  const v = Number(n) || 0
  return 'Rs ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 })
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  })
}

const MONTHS = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9,
  sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
}

function todayPKT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
}

function empRows(list) {
  return list.map((e) => [
    e.full_name,
    e.department || '—',
    e.job_title || '—',
    formatPKR(e.salary_pkr),
    formatDate(e.hire_date),
    e.is_active ? 'Active' : 'Inactive',
  ])
}

// data: { employees, attendance, leaveRequests, payroll, companyName }
// Returns { text, table?: { headers, rows }, note? }
export function answerQuestion(raw, data) {
  const q = (raw || '').toLowerCase().trim()
  const { employees = [], attendance = [], leaveRequests = [], payroll = [] } = data
  const active = employees.filter((e) => e.is_active)
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]))
  const nameOf = (id) => byId[id]?.full_name || 'Unknown employee'
  const empty = (what) => ({
    text: `${what} — abhi aap ke data mein kuch nahi hai. Pehle ${what.toLowerCase()} add karein, phir main yahan se jawab doon ga. I only answer from data you have entered; I never invent figures.`,
  })
  if (!q) return { text: 'Sawal likhein — jaise "kitne employees hain?" ya "aaj kon absent hai?"' }
  if (!employees.length) {
    return empty('Employees')
  }

  const has = (...words) => words.some((w) => q.includes(w))
  const deptMatch = employees
    .map((e) => (e.department || '').toLowerCase())
    .filter(Boolean)
    .find((d) => d && q.includes(d))
  const nameMatch = employees.find((e) => q.includes(e.full_name.toLowerCase()))

  // ---- Payroll for a month ----
  if (has('payroll', 'tankhwah', 'salary month', 'pay month')) {
    const year = (q.match(/\b(20\d{2})\b/) || [])[1]
    const monthName = Object.keys(MONTHS).find((m) => q.includes(m))
    const monthNum = monthName ? MONTHS[monthName] : null
    let rows = payroll
    if (year || monthNum) {
      rows = payroll.filter((p) => {
        const d = new Date(p.pay_month)
        return (!year || d.getUTCFullYear() === Number(year)) &&
          (!monthNum || d.getUTCMonth() + 1 === monthNum)
      })
    }
    if (!rows.length) {
      return { text: `Is mahine ki payroll abhi generate nahi hui. Payroll tab mein month select kar ke "Generate payroll" dabayein, phir poochhein. No payroll records found${monthName ? ` for ${monthName}${year ? ' ' + year : ''}` : ''}.` }
    }
    const total = rows.reduce((s, p) => s + (Number(p.net_salary) || 0), 0)
    return {
      text: `Payroll — ${rows.length} employees, total net ${formatPKR(total)}. Gross aur net dono yahan live payroll records se liye gaye hain.`,
      table: {
        headers: ['Employee', 'Pay month', 'Gross (PKR)', 'Net (PKR)'],
        rows: rows.map((p) => [nameOf(p.employee_id), formatDate(p.pay_month), formatPKR(p.gross_salary), formatPKR(p.net_salary)]),
      },
    }
  }

  // ---- Leave ----
  if (has('leave', 'chhutti', 'chutti', 'on leave', 'vacation')) {
    if (has('pending', 'pending hain', 'approve')) {
      const pending = leaveRequests.filter((l) => l.status === 'Pending')
      if (!pending.length) return { text: 'Koi pending leave request nahi hai. All leave requests have been decided.' }
      return {
        text: `${pending.length} pending leave request(s) hain:`,
        table: {
          headers: ['Employee', 'Type', 'From', 'To', 'Status'],
          rows: pending.map((l) => [nameOf(l.employee_id), l.leave_type || '—', formatDate(l.start_date), formatDate(l.end_date), l.status]),
        },
      }
    }
    const approved = leaveRequests.filter((l) => l.status === 'Approved')
    if (!approved.length) return { text: 'Koi approved leave record nahi hai. No one is recorded as on approved leave.' }
    return {
      text: `Approved leave par ${approved.length} request(s) hain:`,
      table: {
        headers: ['Employee', 'Type', 'From', 'To', 'Status'],
        rows: approved.map((l) => [nameOf(l.employee_id), l.leave_type || '—', formatDate(l.start_date), formatDate(l.end_date), l.status]),
      },
    }
  }

  // ---- Attendance today ----
  if (has('attendance', 'hazri', 'hazir', 'present', 'absent', 'aaj kon', 'aaj kaun')) {
    const today = todayPKT()
    const todays = attendance.filter((a) => a.work_date === today)
    if (!todays.length) {
      return { text: `Aaj (${formatDate(today)}) ki attendance abhi mark nahi hui. Attendance tab mein aaj ki hazri mark karein, phir poochhein. No attendance records for today yet.` }
    }
    const present = todays.filter((a) => a.status === 'Present')
    const absent = todays.filter((a) => a.status === 'Absent')
    if (has('absent')) {
      return {
        text: absent.length ? `Aaj absent: ${absent.length} employee(s).` : 'Aaj koi absent nahi hai — sab present ya recorded status ke mutabiq hain.',
        table: absent.length ? { headers: ['Employee', 'Status', 'Date'], rows: absent.map((a) => [nameOf(a.employee_id), a.status, formatDate(a.work_date)]) } : undefined,
      }
    }
    return {
      text: `Aaj (${formatDate(today)}) — Present: ${present.length}, Absent: ${absent.length}, total marked: ${todays.length} of ${active.length} active employees.`,
      table: {
        headers: ['Employee', 'Status', 'Date'],
        rows: todays.map((a) => [nameOf(a.employee_id), a.status, formatDate(a.work_date)]),
      },
    }
  }

  // ---- Salary ----
  if (has('salary', 'tankhwah', 'pay', 'kitni salary')) {
    const withSalary = active.filter((e) => e.salary_pkr != null)
    if (!withSalary.length) return empty('Salaries')
    const total = withSalary.reduce((s, e) => s + Number(e.salary_pkr || 0), 0)
    const avg = total / withSalary.length
    const sorted = [...withSalary].sort((a, b) => Number(b.salary_pkr) - Number(a.salary_pkr))
    if (has('highest', 'sab se zyada', 'sabse zyada', 'zyada', 'top', 'max')) {
      const top = sorted[0]
      return { text: `Sab se zyada salary: ${top.full_name} — ${formatPKR(top.salary_pkr)} (${top.job_title || ''}, ${top.department || ''}).` }
    }
    if (has('lowest', 'sab se kam', 'sabse kam', 'kam', 'min')) {
      const low = sorted[sorted.length - 1]
      return { text: `Sab se kam salary: ${low.full_name} — ${formatPKR(low.salary_pkr)} (${low.job_title || ''}, ${low.department || ''}).` }
    }
    if (has('average', 'average', 'ausat', 'avg')) {
      return { text: `Average salary: ${formatPKR(avg)} per month — ${withSalary.length} active employees ki salaries se calculate ki gayi hai. Total monthly salary bill: ${formatPKR(total)}.` }
    }
    return {
      text: `Total monthly salary bill: ${formatPKR(total)} (${withSalary.length} active employees). Average: ${formatPKR(avg)}.`,
      table: {
        headers: ['Employee', 'Department', 'Job title', 'Salary (PKR)'],
        rows: sorted.map((e) => [e.full_name, e.department || '—', e.job_title || '—', formatPKR(e.salary_pkr)]),
      },
    }
  }

  // ---- Department ----
  if (has('department', 'dept', 'department mein', 'kis department')) {
    if (deptMatch) {
      const list = employees.filter((e) => (e.department || '').toLowerCase() === deptMatch)
      return {
        text: `${deptMatch} department mein ${list.length} employee(s) hain:`,
        table: { headers: ['Employee', 'Department', 'Job title', 'Salary (PKR)', 'Hire date', 'Status'], rows: empRows(list) },
      }
    }
    const counts = {}
    employees.forEach((e) => { const d = e.department || 'No department'; counts[d] = (counts[d] || 0) + 1 })
    return {
      text: `Departments — ${Object.keys(counts).length} department(s), kul ${employees.length} employees:`,
      table: { headers: ['Department', 'Employees'], rows: Object.entries(counts).sort((a, b) => b[1] - a[1]) },
    }
  }

  // ---- Headcount ----
  if (has('how many', 'kitne', 'kitni', 'total employees', 'headcount', 'count', 'kul kitne', 'employees hain')) {
    return {
      text: `Kul ${employees.length} employees hain — ${active.length} active aur ${employees.length - active.length} inactive.`,
      table: { headers: ['Employee', 'Department', 'Job title', 'Salary (PKR)', 'Hire date', 'Status'], rows: empRows(employees) },
    }
  }

  // ---- List employees ----
  if (has('list', 'dikhao', 'show', 'sab employees', 'all employees', 'list karo')) {
    return {
      text: `Yeh aap ke ${employees.length} employees hain (live data se):`,
      table: { headers: ['Employee', 'Department', 'Job title', 'Salary (PKR)', 'Hire date', 'Status'], rows: empRows(employees) },
    }
  }

  // ---- Specific employee by name ----
  if (nameMatch) {
    const e = nameMatch
    const leaves = leaveRequests.filter((l) => l.employee_id === e.id)
    const att = attendance.filter((a) => a.employee_id === e.id)
    return {
      text: `${e.full_name} — ${e.job_title || 'No job title'} (${e.department || 'No department'}). Salary: ${formatPKR(e.salary_pkr)}. Hire date: ${formatDate(e.hire_date)}. Status: ${e.is_active ? 'Active' : 'Inactive'}. Email: ${e.email || '—'}. Leave requests: ${leaves.length}, attendance records: ${att.length}.`,
    }
  }

  // ---- Newest / oldest hire ----
  if (has('newest', 'latest', 'naya', 'recently joined', 'oldest', 'pehle se')) {
    const dated = employees.filter((e) => e.hire_date)
    if (!dated.length) return { text: 'Kisi employee ki hire date enter nahi hui, is liye newest/oldest nahi bata sakta. Add hire dates first.' }
    const sorted = [...dated].sort((a, b) => new Date(b.hire_date) - new Date(a.hire_date))
    const pick = has('oldest', 'pehle se') ? sorted[sorted.length - 1] : sorted[0]
    return { text: `${has('oldest', 'pehle se') ? 'Sab se purana' : 'Sab se naya'} employee: ${pick.full_name} — hired ${formatDate(pick.hire_date)} (${pick.department || ''}, ${pick.job_title || ''}).` }
  }

  // ---- Fallback: honest, with examples ----
  return {
    text: `Is sawal ka jawab aap ke live data se nahi nikal sakta — main andaza nahi lagata. I can answer from your entered data. Try one of these:\n• "Kitne employees hain?"\n• "Sales department mein kon hai?"\n• "Total salary kitni hai?" / "Average salary kya hai?"\n• "Aaj kon absent hai?"\n• "Pending leave requests dikhao"\n• "November 2026 ki payroll kitni hai?"\n• "Ahmed ki salary kya hai?" (kisi employee ka naam likhein)`,
  }
}

export const EXAMPLE_QUESTIONS = [
  'Kitne employees hain?',
  'Total salary kitni hai?',
  'Sales department mein kon hai?',
  'Aaj kon absent hai?',
  'Pending leave requests dikhao',
  'November 2026 ki payroll kitni hai?',
]
