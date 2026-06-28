'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

const Charts = dynamic(() => import('./Charts'), { ssr: false })

interface User { id: number; role: string; name: string; email: string; phone: string; cnic: string; license_no: string; speciality: string; qualification: string; active: boolean; created_at: string }
interface ReportData {
  stats: { total_today: number; done_today: number; emergency_today: number; avg_wait_minutes: number }
  patientsPerDay: { date: string; count: number }[]
  perDoctor: { doctor_name: string; count: number }[]
  statusBreakdown: { status: string; count: number }[]
}
interface AttendanceRecord { id: number; doctor_name: string; speciality: string; shift_start: string; shift_end: string | null; total_minutes: number | null; breaks: { start: string; end: string | null }[] }
interface InventoryItem { id: number; name: string; type: 'consumable' | 'permanent'; category: string; quantity: number; unit: string; expiry_date: string | null; status: string | null; notes: string; days_left: number | null; created_at: string }
interface PaymentRecord { id: number; name: string; queue_number: number; check_in_at: string; payment_method: string; bill_amount: number; discount: number; amount_paid: number; change_due: number; payment_status: string }

const blankDoctor = { role: 'doctor', name: '', email: '', password: '', phone: '', cnic: '', license_no: '', speciality: '', qualification: '' }
const blankStaff  = { role: 'data_entry', name: '', email: '', password: '', phone: '' }

const roleColor: Record<string, string> = {
  admin:      'bg-violet-100 text-violet-700 border-violet-200',
  doctor:     'bg-sky-100 text-sky-700 border-sky-200',
  data_entry: 'bg-slate-100 text-slate-600 border-slate-200',
}
const roleLabel: Record<string, string> = { admin: 'Admin', doctor: 'Doctor', data_entry: 'Data Entry' }

const blankItem = { name: '', type: 'consumable', category: '', quantity: '', unit: '', expiry_date: '', status: 'active', notes: '' }

