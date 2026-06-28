'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

// SSR-safe recharts
const Charts = dynamic(() => import('./Charts'), { ssr: false })

interface User { id: number; role: string; name: string; email: string; phone: string; cnic: string; license_no: string; speciality: string; qualification: string; active: boolean; created_at: string }
interface ReportData {
  stats: { total_today: number; done_today: number; emergency_today: number; avg_wait_minutes: number }
  patientsPerDay: { date: string; count: number }[]
  perDoctor: { doctor_name: string; count: number }[]
  statusBreakdown: { status: string; count: number }[]
}

const blankDoctor = { role: 'doctor', name: '', email: '', password: '', phone: '', cnic: '', license_no: '', speciality: '', qualification: '' }
const blankStaff  = { role: 'data_entry', name: '', email: '', password: '', phone: '' }

export default function AdminPanel() {
  const router = useRouter()
  const [tab, setTab] = useState<'users' | 'reports'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [reports, setReports] = useState<ReportData | null>(null)
  const [showModal, setShowModal] = useState<'doctor' | 'staff' | null>(null)
  const [form, setForm] = useState<Record<string, string>>(blankDoctor)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [adminName, setAdminName] = useState('')

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const loadUsers = useCallback(async () => {
    const r = await fetch('/api/users')
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) setUsers(await r.json())
  }, [router])

  const loadReports = useCallback(async () => {
    const r = await fetch('/api/reports')
    if (r.ok) setReports(await r.json())
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setAdminName(d.name))
    loadUsers()
  }, [loadUsers])

  useEffect(() => { if (tab === 'reports') loadReports() }, [tab, loadReports])

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
    notify(`${form.role === 'doctor' ? 'Doctor' : 'Staff'} account created`)
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

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const roleLabel: Record<string, string> = { admin: 'Admin', doctor: 'Doctor', data_entry: 'Data Entry' }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-xs font-bold">NS</div>
          <div>
            <p className="font-semibold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-slate-400 text-xs">Administration Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-700 px-2.5 py-1 rounded-full">Admin · {adminName}</span>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white transition">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
          {(['users', 'reports'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition ${tab === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'users' ? '👥 Users' : '📊 Reports'}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">User Management</h2>
              <div className="flex gap-2">
                <button onClick={() => openModal('doctor')}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                  + Add Doctor
                </button>
                <button onClick={() => openModal('staff')}
                  className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                  + Add Staff
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left border-b border-slate-200">
                      {['Name', 'Role', 'Email', 'Phone', 'Speciality', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 font-medium text-slate-800">{u.name}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'doctor' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                            {roleLabel[u.role]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                        <td className="px-5 py-3.5 text-slate-500">{u.phone || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-500">{u.speciality || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.role !== 'admin' && (
                            <button onClick={() => toggleActive(u)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${u.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                              {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Reports tab */}
        {tab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {reports ? (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Today',    value: reports.stats.total_today,     color: 'sky' },
                    { label: 'Completed',       value: reports.stats.done_today,      color: 'emerald' },
                    { label: 'Emergencies',     value: reports.stats.emergency_today, color: 'red' },
                    { label: 'Avg Wait (min)',  value: reports.stats.avg_wait_minutes ?? '—', color: 'amber' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                      <p className={`text-3xl font-bold mt-1 text-${s.color}-600`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mb-4">
                  <a href="/api/export" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                    ↓ Export Excel
                  </a>
                </div>
                <Charts data={reports} />
              </>
            ) : (
              <div className="text-center py-20 text-slate-400">Loading reports…</div>
            )}
          </motion.div>
        )}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{showModal === 'doctor' ? 'Add Doctor' : 'Add Staff Member'}</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-700 transition">✕</button>
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
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(null)}
                    className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-50 transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-60">
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-[60]">
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
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input type={isPw && show ? 'text' : type} value={value} onChange={onChange} required={required}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition pr-8" />
        {isPw && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
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
