import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { answerQuestion, EXAMPLE_QUESTIONS, formatDate, formatPKR } from './chat'

const TODAY_PKT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
const VIEWS = [
  ['dashboard', 'Dashboard'],
  ['employees', 'Employees'],
  ['attendance', 'Attendance'],
  ['leave', 'Leave'],
  ['payroll', 'Payroll'],
  ['chat', 'Dost Chat'],
  ['settings', 'Settings'],
]

// ---------------- Auth ----------------

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || undefined } },
        })
        if (signUpError) throw signUpError
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: displayName.trim() || null,
          })
        }
        setInfo(data.session ? 'Account created — welcome!' : 'Account created. Check your email to confirm it, then log in.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo">HD</div>
        <h1>HR Dost</h1>
        <p className="tagline">Apne employees, ek jagah. Sawal poochho, jawab pao.</p>
        <ul className="hero-points">
          <li>Employees, attendance, leave aur payroll — sab ek jagah, PKR mein.</li>
          <li>CEO / HR sawal poochhe English ya Roman Urdu mein — jawab live data se, table aur cards mein.</li>
          <li>HR Dost kabhi andaza nahi lagata: data nahi hai to seedha keh deta hai.</li>
          <li>Pakistani companies (10–500 employees) ke liye banaya gaya. Dates DD MMM YYYY, time PKT.</li>
        </ul>
        <p className="muted small">No spreadsheets. No filters to dig through. Data ek dafa enter karein, phir chat mein poochhein.</p>
      </div>
      <div className="auth-card">
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setInfo('') }}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Sign up</button>
        </div>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>Display name
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </label>
          )}
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.pk" autoComplete="email" />
          </label>
          <label>Password
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
        <p className="fine-print">Your company's data is private — row-level security means only you can see your workspace.</p>
      </div>
    </div>
  )
}