export default function AdminPanel() {
  const router = useRouter()
  const [tab, setTab] = useState<'dashboard' | 'users' | 'reports' | 'inventory'>('dashboard')
  const [users, setUsers] = useState<User[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [reports, setReports] = useState<ReportData | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [expiryAlerts, setExpiryAlerts] = useState<InventoryItem[]>([])
  const [invFilter, setInvFilter] = useState<'all' | 'consumable' | 'permanent'>('all')
  const [showItemModal, setShowItemModal] = useState<'add' | 'edit' | null>(null)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState<Record<string, string>>(blankItem)
  const [savingItem, setSavingItem] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [reportFrom, setReportFrom] = useState(new Date().toISOString().slice(0, 10))
  const [reportTo,   setReportTo]   = useState(new Date().toISOString().slice(0, 10))
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null)
  const [discountEdit, setDiscountEdit] = useState('')
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [showModal, setShowModal] = useState<'doctor' | 'staff' | null>(null)
  const [form, setForm] = useState<Record<string, string>>(blankDoctor)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [adminName, setAdminName] = useState('')

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const loadUsers = useCallback(async () => {
    const r = await fetch('/api/users')
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) {
      const data = await r.json()
      setUsers(data)
      localStorage.setItem('cache_admin_users', JSON.stringify(data))
    }
  }, [router])

  const loadReports = useCallback(async (from?: string, to?: string) => {
    const f = from ?? reportFrom
    const t = to   ?? reportTo
    const r = await fetch(`/api/reports?from=${f}&to=${t}`)
    if (r.ok) {
      const data = await r.json()
      setReports(data)
      localStorage.setItem('cache_admin_reports', JSON.stringify(data))
    }
  }, [reportFrom, reportTo])

  const loadAttendance = useCallback(async (date?: string) => {
    const d = date ?? attendanceDate
    const r = await fetch(`/api/attendance?date=${d}`)
    if (r.ok) setAttendance(await r.json())
  }, [attendanceDate])

  const loadInventory = useCallback(async () => {
    const r = await fetch('/api/inventory')
    if (r.ok) setInventory(await r.json())
  }, [])

  const loadExpiryAlerts = useCallback(async () => {
    const r = await fetch('/api/inventory?alert=true')
    if (r.ok) setExpiryAlerts(await r.json())
  }, [])

  const loadPayments = useCallback(async (date?: string) => {
    const d = date ?? payDate
    const r = await fetch(`/api/patients?date=${d}`)
    if (r.ok) setPayments(await r.json())
  }, [payDate])

  useEffect(() => {
    const cachedUsers = localStorage.getItem('cache_admin_users')
    if (cachedUsers) setUsers(JSON.parse(cachedUsers))
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setAdminName(d.name))
    loadUsers()
    loadReports()
    loadAttendance()
    loadExpiryAlerts()
    loadPayments()
  }, [loadUsers, loadReports, loadAttendance, loadExpiryAlerts, loadPayments])

  useEffect(() => {
    if (tab === 'reports') {
      const cachedReports = localStorage.getItem('cache_admin_reports')
      if (cachedReports) setReports(JSON.parse(cachedReports))
      loadReports()
    }
    if (tab === 'inventory') loadInventory()
  }, [tab, loadReports, loadInventory])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const openModal = (type: 'doctor' | 'staff') => {
    setForm(type === 'doctor' ? blankDoctor : blankStaff)
    setShowModal(type)
  }

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    })
    const data = await r.json()
    if (!r.ok) { notify(data.error || 'Failed to create user'); setSaving(false); return }
    notify(`${form.role === 'doctor' ? 'Doctor' : 'Staff'} account created ✓`)
    setShowModal(null)
    await loadUsers()
    setSaving(false)
  }

  const toggleActive = async (user: User) => {
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !user.active })
    })
    notify(`${user.name} ${user.active ? 'deactivated' : 'activated'}`)
    await loadUsers()
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return
    const r = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (r.ok) { notify(`${user.name} deleted`); await loadUsers() }
    else notify('Failed to delete user')
  }

  const deletePatient = async (id: number, name: string) => {
    if (!confirm(`Delete patient ${name}? This cannot be undone.`)) return
    const r = await fetch(`/api/patients/${id}`, { method: 'DELETE' })
    if (r.ok) { notify(`${name} deleted`); await loadPayments(payDate) }
    else notify('Failed to delete patient')
  }

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const stats = [
    { label: 'Total Today',    value: reports?.stats.total_today ?? '—',     color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '👥' },
    { label: 'Completed',      value: reports?.stats.done_today ?? '—',       color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✓' },
    { label: 'Emergencies',    value: reports?.stats.emergency_today ?? '—',  color: 'text-red-600', bg: 'bg-red-50', icon: '🚨' },
    { label: 'Avg Wait (min)', value: reports?.stats.avg_wait_minutes ?? '—', color: 'text-amber-600', bg: 'bg-amber-50', icon: '⏱' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-lg border-b border-indigo-800/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-sky-400 rounded-xl flex items-center justify-center text-sm font-bold shadow-md">NS</div>
          <div>
            <p className="font-bold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-indigo-300 text-xs">Administration Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-indigo-800/60 border border-indigo-700/40 px-3 py-1.5 rounded-full font-medium">
            Admin · {adminName}
          </span>
          <button onClick={logout} className="text-xs text-indigo-300 hover:text-white transition font-medium">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit mb-6 shadow-sm">
          {([
            { key: 'dashboard', label: '🏠 Dashboard' },
            { key: 'users',     label: '👥 Users' },
            { key: 'reports',   label: '📊 Reports' },
            { key: 'inventory', label: '📦 Inventory' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-6 py-2 text-sm font-semibold rounded-lg transition ${tab === t.key ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Dashboard tab */}
        {tab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Expiry alert banner */}
            {expiryAlerts.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">⚠️</span>
                      <p className="font-bold text-red-700 text-base">
                        {expiryAlerts.filter(i => (i.days_left ?? 99) <= 0).length > 0 ? 'Items Expired / Expiring Soon' : 'Consumables Expiring Soon'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {expiryAlerts.map(item => (
                        <span key={item.id} className={`text-xs px-3 py-1.5 rounded-full font-bold border ${(item.days_left ?? 99) <= 0 ? 'bg-red-100 text-red-700 border-red-300' : (item.days_left ?? 99) <= 7 ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {item.name} — {(item.days_left ?? 99) <= 0 ? 'EXPIRED' : `${item.days_left}d left`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={async () => {
                    setSendingEmail(true)
                    const r = await fetch('/api/inventory/alerts', { method: 'POST' })
                    const d = await r.json()
                    notify(d.ok ? `Alert email sent to admin ✓` : d.reason || d.error || 'Email not configured')
                    setSendingEmail(false)
                  }} disabled={sendingEmail}
                    className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60 shadow-sm">
                    {sendingEmail ? 'Sending…' : '📧 Send Email Alert'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Today stats */}
            <div>
              <h2 className="text-base font-bold text-slate-500 uppercase tracking-wider mb-3">Today at a Glance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                      <span className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center text-base`}>{s.icon}</span>
                    </div>
                    <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Doctor Attendance */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <h2 className="text-base font-bold text-slate-500 uppercase tracking-wider">Doctor Attendance</h2>
                <div className="flex gap-2 items-center">
                  <input type="date" value={attendanceDate} max={new Date().toISOString().slice(0, 10)}
                    onChange={e => { setAttendanceDate(e.target.value); loadAttendance(e.target.value) }}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                  {attendanceDate !== new Date().toISOString().slice(0, 10) && (
                    <button onClick={() => { const t = new Date().toISOString().slice(0, 10); setAttendanceDate(t); loadAttendance(t) }}
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800 transition">Today</button>
                  )}
                  <button onClick={() => loadAttendance()} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition">Refresh</button>
                </div>
              </div>
              {attendance.length === 0 ? (
                <div className="card p-8 text-center text-slate-400 text-sm">No doctors have started a shift today</div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Doctor', 'Speciality', 'Shift Start', 'Shift End', 'Duration', 'Breaks', 'Status'].map(h => (
                          <th key={h} className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((a, i) => {
                        const isActive = !a.shift_end
                        const breakCount = a.breaks?.length ?? 0
                        const onBreak = breakCount > 0 && !a.breaks[breakCount - 1]?.end
                        return (
                          <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                            className="border-t border-slate-100 hover:bg-indigo-50/20 transition">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-sky-400 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {a.doctor_name.charAt(0)}
                                </div>
                                <span className="font-semibold text-slate-800">{a.doctor_name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 text-xs">{a.speciality || '—'}</td>
                            <td className="px-5 py-3.5 text-slate-700 font-medium">
                              {new Date(a.shift_start).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {a.shift_end ? new Date(a.shift_end).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-indigo-700">
                              {a.total_minutes != null ? `${Math.floor(a.total_minutes / 60)}h ${a.total_minutes % 60}m` : isActive ? 'Ongoing' : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">{breakCount > 0 ? `${breakCount} break${breakCount > 1 ? 's' : ''}` : '—'}</td>
                            <td className="px-5 py-3.5">
                              {onBreak
                                ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">On Break</span>
                                : isActive
                                  ? <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 w-fit">
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />Active
                                    </span>
                                  : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Done</span>
                              }
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payments */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <h2 className="text-base font-bold text-slate-500 uppercase tracking-wider">Payments</h2>
                <div className="flex gap-2 items-center">
                  <input type="date" value={payDate} max={new Date().toISOString().slice(0, 10)}
                    onChange={e => { setPayDate(e.target.value); loadPayments(e.target.value) }}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                  {payDate !== new Date().toISOString().slice(0, 10) && (
                    <button onClick={() => { const t = new Date().toISOString().slice(0, 10); setPayDate(t); loadPayments(t) }}
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800 transition">Today</button>
                  )}
                </div>
              </div>

              {/* Revenue summary */}
              {payments.length > 0 && (() => {
                const totalBill   = payments.reduce((s, p) => s + Number(p.bill_amount || 0), 0)
                const totalDisc   = payments.reduce((s, p) => s + Number(p.discount || 0), 0)
                const totalPaid   = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
                const paidCount   = payments.filter(p => p.payment_status === 'paid').length
                const pendingCount = payments.filter(p => p.payment_status === 'pending').length
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { l: 'Total Billed', v: `PKR ${totalBill.toLocaleString()}`, c: 'text-indigo-700', bg: 'bg-indigo-50' },
                      { l: 'Discounts', v: `PKR ${totalDisc.toLocaleString()}`, c: 'text-amber-700', bg: 'bg-amber-50' },
                      { l: 'Collected', v: `PKR ${totalPaid.toLocaleString()}`, c: 'text-emerald-700', bg: 'bg-emerald-50' },
                      { l: 'Pending', v: `${pendingCount} of ${payments.length}`, c: 'text-red-600', bg: 'bg-red-50' },
                    ].map(s => (
                      <div key={s.l} className={`${s.bg} rounded-xl p-4 border border-white/60`}>
                        <p className="text-xs font-semibold text-slate-500 mb-1">{s.l}</p>
                        <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="card overflow-hidden">
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No patients for this date</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['#', 'Patient', 'Method', 'Bill', 'Discount', 'Net', 'Received', 'Status', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => {
                        const net = Math.max(0, (p.bill_amount || 0) - (p.discount || 0))
                        return (
                          <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                            className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 font-black text-slate-600">#{String(p.queue_number).padStart(3, '0')}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{p.payment_method || 'cash'}</td>
                            <td className="px-4 py-3">{p.bill_amount > 0 ? `PKR ${Number(p.bill_amount).toLocaleString()}` : '—'}</td>
                            <td className="px-4 py-3 text-amber-600 font-semibold">{p.discount > 0 ? `PKR ${Number(p.discount).toLocaleString()}` : '—'}</td>
                            <td className="px-4 py-3 font-bold text-indigo-700">{net > 0 ? `PKR ${net.toLocaleString()}` : '—'}</td>
                            <td className="px-4 py-3">{p.amount_paid > 0 ? `PKR ${Number(p.amount_paid).toLocaleString()}` : '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold border
                                ${p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : p.payment_status === 'partial' ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {p.payment_status === 'paid' ? '✓ Paid' : p.payment_status === 'partial' ? 'Partial' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setEditingPayment(p); setDiscountEdit(String(p.discount || 0)) }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition">
                                  Edit
                                </button>
                                <button onClick={() => deletePatient(p.id, p.name)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { label: 'Manage Users', desc: 'Add doctors and staff accounts', icon: '👥', action: () => setTab('users'), color: 'from-indigo-500 to-indigo-600' },
                { label: 'View Reports', desc: 'Charts and statistics', icon: '📊', action: () => setTab('reports'), color: 'from-sky-500 to-sky-600' },
                { label: 'Inventory', desc: 'Manage consumables & equipment', icon: '📦', action: () => setTab('inventory'), color: 'from-violet-500 to-violet-600' },
                { label: 'Export Excel', desc: "Download today's patient data", icon: '↓', action: () => window.open('/api/export'), color: 'from-emerald-500 to-emerald-600' },
              ].map(c => (
                <button key={c.label} onClick={c.action}
                  className={`bg-gradient-to-br ${c.color} text-white rounded-2xl p-5 text-left hover:shadow-lg transition-all hover:-translate-y-0.5 shadow-md`}
                  style={{ transition: 'transform 0.15s, box-shadow 0.15s' }}>
                  <span className="text-2xl block mb-2">{c.icon}</span>
                  <p className="font-bold text-base">{c.label}</p>
                  <p className="text-white/70 text-xs mt-0.5">{c.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Edit Payment Modal */}
        <AnimatePresence>
          {editingPayment && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Edit Payment</h3>
                    <p className="text-xs text-slate-500 mt-0.5">#{String(editingPayment.queue_number).padStart(3,'0')} · {editingPayment.name}</p>
                  </div>
                  <button onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition">✕</button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 rounded-xl p-4">
                    {[
                      ['Bill Amount', `PKR ${Number(editingPayment.bill_amount || 0).toLocaleString()}`],
                      ['Current Discount', `PKR ${Number(editingPayment.discount || 0).toLocaleString()}`],
                      ['Net Payable', `PKR ${Math.max(0, (editingPayment.bill_amount || 0) - (editingPayment.discount || 0)).toLocaleString()}`],
                      ['Received', `PKR ${Number(editingPayment.amount_paid || 0).toLocaleString()}`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-slate-400 font-semibold">{k}</p>
                        <p className="font-bold text-slate-700">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">New Discount (PKR)</label>
                    <input type="number" min={0} max={editingPayment.bill_amount || 99999}
                      value={discountEdit} onChange={e => setDiscountEdit(e.target.value)}
                      className="field-input text-lg font-bold" />
                    {discountEdit && (
                      <p className="text-xs text-indigo-600 font-semibold mt-1.5">
                        Net after discount: PKR {Math.max(0, (editingPayment.bill_amount || 0) - parseFloat(discountEdit || '0')).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingPayment(null)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                    <button disabled={savingDiscount} onClick={async () => {
                      setSavingDiscount(true)
                      const r = await fetch(`/api/patients/${editingPayment.id}/payment`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ discount: parseFloat(discountEdit) || 0 })
                      })
                      if (r.ok) { notify('Discount updated ✓'); setEditingPayment(null); await loadPayments() }
                      else notify('Failed to update')
                      setSavingDiscount(false)
                    }} className="btn-primary flex-1 py-3 text-sm">
                      {savingDiscount ? 'Saving…' : 'Apply Discount'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Users tab */}
        {tab === 'users' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">User Management</h2>
                <p className="text-xs text-slate-500 mt-0.5">{users.length} accounts</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openModal('doctor')}
                  className="btn-primary px-5 py-2.5 text-sm">
                  + Add Doctor
                </button>
                <button onClick={() => openModal('staff')}
                  className="btn-secondary px-5 py-2.5 text-sm">
                  + Add Staff
                </button>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 text-left border-b border-slate-200">
                      {['Name', 'Role', 'Email', 'Phone', 'Speciality', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <motion.tr key={u.id}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-t border-slate-100 hover:bg-indigo-50/30 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-sky-400 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${roleColor[u.role]}`}>
                            {roleLabel[u.role]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{u.email}</td>
                        <td className="px-5 py-4 text-slate-500">{u.phone || '—'}</td>
                        <td className="px-5 py-4 text-slate-500">{u.speciality || '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${u.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {u.role !== 'admin' && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleActive(u)}
                                className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition border ${u.active
                                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                                {u.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => deleteUser(u)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition">
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Reports tab */}
        {tab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Date range picker */}
            <div className="card p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">From</label>
                  <input type="date" value={reportFrom} max={reportTo}
                    onChange={e => setReportFrom(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                </div>
                <span className="text-slate-400 font-bold">—</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">To</label>
                  <input type="date" value={reportTo} min={reportFrom} max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setReportTo(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: 'Today',    f: 0, t: 0 },
                  { label: '7 days',   f: 6, t: 0 },
                  { label: '30 days',  f: 29, t: 0 },
                  { label: '90 days',  f: 89, t: 0 },
                ].map(p => {
                  const toD   = new Date().toISOString().slice(0, 10)
                  const fromD = new Date(Date.now() - p.f * 86400000).toISOString().slice(0, 10)
                  const active = reportFrom === fromD && reportTo === toD
                  return (
                    <button key={p.label} onClick={() => { setReportFrom(fromD); setReportTo(toD); loadReports(fromD, toD) }}
                      className={`text-xs px-3 py-2 rounded-lg font-bold transition border
                        ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'}`}>
                      {p.label}
                    </button>
                  )
                })}
                <button onClick={() => loadReports()}
                  className="text-xs px-4 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm">
                  Apply
                </button>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <span className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center text-base`}>{s.icon}</span>
                  </div>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-end">
              <a href="/api/export"
                className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
                ↓ Export Excel
              </a>
            </div>

            {reports ? <Charts data={reports} /> : (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-3">
                <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading reports…
              </div>
            )}
          </motion.div>
        )}

        {/* Inventory tab */}
        {tab === 'inventory' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                {(['all', 'consumable', 'permanent'] as const).map(f => (
                  <button key={f} onClick={() => { setInvFilter(f); if (f !== invFilter) loadInventory() }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${invFilter === f ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                    {f === 'all' ? 'All Items' : f === 'consumable' ? '💊 Consumables' : '🔧 Permanent'}
                  </button>
                ))}
              </div>
              <button onClick={() => { setItemForm(blankItem); setEditingItem(null); setShowItemModal('add'); loadInventory() }}
                className="btn-primary px-5 py-2.5 text-sm">
                + Add Item
              </button>
            </div>

            {/* Inventory table */}
            {inventory.length === 0 ? (
              <div className="card p-12 text-center text-slate-400">
                <p className="text-4xl mb-3">📦</p>
                <p className="font-semibold">No inventory items yet</p>
                <p className="text-sm mt-1">Add consumables (with expiry dates) or permanent equipment</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Item', 'Type', 'Category', 'Qty', 'Expiry / Status', 'Notes', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventory
                      .filter(i => invFilter === 'all' || i.type === invFilter)
                      .map((item, idx) => {
                        const expired = item.type === 'consumable' && item.days_left !== null && item.days_left <= 0
                        const expiringSoon = item.type === 'consumable' && item.days_left !== null && item.days_left > 0 && item.days_left <= 30
                        return (
                          <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                            className={`border-t border-slate-100 transition ${expired ? 'bg-red-50/60' : expiringSoon ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-5 py-3.5 font-semibold text-slate-800">{item.name}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${item.type === 'consumable' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-sky-100 text-sky-700 border-sky-200'}`}>
                                {item.type === 'consumable' ? '💊 Consumable' : '🔧 Permanent'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">{item.category || '—'}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-700">{item.quantity} <span className="font-normal text-slate-400 text-xs">{item.unit}</span></td>
                            <td className="px-5 py-3.5">
                              {item.type === 'consumable' ? (
                                item.expiry_date ? (
                                  <span className={`font-bold text-xs ${expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {expired ? '🔴 EXPIRED' : expiringSoon ? `⚠️ ${item.days_left}d left` : `✓ ${new Date(item.expiry_date).toLocaleDateString()}`}
                                  </span>
                                ) : '—'
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {item.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 max-w-[150px] truncate">{item.notes || '—'}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  setEditingItem(item)
                                  setItemForm({
                                    name: item.name, type: item.type, category: item.category || '', quantity: String(item.quantity),
                                    unit: item.unit || '', expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
                                    status: item.status || 'active', notes: item.notes || ''
                                  })
                                  setShowItemModal('edit')
                                }} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition">
                                  Edit
                                </button>
                                <button onClick={async () => {
                                  if (!confirm('Delete this item?')) return
                                  await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
                                  notify('Item deleted')
                                  await loadInventory()
                                  await loadExpiryAlerts()
                                }} className="text-xs text-red-600 hover:text-red-800 font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Add / Edit Item Modal */}
      <AnimatePresence>
        {showItemModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">{showItemModal === 'add' ? 'Add Inventory Item' : 'Edit Item'}</h3>
                <button onClick={() => setShowItemModal(null)} className="text-slate-400 hover:text-slate-700 transition p-2 rounded-xl hover:bg-slate-100">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Item Name *</label>
                    <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Surgical Gloves, Stethoscope" className="field-input" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Type *</label>
                    <select value={itemForm.type} onChange={e => setItemForm(f => ({ ...f, type: e.target.value }))} className="field-input">
                      <option value="consumable">💊 Consumable</option>
                      <option value="permanent">🔧 Permanent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Category</label>
                    <input value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. PPE, Equipment" className="field-input" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Quantity</label>
                    <input type="number" min={0} value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                      placeholder="0" className="field-input" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Unit</label>
                    <input value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                      placeholder="boxes, pieces, bottles…" className="field-input" />
                  </div>
                  {itemForm.type === 'consumable' ? (
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Expiry Date</label>
                      <input type="date" value={itemForm.expiry_date} onChange={e => setItemForm(f => ({ ...f, expiry_date: e.target.value }))}
                        className="field-input" />
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
                      <div className="flex gap-3">
                        {['active', 'inactive'].map(s => (
                          <label key={s} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition font-bold text-sm
                            ${itemForm.status === s ? s === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-400 bg-slate-50 text-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                            <input type="radio" className="sr-only" value={s} checked={itemForm.status === s} onChange={() => setItemForm(f => ({ ...f, status: s }))} />
                            {s === 'active' ? '✓ Active' : '○ Inactive'}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notes</label>
                    <input value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional notes" className="field-input" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowItemModal(null)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                  <button disabled={savingItem} onClick={async () => {
                    if (!itemForm.name) return notify('Item name is required')
                    setSavingItem(true)
                    const body = { ...itemForm, quantity: parseInt(itemForm.quantity) || 0 }
                    const r = editingItem
                      ? await fetch(`/api/inventory/${editingItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                      : await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    if (r.ok) {
                      notify(editingItem ? 'Item updated ✓' : 'Item added ✓')
                      setShowItemModal(null)
                      await loadInventory()
                      await loadExpiryAlerts()
                    } else {
                      const d = await r.json(); notify(d.error || 'Failed')
                    }
                    setSavingItem(false)
                  }} className="btn-primary flex-1 py-3 text-sm">
                    {savingItem ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Item'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-100">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{showModal === 'doctor' ? 'Add Doctor' : 'Add Staff Member'}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{showModal === 'doctor' ? 'Create a new doctor account' : 'Create a data entry account'}</p>
                </div>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-700 transition p-2 rounded-xl hover:bg-slate-100">✕</button>
              </div>
              <form onSubmit={saveUser} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <MField label="Full Name *" value={form.name || ''} onChange={set('name')} required />
                  <MField label="Email *" type="email" value={form.email || ''} onChange={set('email')} required />
                  <MField label="Password *" type="password" value={form.password || ''} onChange={set('password')} required />
                  <MField label="Phone" value={form.phone || ''} onChange={set('phone')} />
                  {showModal === 'doctor' && <>
                    <MField label="CNIC" value={form.cnic || ''} onChange={set('cnic')} />
                    <MField label="License No." value={form.license_no || ''} onChange={set('license_no')} />
                    <MField label="Speciality" value={form.speciality || ''} onChange={set('speciality')} />
                    <MField label="Qualification" value={form.qualification || ''} onChange={set('qualification')} />
                  </>}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(null)}
                    className="btn-secondary flex-1 py-3 text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="btn-primary flex-1 py-3 text-sm">
                    {saving ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white text-sm px-5 py-3.5 rounded-2xl shadow-2xl z-[60] border border-indigo-700/30">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MField({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean
}) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input type={isPw && show ? 'text' : type} value={value} onChange={onChange} required={required}
          className="field-input pr-9" />
        {isPw && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {show
                ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></>
                : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
              }
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
