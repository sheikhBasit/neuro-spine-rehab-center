'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Patient {
  id: number; name: string; age: number; queue_number: number
  is_emergency: boolean; status: string; check_in_at: string; phone: string
}
interface LookupResult { id: number; name: string; age: number; guardian_name: string; cnic_bform: string; phone: string; address: string }

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  waiting:     { bg: 'bg-sky-50 border-sky-200',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  in_progress: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',   dot: 'bg-amber-400' },
  done:        { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
}

const blank = { name: '', age: '', guardian_name: '', cnic_bform: '', phone: '', address: '', is_emergency: false }

function validateCNIC(v: string) {
  const d = v.replace(/[-\s]/g, '')
  return d === '' || d.length === 13
}
function validatePhone(v: string) {
  const d = v.replace(/[-\s]/g, '')
  return d.length === 11
}

export default function EntryPanel() {
  const router = useRouter()
  const [form, setForm] = useState(blank)
  const [patients, setPatients] = useState<Patient[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<{ name: string } | null>(null)
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([])
  const [showLookup, setShowLookup] = useState(false)
  const [cnicError, setCnicError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value
    setForm(f => ({ ...f, [k]: v }))

    if (k === 'cnic_bform') {
      setCnicError(validateCNIC(v) ? '' : 'CNIC / B-Form must be exactly 13 digits')
    }
    if (k === 'phone') {
      setPhoneError(v.length > 3 && !validatePhone(v) ? 'Phone number must be 11 digits' : '')
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
      if (v.replace(/[-\s]/g, '').length >= 6) {
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
    setCnicError('')
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
    if (cnicError) return
    if (!validatePhone(form.phone)) { setPhoneError('Phone number must be 11 digits'); return }

    setSubmitting(true)
    setError('')

    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to register patient')
      setSubmitting(false)
      return
    }

    // Upload documents (non-blocking — warn if Cloudinary not set)
    let docWarn = ''
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('patient_id', String(data.id))
      const dr = await fetch('/api/documents', { method: 'POST', body: fd })
      if (!dr.ok) {
        const de = await dr.json()
        docWarn = de.error || 'Document upload failed'
      }
    }

    notify(`Patient #${String(data.queue_number).padStart(3, '0')} registered${docWarn ? ' (⚠ ' + docWarn + ')' : ''}`)
    setForm(blank)
    setFiles([])
    setFileKey(k => k + 1)
    setPhoneError('')
    setCnicError('')
    await loadQueue()
    setSubmitting(false)
  }

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const waiting = patients.filter(p => p.status === 'waiting').length
  const inProgress = patients.filter(p => p.status === 'in_progress').length
  const done = patients.filter(p => p.status === 'done').length

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-lg border-b border-indigo-800/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-sky-400 rounded-xl flex items-center justify-center text-sm font-bold shadow-md">NS</div>
          <div>
            <p className="font-bold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-indigo-300 text-xs">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-indigo-800/60 border border-indigo-700/40 px-3 py-1.5 rounded-full font-medium">
            Data Entry {user ? `· ${user.name}` : ''}
          </span>
          <button onClick={logout} className="text-xs text-indigo-300 hover:text-white transition font-medium">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 max-w-[1600px] mx-auto w-full">
        {/* Left: Registration form */}
        <div className="lg:col-span-3 p-6">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Register Patient</h2>
                <p className="text-xs text-slate-500">Fill details to add to today's queue</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Emergency toggle */}
              <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer select-none transition
                ${form.is_emergency ? 'border-red-400 bg-red-50 shadow-sm shadow-red-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <input type="checkbox" checked={form.is_emergency}
                  onChange={e => setForm(f => ({ ...f, is_emergency: e.target.checked }))}
                  className="w-4 h-4 accent-red-500" />
                <div>
                  <p className="text-sm font-bold text-red-700">🚨 Emergency / Priority Case</p>
                  <p className="text-xs text-slate-500">Patient will float to the top of the queue</p>
                </div>
              </label>

              <div className="card p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Full Name *" value={form.name} onChange={set('name')} placeholder="Patient full name" required />
                  <Field label="Age *" value={form.age} onChange={set('age')} placeholder="e.g. 45" type="number" required />
                  <Field label="Father / Husband Name" value={form.guardian_name} onChange={set('guardian_name')} placeholder="Guardian name" />
                  <Field label="CNIC / B-Form No." value={form.cnic_bform} onChange={set('cnic_bform')}
                    placeholder="35202-XXXXXXX-1" error={cnicError} />
                  <Field label="Phone Number *" value={form.phone} onChange={set('phone')}
                    placeholder="03XX-XXXXXXX" required error={phoneError} />
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address *</label>
                    <textarea value={form.address} onChange={set('address')} required rows={2}
                      className="field-input resize-none"
                      placeholder="Street, City, District" />
                  </div>
                </div>

                {/* Phone lookup */}
                <AnimatePresence>
                  {showLookup && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-bold text-amber-700 mb-2">Returning patients — click to pre-fill:</p>
                      <div className="space-y-1.5">
                        {lookupResults.map(p => (
                          <button key={p.id} type="button" onClick={() => prefill(p)}
                            className="w-full text-left px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition text-sm group">
                            <span className="font-semibold text-slate-800">{p.name}</span>
                            <span className="text-slate-500 text-xs ml-2">{p.age} yrs · {p.cnic_bform || 'No CNIC'}</span>
                            <span className="text-amber-600 text-xs ml-2 group-hover:underline">Prefill →</span>
                          </button>
                        ))}
                        <button type="button" onClick={() => setShowLookup(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 mt-1 transition">Dismiss</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Document upload */}
              <div className="card p-5">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Related Documents</label>
                <label key={fileKey} className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition bg-white">
                  <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-slate-500 font-medium">Click to upload files (X-rays, reports, etc.)</span>
                  <input type="file" multiple className="hidden"
                    onChange={e => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </motion.div>
              )}

              <button type="submit" disabled={submitting || !!cnicError}
                className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2">
                {submitting ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Registering…</>
                ) : '+ Register & Add to Queue'}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Right: Live queue */}
        <div className="lg:col-span-2 border-l border-slate-200 bg-white/60 backdrop-blur-sm">
          <div className="sticky top-[65px]">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800">Live Queue</h2>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex gap-2">
                {[
                  { label: 'Waiting', count: waiting, color: 'bg-sky-100 text-sky-700' },
                  { label: 'In Progress', count: inProgress, color: 'bg-amber-100 text-amber-700' },
                  { label: 'Done', count: done, color: 'bg-emerald-100 text-emerald-700' },
                ].map(s => (
                  <div key={s.label} className={`flex-1 text-center px-2 py-1.5 rounded-lg ${s.color}`}>
                    <p className="text-lg font-bold">{s.count}</p>
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(100vh-220px)]">
              {patients.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">No patients today</div>
              ) : (
                <div className="space-y-2">
                  {/* Waiting */}
                  {patients.filter(p => p.status === 'waiting').map((p, i) => (
                    <QueueCard key={p.id} p={p} index={i} />
                  ))}
                  {/* In progress */}
                  {patients.filter(p => p.status === 'in_progress').map((p, i) => (
                    <QueueCard key={p.id} p={p} index={i} />
                  ))}
                  {/* Done — dimmed */}
                  {patients.filter(p => p.status === 'done').length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider px-1 mb-2">Completed</p>
                      {patients.filter(p => p.status === 'done').map((p, i) => (
                        <QueueCard key={p.id} p={p} index={i} dim />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 pb-4">
              <a href="/api/export"
                className="block text-center text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-xl transition font-semibold shadow-sm">
                ↓ Export Excel
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white text-sm px-5 py-3.5 rounded-2xl shadow-2xl z-50 flex items-center gap-2.5 border border-indigo-700/30">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function QueueCard({ p, index, dim }: { p: Patient; index: number; dim?: boolean }) {
  const s = STATUS_STYLE[p.status] || STATUS_STYLE.waiting
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: dim ? 0.5 : 1, x: 0 }}
      transition={{ delay: index * 0.04 }} layout
      className={`rounded-xl border px-4 py-3 flex items-center gap-3 transition
        ${p.is_emergency ? 'border-red-300 bg-red-50' : s.bg}`}>
      <div className={`text-base font-bold tabular-nums w-11 text-center shrink-0 ${p.is_emergency ? 'text-red-600' : 'text-indigo-600'}`}>
        #{String(p.queue_number).padStart(3, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {p.age} yrs · {new Date(p.check_in_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="shrink-0">
        {p.is_emergency
          ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">EMRG</span>
          : <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.text} bg-white/80 border border-current/20`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {p.status.replace('_', ' ')}
            </span>
        }
      </div>
    </motion.div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', required, error }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; type?: string; required?: boolean; error?: string
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className={`field-input ${error ? 'border-red-400 focus:ring-red-400' : ''}`} />
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  )
}
