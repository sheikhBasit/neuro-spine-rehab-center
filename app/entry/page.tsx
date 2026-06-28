'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Patient {
  id: number; name: string; age: number; queue_number: number
  is_emergency: boolean; status: string; check_in_at: string; phone: string
}
interface LookupResult { id: number; name: string; age: number; guardian_name: string; cnic_bform: string; phone: string; address: string }

const STATUS_STYLE: Record<string, string> = {
  waiting:     'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done:        'bg-emerald-100 text-emerald-700',
}

function badge(status: string, emergency?: boolean) {
  if (emergency) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">EMERGENCY</span>
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-600'}`}>{status.replace('_', ' ').toUpperCase()}</span>
}

const blank = { name: '', age: '', guardian_name: '', cnic_bform: '', phone: '', address: '', is_emergency: false }

export default function EntryPanel() {
  const router = useRouter()
  const [form, setForm] = useState(blank)
  const [patients, setPatients] = useState<Patient[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<{ name: string } | null>(null)
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([])
  const [showLookup, setShowLookup] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'phone') {
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
      if (v.length >= 6) {
        lookupTimer.current = setTimeout(async () => {
          const r = await fetch(`/api/patients/lookup?phone=${encodeURIComponent(v)}`)
          if (r.ok) { const d = await r.json(); setLookupResults(d); setShowLookup(d.length > 0) }
        }, 400)
      } else {
        setLookupResults([]); setShowLookup(false)
      }
    }
  }

  const prefill = (p: LookupResult) => {
    setForm(f => ({ ...f, name: p.name, age: String(p.age), guardian_name: p.guardian_name, cnic_bform: p.cnic_bform, address: p.address }))
    setShowLookup(false)
  }

  const loadQueue = useCallback(async () => {
    const r = await fetch('/api/patients')
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) setPatients(await r.json())
  }, [router])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d))
    loadQueue()
    const id = setInterval(loadQueue, 3000)
    return () => clearInterval(id)
  }, [loadQueue])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setSubmitting(false); return }
    const patient = await res.json()

    // Upload any attached documents
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('patient_id', String(patient.id))
      await fetch('/api/documents', { method: 'POST', body: fd })
    }

    setToast(`Patient #${String(patient.queue_number).padStart(3,'0')} registered`)
    setTimeout(() => setToast(''), 4000)
    setForm(blank)
    setFiles([])
    await loadQueue()
    setSubmitting(false)
  }

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const today = new Date().toLocaleDateString('en-PK', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const waiting = patients.filter(p => p.status === 'waiting').length

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-xs font-bold">NS</div>
          <div>
            <p className="font-semibold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-slate-400 text-xs">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-700 px-2.5 py-1 rounded-full">Data Entry{user ? ` · ${user.name}` : ''}</span>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white transition">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 max-w-[1600px] mx-auto w-full">
        {/* Left: Registration form */}
        <div className="lg:col-span-3 p-6 border-r border-slate-200">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <h2 className="text-lg font-semibold text-slate-800 mb-5">Register Patient</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Emergency toggle */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer select-none transition
                             border-slate-200 has-[:checked]:border-red-400 has-[:checked]:bg-red-50">
                <input type="checkbox" checked={form.is_emergency}
                  onChange={e => setForm(f => ({ ...f, is_emergency: e.target.checked }))}
                  className="w-4 h-4 accent-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">🚨 Emergency / Priority Case</p>
                  <p className="text-xs text-slate-500">Patient will be placed at the top of the queue</p>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *" value={form.name} onChange={set('name')} placeholder="Patient full name" required />
                <Field label="Age *" value={form.age} onChange={set('age')} placeholder="e.g. 45" type="number" required />
                <Field label="Father / Husband Name" value={form.guardian_name} onChange={set('guardian_name')} placeholder="Guardian name" />
                <Field label="CNIC / B-Form No." value={form.cnic_bform} onChange={set('cnic_bform')} placeholder="35202-XXXXXXX-1" />
                {/* Phone lookup dropdown */}
                <AnimatePresence>
                  {showLookup && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-2">Existing patients with this number — click to pre-fill:</p>
                      <div className="space-y-1.5">
                        {lookupResults.map(p => (
                          <button key={p.id} type="button" onClick={() => prefill(p)}
                            className="w-full text-left px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition text-sm">
                            <span className="font-medium text-slate-800">{p.name}</span>
                            <span className="text-slate-500 text-xs ml-2">{p.age} yrs · {p.cnic_bform || 'No CNIC'}</span>
                          </button>
                        ))}
                        <button type="button" onClick={() => setShowLookup(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 mt-1">Dismiss</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Field label="Phone Number *" value={form.phone} onChange={set('phone')} placeholder="03XX-XXXXXXX" required />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Address *</label>
                  <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                    placeholder="Street, City, District" />
                </div>
              </div>

              {/* Document upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Related Documents</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition">
                  <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-slate-500">Click to upload files (X-rays, reports, etc.)</span>
                  <input type="file" multiple className="hidden"
                    onChange={e => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-60 shadow-sm">
                {submitting ? 'Registering…' : 'Register & Add to Queue'}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Right: Live queue */}
        <div className="lg:col-span-2 p-6 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Today's Queue</h2>
            <div className="flex gap-2">
              <span className="text-xs bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full font-medium">{waiting} waiting</span>
              <span className="text-xs bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full">{patients.length} total</span>
            </div>
          </div>

          {patients.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No patients registered yet today</div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
              <AnimatePresence>
                {patients.map(p => (
                  <motion.div key={p.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} layout
                    className={`bg-white rounded-xl border px-4 py-3 shadow-sm flex items-center gap-3
                      ${p.is_emergency ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                    <div className={`text-lg font-bold tabular-nums w-12 text-center shrink-0 ${p.is_emergency ? 'text-red-600' : 'text-sky-600'}`}>
                      #{String(p.queue_number).padStart(3,'0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.age} yrs · {new Date(p.check_in_at).toLocaleTimeString('en-PK', {hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    {badge(p.status, p.is_emergency)}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
            <a href="/api/export" className="flex-1 text-center text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition font-medium">
              Export Excel
            </a>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50">
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition" />
    </div>
  )
}