// ---------------- Shared bits ----------------

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function DataTable({ headers, rows, emptyText }) {
  if (!rows || rows.length === 0) return <p className="muted empty">{emptyText || 'No records yet.'}</p>
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------- App ----------------

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [view, setView] = useState('dashboard')
  const [companies, setCompanies] = useState([])
  const [companyId, setCompanyId] = useState(null)
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [payroll, setPayroll] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // employee form
  const [empForm, setEmpForm] = useState({ full_name: '', email: '', department: '', job_title: '', salary_pkr: '', hire_date: '' })
  // attendance
  const [attDate, setAttDate] = useState(TODAY_PKT())
  const [attDraft, setAttDraft] = useState({})
  // leave form
  const [leaveForm, setLeaveForm] = useState({ employee_id: '', start_date: '', end_date: '', leave_type: 'Annual', status: 'Pending' })
  // payroll
  const [payMonth, setPayMonth] = useState(() => TODAY_PKT().slice(0, 7))
  // company form
  const [companyName, setCompanyName] = useState('')
  // chat
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState([
    { role: 'dost', text: 'Assalam-o-Alaikum! Main HR Dost hoon. Apne employees ke baare mein kuch bhi poochhein — main jawab sirf aap ke live data se doon ga, andaza nahi lagaoon ga. Try karein: "Kitne employees hain?" ya "Aaj kon absent hai?"' },
  ])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadCompanies = useCallback(async () => {
    const { data, error: e } = await supabase.from('companies').select('id, name, created_at').order('created_at', { ascending: true })
    if (e) { setError(e.message); return [] }
    setCompanies(data ?? [])
    return data ?? []
  }, [])

  const loadAll = useCallback(async (cid) => {
    if (!cid) return
    setLoading(true)
    const [emp, att, lea, pay] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', cid).order('full_name'),
      supabase.from('attendance').select('*').order('work_date', { ascending: false }).limit(500),
      supabase.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('payroll_records').select('*').order('pay_month', { ascending: false }).limit(500),
    ])
    if (emp.error) setError(emp.error.message)
    setEmployees(emp.data ?? [])
    setAttendance(att.data ?? [])
    setLeaveRequests(lea.data ?? [])
    setPayroll(pay.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) { setCompanies([]); setCompanyId(null); setEmployees([]); return }
    loadCompanies().then((list) => { if (list.length > 0) setCompanyId(list[0].id) })
  }, [user, loadCompanies])

  useEffect(() => { if (companyId) loadAll(companyId) }, [companyId, loadAll])

  const company = useMemo(() => companies.find((c) => c.id === companyId) ?? null, [companies, companyId])
  const activeEmps = useMemo(() => employees.filter((e) => e.is_active), [employees])
  const empById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])
  const salaryTotal = useMemo(() => activeEmps.reduce((s, e) => s + (Number(e.salary_pkr) || 0), 0), [activeEmps])
  const pendingLeave = useMemo(() => leaveRequests.filter((l) => l.status === 'Pending'), [leaveRequests])
  const todayAtt = useMemo(() => attendance.filter((a) => a.work_date === TODAY_PKT()), [attendance])
  const deptCounts = useMemo(() => {
    const m = {}
    employees.forEach((e) => { const d = e.department || 'No department'; m[d] = (m[d] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [employees])

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 4000) }

  async function handleCreateCompany(e) {
    e.preventDefault()
    const name = companyName.trim()
    if (!name || !user) return
    setError('')
    const { data, error: err } = await supabase.from('companies').insert({ name, owner_id: user.id }).select('id, name, created_at').single()
    if (err) { setError(err.message); return }
    setCompanies((p) => [...p, data]); setCompanyId(data.id); setCompanyName('')
    flash(`Workspace "${name}" ban gaya — ab employees add karein.`)
  }

  async function handleAddEmployee(e) {
    e.preventDefault()
    if (!empForm.full_name.trim() || !user || !companyId) return
    setError('')
    const { data, error: err } = await supabase.from('employees').insert({
      full_name: empForm.full_name.trim(),
      email: empForm.email.trim() || null,
      department: empForm.department.trim() || null,
      job_title: empForm.job_title.trim() || null,
      salary_pkr: empForm.salary_pkr ? Number(empForm.salary_pkr) : null,
      hire_date: empForm.hire_date || null,
      is_active: true,
      owner_id: user.id,
      company_id: companyId,
    }).select('*').single()
    if (err) { setError(err.message); return }
    setEmployees((p) => [...p, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setEmpForm({ full_name: '', email: '', department: '', job_title: '', salary_pkr: '', hire_date: '' })
    flash(`${data.full_name} add ho gaye.`)
  }

  async function handleToggleActive(emp) {
    const { error: err } = await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    if (err) { setError(err.message); return }
    setEmployees((p) => p.map((e) => (e.id === emp.id ? { ...e, is_active: !e.is_active } : e)))
  }

  async function handleDeleteEmployee(emp) {
    if (!window.confirm(`Delete ${emp.full_name}? Their attendance, leave and payroll records stay in the database.`)) return
    const { error: err } = await supabase.from('employees').delete().eq('id', emp.id)
    if (err) { setError(err.message); return }
    setEmployees((p) => p.filter((e) => e.id !== emp.id))
  }

  async function handleSaveAttendance() {
    if (!user) return
    setError('')
    const entries = Object.entries(attDraft)
    if (!entries.length) { setError('Pehle kisi employee ka status select karein.'); return }
    for (const [empId, status] of entries) {
      const existing = attendance.find((a) => a.employee_id === empId && a.work_date === attDate)
      if (existing) {
        const { error: err } = await supabase.from('attendance').update({ status }).eq('id', existing.id)
        if (err) { setError(err.message); return }
      } else {
        const { error: err } = await supabase.from('attendance').insert({ employee_id: empId, work_date: attDate, status, owner_id: user.id })
        if (err) { setError(err.message); return }
      }
    }
    setAttDraft({})
    await loadAll(companyId)
    flash(`Attendance saved for ${formatDate(attDate)} — ${entries.length} record(s).`)
  }

  async function handleAddLeave(e) {
    e.preventDefault()
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date || !user) return
    setError('')
    const { data, error: err } = await supabase.from('leave_requests').insert({
      employee_id: leaveForm.employee_id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      leave_type: leaveForm.leave_type,
      status: 'Pending',
      owner_id: user.id,
    }).select('*').single()
    if (err) { setError(err.message); return }
    setLeaveRequests((p) => [data, ...p])
    setLeaveForm({ employee_id: '', start_date: '', end_date: '', leave_type: 'Annual', status: 'Pending' })
    flash('Leave request submit ho gayi (Pending).')
  }

  async function handleLeaveStatus(id, status) {
    const { error: err } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (err) { setError(err.message); return }
    setLeaveRequests((p) => p.map((l) => (l.id === id ? { ...l, status } : l)))
  }

  async function handleGeneratePayroll() {
    if (!user || !payMonth) return
    setError('')
    const monthDate = payMonth + '-01'
    const existing = payroll.filter((p) => p.pay_month === monthDate)
    const missing = activeEmps.filter((e) => !existing.some((p) => p.employee_id === e.id))
    if (!missing.length) { flash('Is mahine ki payroll pehle se generate hui hui hai.'); return }
    if (!missing.some((e) => e.salary_pkr != null)) {
      setError('In employees ki salary enter nahi hui — pehle Employees tab mein salary add karein.')
      return
    }
    const rows = missing
      .filter((e) => e.salary_pkr != null)
      .map((e) => ({ employee_id: e.id, pay_month: monthDate, gross_salary: Number(e.salary_pkr), net_salary: Number(e.salary_pkr), owner_id: user.id }))
    const { data, error: err } = await supabase.from('payroll_records').insert(rows).select('*')
    if (err) { setError(err.message); return }
    setPayroll((p) => [...(data ?? []), ...p])
    flash(`Payroll generated for ${payMonth} — ${rows.length} employee(s). Gross = net = salary; koi tax/EOBI deduction calculate nahi hui.`)
  }

  async function handleDeletePayroll(id) {
    const { error: err } = await supabase.from('payroll_records').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setPayroll((p) => p.filter((r) => r.id !== id))
  }

  function handleAsk(text) {
    const q = (text ?? chatInput).trim()
    if (!q) return
    const answer = answerQuestion(q, { employees, attendance, leaveRequests, payroll, companyName: company?.name })
    setChatLog((p) => [...p, { role: 'user', text: q }, { role: 'dost', text: answer.text, table: answer.table }])
    setChatInput('')
  }

  async function handleLogout() { await supabase.auth.signOut() }

  if (!authReady) {
    return <div className="loading-screen"><div className="logo">HD</div><p>Loading HR Dost…</p></div>
  }
  if (!user) return <AuthScreen />

  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'there'

  if (!company) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand"><span className="logo small">HD</span><span className="brand-name">HR Dost</span></div>
          <div className="user-box"><span className="user-email">{displayName} · {user.email}</span><button type="button" className="ghost" onClick={handleLogout}>Log out</button></div>
        </header>
        <main className="setup-wrap">
          <div className="setup-card">
            <h2>Apni company ka workspace banayein</h2>
            <p className="muted">Aap Company Admin / CEO hain. Company ka naam likhein — is ke baad employees, attendance, leave aur payroll isi workspace mein manage honge.</p>
            {error && <p className="error">{error}</p>}
            <form onSubmit={handleCreateCompany} className="inline-form">
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name — jaise Apna Furniture (Pvt) Ltd" aria-label="Company name" maxLength={120} />
              <button type="submit" className="primary" disabled={!companyName.trim()}>Create workspace</button>
            </form>
            <p className="muted small">Aap ki company ka data sirf aap ko nazar aata hai — row-level security ke zariye.</p>
          </div>
        </main>
      </div>
    )
  }

  const monthPayroll = payroll.filter((p) => p.pay_month?.startsWith(payMonth))
  const monthTotal = monthPayroll.reduce((s, p) => s + (Number(p.net_salary) || 0), 0)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo small">HD</span><span className="brand-name">HR Dost</span><span className="company-chip">{company.name}</span></div>
        <div className="user-box">
          <span className="user-email" title={user.email}>{displayName} · Admin / CEO · {user.email}</span>
          <button type="button" className="ghost" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      {error && <p className="error banner" role="alert">{error} <button type="button" onClick={() => setError('')}>Dismiss</button></p>}
      {notice && <p className="info banner" role="status">{notice}</p>}

      <nav className="nav" aria-label="Sections">
        {VIEWS.map(([key, label]) => (
          <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
        ))}
      </nav>

      <main className="main">
        {loading && <p className="muted">Loading live data…</p>}

        {view === 'dashboard' && (
          <section>
            <h2>Dashboard — {company.name}</h2>
            <p className="muted">Live data, aaj {formatDate(TODAY_PKT())} (PKT). Sab figures aap ke enter kiye gaye data se hain.</p>
            <div className="stats">
              <Stat label="Total employees" value={employees.length} sub={`${activeEmps.length} active · ${employees.length - activeEmps.length} inactive`} />
              <Stat label="Monthly salary bill" value={formatPKR(salaryTotal)} sub="Active employees ki salaries ka total" />
              <Stat label="Departments" value={deptCounts.length} sub={deptCounts[0] ? `${deptCounts[0][0]} — sab se bara (${deptCounts[0][1]})` : 'Abhi koi department nahi'} />
              <Stat label="Pending leave" value={pendingLeave.length} sub="Requests jo approve/reject honi hain" />
              <Stat label="Attendance today" value={`${todayAtt.filter((a) => a.status === 'Present').length} present`} sub={`${todayAtt.length} marked of ${activeEmps.length} active`} />
            </div>
            <div className="two-col">
              <div className="card">
                <h3>Department breakdown</h3>
                <DataTable headers={['Department', 'Employees']} rows={deptCounts} emptyText="Abhi koi employee add nahi hua — Employees tab se shuru karein." />
              </div>
              <div className="card">
                <h3>Pending leave requests</h3>
                <DataTable
                  headers={['Employee', 'Type', 'From', 'To']}
                  rows={pendingLeave.map((l) => [empById[l.employee_id]?.full_name || '—', l.leave_type || '—', formatDate(l.start_date), formatDate(l.end_date)])}
                  emptyText="Koi pending leave request nahi hai."
                />
                <button type="button" className="primary" onClick={() => setView('chat')}>Dost Chat mein poochhein →</button>
              </div>
            </div>
            <div className="card">
              <h3>Ask Dost Chat</h3>
              <p className="muted">Jaise: “Kitne employees hain?”, “Total salary kitni hai?”, “Aaj kon absent hai?”, “Pending leave dikhao”.</p>
              <button type="button" className="primary" onClick={() => setView('chat')}>Open Dost Chat</button>
            </div>
          </section>
        )}

        {view === 'employees' && (
          <section>
            <h2>Employees — {employees.length}</h2>
            <p className="muted">HR data ek dafa yahan enter karein; Dost Chat isi se jawab de ga. Salary PKR mein.</p>
            <form onSubmit={handleAddEmployee} className="form-grid card">
              <label>Full name *<input type="text" required value={empForm.full_name} onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })} placeholder="Jaise Ahmed Khan" maxLength={120} /></label>
              <label>Email<input type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} placeholder="ahmed@company.pk" /></label>
              <label>Department<input type="text" value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} placeholder="Sales, HR, Accounts…" maxLength={80} /></label>
              <label>Job title<input type="text" value={empForm.job_title} onChange={(e) => setEmpForm({ ...empForm, job_title: e.target.value })} placeholder="Sales Executive" maxLength={80} /></label>
              <label>Salary (PKR / month)<input type="number" min="0" step="1" value={empForm.salary_pkr} onChange={(e) => setEmpForm({ ...empForm, salary_pkr: e.target.value })} placeholder="85000" /></label>
              <label>Hire date<input type="date" value={empForm.hire_date} onChange={(e) => setEmpForm({ ...empForm, hire_date: e.target.value })} /></label>
              <button type="submit" className="primary" disabled={!empForm.full_name.trim()}>Add employee</button>
            </form>
            <DataTable
              headers={['Employee', 'Department', 'Job title', 'Salary (PKR)', 'Hire date', 'Status', '']}
              rows={employees.map((e) => [
                e.full_name + (e.email ? ` — ${e.email}` : ''),
                e.department || '—', e.job_title || '—', formatPKR(e.salary_pkr), formatDate(e.hire_date), e.is_active ? 'Active' : 'Inactive',
                '',
              ])}
              emptyText="Abhi koi employee nahi hai — upar form se pehla employee add karein."
            />
            {employees.length > 0 && (
              <ul className="row-actions">
                {employees.map((e) => (
                  <li key={e.id}>
                    <span>{e.full_name} ({e.is_active ? 'Active' : 'Inactive'})</span>
                    <button type="button" className="ghost small-btn" onClick={() => handleToggleActive(e)}>{e.is_active ? 'Mark inactive' : 'Mark active'}</button>
                    <button type="button" className="ghost small-btn danger" onClick={() => handleDeleteEmployee(e)}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === 'attendance' && (
          <section>
            <h2>Attendance</h2>
            <p className="muted">Rozana hazri mark karein. Dost Chat “Aaj kon absent hai?” ka jawab isi se de ga.</p>
            <div className="card inline-row">
              <label>Date <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} /></label>
              <button type="button" className="primary" onClick={handleSaveAttendance}>Save attendance</button>
            </div>
            {activeEmps.length === 0 ? (
              <p className="muted empty">Pehle Employees tab mein employees add karein.</p>
            ) : (
              <DataTable
                headers={['Employee', 'Department', 'Status on ' + formatDate(attDate), 'Saved status']}
                rows={activeEmps.map((e) => {
                  const saved = attendance.find((a) => a.employee_id === e.id && a.work_date === attDate)
                  return [
                    e.full_name, e.department || '—',
                    <select key={'s' + e.id} value={attDraft[e.id] ?? saved?.status ?? ''} onChange={(ev) => setAttDraft((p) => ({ ...p, [e.id]: ev.target.value }))} aria-label={`Status for ${e.full_name}`}>
                      <option value="">— Select —</option>
                      <option>Present</option><option>Absent</option><option>Late</option><option>On Leave</option>
                    </select>,
                    saved?.status || 'Not marked yet',
                  ]
                })}
                emptyText=""
              />
            )}
            <div className="card">
              <h3>Recent attendance</h3>
              <DataTable
                headers={['Employee', 'Date', 'Status']}
                rows={attendance.slice(0, 30).map((a) => [empById[a.employee_id]?.full_name || '—', formatDate(a.work_date), a.status])}
                emptyText="Abhi koi attendance record nahi hai."
              />
            </div>
          </section>
        )}

        {view === 'leave' && (
          <section>
            <h2>Leave requests</h2>
            <p className="muted">Chhutti ki request banayein, phir approve ya reject karein.</p>
            <form onSubmit={handleAddLeave} className="form-grid card">
              <label>Employee *
                <select required value={leaveForm.employee_id} onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}>
                  <option value="">— Select employee —</option>
                  {activeEmps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label>Leave type
                <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                  <option>Annual</option><option>Sick</option><option>Casual</option><option>Unpaid</option>
                </select>
              </label>
              <label>Start date *<input type="date" required value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} /></label>
              <label>End date *<input type="date" required value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} /></label>
              <button type="submit" className="primary" disabled={!leaveForm.employee_id}>Submit request</button>
            </form>
            <DataTable
              headers={['Employee', 'Type', 'From', 'To', 'Status']}
              rows={leaveRequests.map((l) => [empById[l.employee_id]?.full_name || '—', l.leave_type || '—', formatDate(l.start_date), formatDate(l.end_date), l.status])}
              emptyText="Abhi koi leave request nahi hai."
            />
            {leaveRequests.filter((l) => l.status === 'Pending').length > 0 && (
              <ul className="row-actions">
                {leaveRequests.filter((l) => l.status === 'Pending').map((l) => (
                  <li key={l.id}>
                    <span>{empById[l.employee_id]?.full_name} — {l.leave_type} ({formatDate(l.start_date)} to {formatDate(l.end_date)})</span>
                    <button type="button" className="ghost small-btn" onClick={() => handleLeaveStatus(l.id, 'Approved')}>Approve</button>
                    <button type="button" className="ghost small-btn danger" onClick={() => handleLeaveStatus(l.id, 'Rejected')}>Reject</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === 'payroll' && (
          <section>
            <h2>Payroll — PKR</h2>
            <p className="muted">Mahine ki payroll active employees ki salaries se generate hoti hai. Gross = net = salary; koi tax ya EOBI deduction calculate nahi hui — payment se pehle check kar lein.</p>
            <div className="card inline-row">
              <label>Pay month <input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} /></label>
              <button type="button" className="primary" onClick={handleGeneratePayroll}>Generate payroll</button>
              <span className="muted">Total net for {payMonth}: <strong>{formatPKR(monthTotal)}</strong> ({monthPayroll.length} employees)</span>
            </div>
            <DataTable
              headers={['Employee', 'Pay month', 'Gross (PKR)', 'Net (PKR)']}
              rows={monthPayroll.map((p) => [empById[p.employee_id]?.full_name || '—', formatDate(p.pay_month), formatPKR(p.gross_salary), formatPKR(p.net_salary)])}
              emptyText={`Is mahine (${payMonth}) ki koi payroll nahi hai — Generate payroll dabayein.`}
            />
            {monthPayroll.length > 0 && (
              <ul className="row-actions">
                {monthPayroll.map((p) => (
                  <li key={p.id}>
                    <span>{empById[p.employee_id]?.full_name} — {formatPKR(p.net_salary)}</span>
                    <button type="button" className="ghost small-btn danger" onClick={() => handleDeletePayroll(p.id)}>Delete record</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === 'chat' && (
          <section>
            <h2>Dost Chat — Sawal poochho, jawab pao</h2>
            <p className="muted">Jawab sirf aap ke live data (employees, attendance, leave, payroll) se bante hain. Data nahi hai to main seedha keh doon ga — andaza kabhi nahi lagata.</p>
            <div className="chat-box" aria-live="polite">
              {chatLog.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'msg user' : 'msg dost'}>
                  <div className="msg-who">{m.role === 'user' ? 'You' : 'HR Dost'}</div>
                  <div className="msg-text">{m.text}</div>
                  {m.table && (
                    <div className="table-wrap chat-table">
                      <table>
                        <thead><tr>{m.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                          {m.table.rows.map((r, ri) => (
                            <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="examples">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button key={q} type="button" className="chip" onClick={() => handleAsk(q)}>{q}</button>
              ))}
            </div>
            <form className="chat-form" onSubmit={(e) => { e.preventDefault(); handleAsk() }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Sawal likhein — English ya Roman Urdu…" aria-label="Ask HR Dost" maxLength={300} />
              <button type="submit" className="primary" disabled={!chatInput.trim()}>Ask</button>
            </form>
            <p className="muted small">Chat history sirf is browser session mein rehti hai — backend mein save nahi hoti.</p>
          </section>
        )}

        {view === 'settings' && (
          <section>
            <h2>Settings</h2>
            <div className="card">
              <h3>Workspace</h3>
              <p><strong>{company.name}</strong> — created {formatDate(company.created_at)}</p>
              <p className="muted">Signed in as {user.email} — role: <strong>Company Admin / CEO</strong> (workspace owner).</p>
              <p className="muted">Data counts: {employees.length} employees · {attendance.length} attendance records · {leaveRequests.length} leave requests · {payroll.length} payroll records.</p>
            </div>
            <div className="card">
              <h3>Roles — honest note</h3>
              <p className="muted">Day one mein aap hi Company Admin / CEO hain. Doosra user (jaise alag HR officer) abhi isi company ko nahi dekh sakta — approved backend plan ke mutabiq, cross-user company access ke liye pehle ek membership / role table aur review chahiye. Jab tak woh nahi banta, HR Dost kisi aur ko aap ka data dikhane ka daawa nahi karta.</p>
            </div>
            <div className="card">
              <h3>Data &amp; privacy</h3>
              <p className="muted">Sab data Supabase project <code>aeqkzgekrzbytbmkfbqb</code> mein hai, row-level security ke saath. Har row ka owner aap hain; anonymous reads blocked hain. Chat ke jawab deterministic hain — koi external AI service aap ka HR data nahi dekhti.</p>
              <button type="button" className="ghost" onClick={handleLogout}>Log out</button>
            </div>
          </section>
        )}
      </main>
      <footer className="footer">HR Dost — Apne employees, ek jagah. Sawal poochho, jawab pao. · PKR · Dates DD MMM YYYY · Time PKT</footer>
    </div>
  )
}

export default App
