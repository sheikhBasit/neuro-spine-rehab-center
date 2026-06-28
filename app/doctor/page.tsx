'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Patient {
  id: number; name: string; age: number; queue_number: number; is_emergency: boolean
  status: string; check_in_at: string; guardian_name: string; cnic_bform: string
  phone: string; address: string; doctor_name?: string
}
interface Document { id: number; url: string; file_name: string }
interface Medicine { name: string; dosage: string; instructions: string }
interface Prescription {
  id: number; doctor_name: string; medicines: Medicine[] | null; image_url: string | null; notes: string; created_at: string
}
interface PatientDetail extends Patient { documents: Document[]; prescriptions: Prescription[] }

const S: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  waiting:     { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400',     border: 'border-sky-200' },
  in_progress: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   border: 'border-amber-200' },
  done:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', border: 'border-emerald-200' },
}

function Badge({ status, emergency }: { status: string; emergency?: boolean }) {
  if (emergency) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">🚨 EMERGENCY</span>
  const s = S[status] || S.waiting
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.text} ${s.bg} border ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}

function minsAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : `${m}m ago`
}

function fmtElapsed(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

type ShiftState = { status: 'idle' } | { status: 'active'; startedAt: number; attendanceId: number } | { status: 'break'; startedAt: number; attendanceId: number; breakAt: number }

export default function DoctorPanel() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<PatientDetail | null>(null)
  const [user, setUser] = useState<{ name: string; id: number } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [medicines, setMedicines] = useState<Medicine[]>([{ name: '', dosage: '', instructions: '' }])
  const [rxNotes, setRxNotes] = useState('')
  const [rxImage, setRxImage] = useState<File | null>(null)
  const [rxSaving, setRxSaving] = useState(false)
  const [rxTab, setRxTab] = useState<'manual' | 'photo'>('manual')
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<'all' | 'waiting' | 'in_progress' | 'done'>('all')
  const [shift, setShift] = useState<ShiftState>({ status: 'idle' })
  const [elapsed, setElapsed] = useState(0)

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // Shift timer
  useEffect(() => {
    const saved = localStorage.getItem('doctor_shift')
    if (saved) setShift(JSON.parse(saved))
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (shift.status === 'active') setElapsed(Math.floor((Date.now() - shift.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [shift])

  const saveShift = (s: ShiftState) => { setShift(s); localStorage.setItem('doctor_shift', JSON.stringify(s)) }

  const startShift = async () => {
    const r = await fetch('/api/attendance', { method: 'POST' })
    const rec = await r.json()
    const s: ShiftState = { status: 'active', startedAt: Date.now(), attendanceId: rec.id }
    saveShift(s); setElapsed(0); notify('Shift started ✓')
  }

  const takeBreak = async () => {
    if (shift.status !== 'active') return
    await fetch(`/api/attendance/${shift.attendanceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'break_start' })
    })
    saveShift({ status: 'break', startedAt: shift.startedAt, attendanceId: shift.attendanceId, breakAt: Date.now() })
    notify('On break')
  }

  const resumeShift = async () => {
    if (shift.status !== 'break') return
    await fetch(`/api/attendance/${shift.attendanceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'break_end' })
    })
    saveShift({ status: 'active', startedAt: shift.startedAt, attendanceId: shift.attendanceId })
    notify('Shift resumed')
  }

  const endShift = async () => {
    const id = shift.status !== 'idle' ? (shift as { attendanceId: number }).attendanceId : null
    if (id) {
      await fetch(`/api/attendance/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'shift_end' })
      })
    }
    saveShift({ status: 'idle' }); setElapsed(0); notify('Shift ended')
  }

  const loadQueue = useCallback(async () => {
    const r = await fetch('/api/patients')
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) {
      const data = await r.json()
      setPatients(data)
      localStorage.setItem('cache_doctor_queue', JSON.stringify(data))
    }
  }, [router])

  useEffect(() => {
    const cached = localStorage.getItem('cache_doctor_queue')
    if (cached) setPatients(JSON.parse(cached))
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d))
    loadQueue()
    const id = setInterval(loadQueue, 3000)
    return () => clearInterval(id)
  }, [loadQueue])

  const openPatient = async (p: Patient) => {
    const r = await fetch(`/api/patients/${p.id}`)
    if (r.ok) { setSelected(await r.json()); setMedicines([{ name: '', dosage: '', instructions: '' }]); setRxNotes(''); setRxImage(null) }
  }

  const refreshSelected = async () => {
    if (!selected) return
    const r = await fetch(`/api/patients/${selected.id}`)
    if (r.ok) setSelected(await r.json())
  }

  const updateStatus = async (status: string) => {
    if (!selected) return
    setActionLoading(true)
    await fetch(`/api/patients/${selected.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    })
    notify(status === 'in_progress' ? 'Patient called in' : status === 'done' ? 'Patient marked as done ✓' : 'Status updated')
    await loadQueue()
    await refreshSelected()
    setActionLoading(false)
  }

  const savePrescription = async () => {
    if (!selected) return
    setRxSaving(true)
    const fd = new FormData()
    fd.append('patient_id', String(selected.id))
    fd.append('notes', rxNotes)
    if (rxTab === 'manual') {
      const valid = medicines.filter(m => m.name.trim())
      if (!valid.length) { notify('Add at least one medicine'); setRxSaving(false); return }
      fd.append('medicines', JSON.stringify(valid))
    } else if (rxImage) {
      fd.append('file', rxImage)
    } else {
      notify('Upload a prescription image'); setRxSaving(false); return
    }
    const r = await fetch('/api/prescriptions', { method: 'POST', body: fd })
    if (r.ok) {
      notify('Prescription saved ✓')
      setMedicines([{ name: '', dosage: '', instructions: '' }])
      setRxNotes(''); setRxImage(null)
      await refreshSelected()
    } else {
      const d = await r.json()
      notify(d.error || 'Failed to save prescription')
    }
    setRxSaving(false)
  }

  const addMed = () => setMedicines(m => [...m, { name: '', dosage: '', instructions: '' }])
  const removeMed = (i: number) => setMedicines(m => m.filter((_, idx) => idx !== i))
  const updateMed = (i: number, k: keyof Medicine, v: string) =>
    setMedicines(m => m.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const filtered = patients.filter(p => filter === 'all' || p.status === filter)
  const emergency = filtered.filter(p => p.is_emergency)
  const regular = filtered.filter(p => !p.is_emergency)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-lg border-b border-indigo-800/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-sky-400 rounded-xl flex items-center justify-center text-sm font-bold shadow-md">NS</div>
          <div>
            <p className="font-bold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-indigo-300 text-xs">Doctor Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Shift widget */}
          {shift.status === 'idle' ? (
            <button onClick={startShift}
              className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-full font-semibold transition shadow">
              ▶ Start Shift
            </button>
          ) : shift.status === 'active' ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {fmtElapsed(elapsed)}
              </span>
              <button onClick={takeBreak}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-white px-2.5 py-1.5 rounded-full font-semibold transition">
                ⏸ Break
              </button>
              <button onClick={endShift}
                className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2.5 py-1.5 rounded-full font-semibold transition">
                ■ End
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400 font-semibold">On Break</span>
              <button onClick={resumeShift}
                className="text-xs bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-full font-semibold transition">
                ▶ Resume
              </button>
            </div>
          )}
          <span className="text-xs bg-indigo-800/60 border border-indigo-700/40 px-3 py-1.5 rounded-full font-medium">{user?.name}</span>
          <button onClick={logout} className="text-xs text-indigo-300 hover:text-white transition font-medium">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 p-6">
        {/* Filter bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Live Patient Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
              Auto-refreshes every 3 seconds · {patients.length} patients today
            </p>
          </div>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(['all', 'waiting', 'in_progress', 'done'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filter === f ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                {f === 'all' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Emergency section */}
        <AnimatePresence>
          {emergency.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Emergency Patients
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {emergency.map((p, i) => <PatientCard key={p.id} p={p} onClick={() => openPatient(p)} index={i} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Regular queue */}
        {regular.length === 0 && emergency.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-medium">No patients in queue</p>
          </div>
        ) : regular.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence>
              {regular.map((p, i) => <PatientCard key={p.id} p={p} onClick={() => openPatient(p)} index={i} />)}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      {/* Detail side panel */}
      <AnimatePresence>
        {selected && (
          <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setSelected(null)} />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full md:w-[540px] bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Panel header */}
              <div className={`px-6 py-5 border-b flex items-start justify-between
                ${selected.is_emergency ? 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200' : 'bg-gradient-to-br from-indigo-50 to-white border-slate-200'}`}>
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className={`text-3xl font-black tabular-nums ${selected.is_emergency ? 'text-red-600' : 'text-indigo-600'}`}>
                      #{String(selected.queue_number).padStart(3, '0')}
                    </span>
                    <Badge status={selected.status} emergency={selected.is_emergency} />
                  </div>
                  <p className="font-bold text-slate-800 text-lg">{selected.name} <span className="text-slate-500 font-normal text-base">· {selected.age} yrs</span></p>
                  {selected.doctor_name && <p className="text-xs text-slate-500 mt-0.5">Being seen by {selected.doctor_name}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Patient info */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Patient Information</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {[
                      ['Guardian', selected.guardian_name || '—'],
                      ['CNIC / B-Form', selected.cnic_bform || '—'],
                      ['Phone', selected.phone],
                      ['Check-in', new Date(selected.check_in_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-slate-400 font-medium">{k}</p>
                        <p className="font-semibold text-slate-700 truncate mt-0.5">{v}</p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 font-medium">Address</p>
                      <p className="font-semibold text-slate-700 mt-0.5">{selected.address}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Actions</p>
                  <div className="flex gap-2">
                    {selected.status === 'waiting' && (
                      <button onClick={() => updateStatus('in_progress')} disabled={actionLoading}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 rounded-xl transition shadow-md shadow-amber-200 disabled:opacity-60">
                        📢 Call Patient
                      </button>
                    )}
                    {selected.status === 'in_progress' && (
                      <button onClick={() => updateStatus('done')} disabled={actionLoading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-xl transition shadow-md shadow-emerald-200 disabled:opacity-60">
                        ✓ Mark as Done
                      </button>
                    )}
                    {selected.status !== 'waiting' && (
                      <button onClick={() => updateStatus('waiting')} disabled={actionLoading}
                        className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-60">
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Documents */}
                {selected.documents.length > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Documents ({selected.documents.length})</p>
                    <div className="space-y-2">
                      {selected.documents.map(d => (
                        <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-2.5 rounded-xl transition hover:bg-indigo-100">
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="font-medium">{d.file_name}</span>
                          <span className="ml-auto text-xs text-indigo-400">View ↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past prescriptions */}
                {selected.prescriptions.length > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Previous Prescriptions</p>
                    <div className="space-y-3">
                      {selected.prescriptions.map(rx => (
                        <div key={rx.id} className="bg-slate-50 rounded-xl p-3.5 text-sm border border-slate-100">
                          <p className="text-xs text-slate-400 mb-2 font-medium">
                            By {rx.doctor_name} · {new Date(rx.created_at).toLocaleDateString()}
                          </p>
                          {rx.image_url && (
                            <a href={rx.image_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 text-xs hover:underline mb-2 font-medium">
                              View Prescription Image ↗
                            </a>
                          )}
                          {rx.medicines && rx.medicines.length > 0 && (
                            <ul className="space-y-1.5">
                              {rx.medicines.map((m, i) => (
                                <li key={i} className="text-slate-700 flex gap-1">
                                  <span className="text-indigo-400">•</span>
                                  <span><span className="font-semibold">{m.name}</span>
                                    {m.dosage && <span className="text-slate-500"> · {m.dosage}</span>}
                                    {m.instructions && <span className="text-slate-500 italic"> — {m.instructions}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {rx.notes && <p className="text-slate-500 mt-1.5 text-xs italic border-t border-slate-200 pt-1.5">{rx.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add prescription */}
                <div className="px-6 py-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Add Prescription</p>
                  <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
                    {(['manual', 'photo'] as const).map(t => (
                      <button key={t} onClick={() => setRxTab(t)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${rxTab === t ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t === 'manual' ? '💊 Enter Medicines' : '📷 Upload Photo'}
                      </button>
                    ))}
                  </div>

                  {rxTab === 'manual' ? (
                    <div className="space-y-2">
                      {medicines.map((m, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-start">
                          <input value={m.name} onChange={e => updateMed(i, 'name', e.target.value)}
                            placeholder="Medicine name" className="col-span-4 input-sm" />
                          <input value={m.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)}
                            placeholder="Dosage" className="col-span-3 input-sm" />
                          <input value={m.instructions} onChange={e => updateMed(i, 'instructions', e.target.value)}
                            placeholder="Instructions" className="col-span-4 input-sm" />
                          {medicines.length > 1 && (
                            <button onClick={() => removeMed(i)} className="col-span-1 text-slate-400 hover:text-red-500 transition text-center pt-2 text-lg">✕</button>
                          )}
                        </div>
                      ))}
                      <button onClick={addMed} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 mt-1">
                        + Add Medicine
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition bg-white">
                      {rxImage ? (
                        <p className="text-sm text-slate-600 font-medium">{rxImage.name}</p>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-slate-500 font-medium">Upload prescription photo</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => setRxImage(e.target.files?.[0] || null)} />
                    </label>
                  )}

                  <textarea value={rxNotes} onChange={e => setRxNotes(e.target.value)}
                    placeholder="Additional notes (optional)" rows={2}
                    className="field-input mt-3 resize-none" />

                  <button onClick={savePrescription} disabled={rxSaving}
                    className="btn-primary w-full mt-3 py-3 text-sm">
                    {rxSaving ? 'Saving…' : 'Save Prescription'}
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
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

function PatientCard({ p, onClick, index }: { p: Patient; onClick: () => void; index: number }) {
  const s = S[p.status] || S.waiting
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }} layout
      onClick={onClick}
      className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all group hover:shadow-xl hover:-translate-y-0.5
        ${p.is_emergency ? 'border-red-300 hover:border-red-400' : 'border-slate-200 hover:border-indigo-300'}`}
      style={{ transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s' }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-3xl font-black tabular-nums ${p.is_emergency ? 'text-red-600' : 'text-indigo-600'}`}>
          #{String(p.queue_number).padStart(3, '0')}
        </span>
        <Badge status={p.status} emergency={p.is_emergency} />
      </div>
      <p className="font-bold text-slate-800 truncate text-base">{p.name}</p>
      <p className="text-xs text-slate-500 mt-1">{p.age} yrs · {minsAgo(p.check_in_at)}</p>
      {p.doctor_name && <p className="text-xs text-indigo-500 mt-1 font-medium">With {p.doctor_name}</p>}
      <p className="text-xs text-indigo-500 mt-3 group-hover:text-indigo-700 transition font-semibold">Open Details →</p>
    </motion.div>
  )
}
