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

const S: Record<string, string> = {
  waiting:     'bg-sky-100 text-sky-700 border-sky-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  done:        'bg-emerald-100 text-emerald-700 border-emerald-200',
}

function Badge({ status, emergency }: { status: string; emergency?: boolean }) {
  if (emergency) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">🚨 EMERGENCY</span>
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${S[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{status.replace('_',' ').toUpperCase()}</span>
}

function minsAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : `${m}m ago`
}

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

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

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

  const openPatient = async (p: Patient) => {
    const r = await fetch(`/api/patients/${p.id}`)
    if (r.ok) { setSelected(await r.json()); setMedicines([{ name:'',dosage:'',instructions:'' }]); setRxNotes(''); setRxImage(null) }
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
    notify(status === 'in_progress' ? 'Patient called in' : status === 'done' ? 'Patient marked as done' : 'Status updated')
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
      notify('Prescription saved')
      setMedicines([{ name:'',dosage:'',instructions:'' }])
      setRxNotes(''); setRxImage(null)
      await refreshSelected()
    }
    setRxSaving(false)
  }

  const addMed = () => setMedicines(m => [...m, { name:'',dosage:'',instructions:'' }])
  const removeMed = (i: number) => setMedicines(m => m.filter((_,idx) => idx !== i))
  const updateMed = (i: number, k: keyof Medicine, v: string) =>
    setMedicines(m => m.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const filtered = patients.filter(p => filter === 'all' || p.status === filter)
  const emergency = filtered.filter(p => p.is_emergency)
  const regular   = filtered.filter(p => !p.is_emergency)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-xs font-bold">NS</div>
          <div>
            <p className="font-semibold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-slate-400 text-xs">Doctor Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-700 px-2.5 py-1 rounded-full">{user?.name}</span>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white transition">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 p-6">
        {/* Filter bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Live Patient Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">Auto-refreshes every 3 seconds · {patients.length} patients today</p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['all','waiting','in_progress','done'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === f ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'all' ? 'All' : f.replace('_',' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Emergency section */}
        {emergency.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">🚨 Emergency Patients</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {emergency.map(p => <PatientCard key={p.id} p={p} onClick={() => openPatient(p)} />)}
            </div>
          </div>
        )}

        {/* Regular queue */}
        {regular.length === 0 && emergency.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm">No patients in queue</div>
        ) : regular.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence>
              {regular.map(p => <PatientCard key={p.id} p={p} onClick={() => openPatient(p)} />)}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      {/* Detail side panel */}
      <AnimatePresence>
        {selected && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelected(null)} />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full md:w-[520px] bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Panel header */}
              <div className={`px-6 py-4 border-b flex items-start justify-between ${selected.is_emergency ? 'bg-red-50 border-red-200' : 'border-slate-200'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-2xl font-bold tabular-nums ${selected.is_emergency ? 'text-red-600' : 'text-sky-600'}`}>
                      #{String(selected.queue_number).padStart(3,'0')}
                    </span>
                    <Badge status={selected.status} emergency={selected.is_emergency} />
                  </div>
                  <p className="font-semibold text-slate-800">{selected.name} · {selected.age} yrs</p>
                  {selected.doctor_name && <p className="text-xs text-slate-500 mt-0.5">Seen by {selected.doctor_name}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 transition p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Patient details */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Patient Information</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {[
                      ['Guardian', selected.guardian_name || '—'],
                      ['CNIC / B-Form', selected.cnic_bform || '—'],
                      ['Phone', selected.phone],
                      ['Check-in', new Date(selected.check_in_at).toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' })],
                    ].map(([k, v]) => (
                      <div key={k}><p className="text-xs text-slate-400">{k}</p><p className="font-medium text-slate-700 truncate">{v}</p></div>
                    ))}
                    <div className="col-span-2"><p className="text-xs text-slate-400">Address</p><p className="font-medium text-slate-700">{selected.address}</p></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Actions</p>
                  <div className="flex gap-2">
                    {selected.status !== 'in_progress' && selected.status !== 'done' && (
                      <button onClick={() => updateStatus('in_progress')} disabled={actionLoading}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-60">
                        Call Patient
                      </button>
                    )}
                    {selected.status === 'in_progress' && (
                      <button onClick={() => updateStatus('done')} disabled={actionLoading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-60">
                        Mark as Done ✓
                      </button>
                    )}
                    {selected.status !== 'waiting' && (
                      <button onClick={() => updateStatus('waiting')} disabled={actionLoading}
                        className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg transition disabled:opacity-60">
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Documents */}
                {selected.documents.length > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Documents ({selected.documents.length})</p>
                    <div className="space-y-2">
                      {selected.documents.map(d => (
                        <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-2 rounded-lg transition">
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {d.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past prescriptions */}
                {selected.prescriptions.length > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Previous Prescriptions</p>
                    <div className="space-y-3">
                      {selected.prescriptions.map(rx => (
                        <div key={rx.id} className="bg-slate-50 rounded-xl p-3 text-sm">
                          <p className="text-xs text-slate-400 mb-1.5">
                            By {rx.doctor_name} · {new Date(rx.created_at).toLocaleDateString()}
                          </p>
                          {rx.image_url && (
                            <a href={rx.image_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 text-xs hover:underline mb-2">
                              View Prescription Image ↗
                            </a>
                          )}
                          {rx.medicines && rx.medicines.length > 0 && (
                            <ul className="space-y-1">
                              {rx.medicines.map((m, i) => (
                                <li key={i} className="text-slate-700">
                                  <span className="font-medium">{m.name}</span>
                                  {m.dosage && <span className="text-slate-500"> · {m.dosage}</span>}
                                  {m.instructions && <span className="text-slate-500 italic"> — {m.instructions}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {rx.notes && <p className="text-slate-500 mt-1 text-xs italic">{rx.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add prescription */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Prescription</p>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4">
                    {(['manual', 'photo'] as const).map(t => (
                      <button key={t} onClick={() => setRxTab(t)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${rxTab === t ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
                        {t === 'manual' ? 'Enter Medicines' : 'Upload Photo'}
                      </button>
                    ))}
                  </div>

                  {rxTab === 'manual' ? (
                    <div className="space-y-2">
                      {medicines.map((m, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-start">
                          <input value={m.name} onChange={e => updateMed(i,'name',e.target.value)}
                            placeholder="Medicine name" className="col-span-4 input-sm" />
                          <input value={m.dosage} onChange={e => updateMed(i,'dosage',e.target.value)}
                            placeholder="Dosage" className="col-span-3 input-sm" />
                          <input value={m.instructions} onChange={e => updateMed(i,'instructions',e.target.value)}
                            placeholder="Instructions" className="col-span-4 input-sm" />
                          {medicines.length > 1 && (
                            <button onClick={() => removeMed(i)} className="col-span-1 text-slate-400 hover:text-red-500 pt-2">✕</button>
                          )}
                        </div>
                      ))}
                      <button onClick={addMed} className="text-xs text-sky-600 hover:text-sky-700 font-medium">+ Add Medicine</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-sky-400 transition">
                      {rxImage ? (
                        <p className="text-sm text-slate-600">{rxImage.name}</p>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-slate-500">Upload prescription photo</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => setRxImage(e.target.files?.[0] || null)} />
                    </label>
                  )}

                  <textarea value={rxNotes} onChange={e => setRxNotes(e.target.value)}
                    placeholder="Additional notes (optional)" rows={2}
                    className="w-full mt-3 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition" />

                  <button onClick={savePrescription} disabled={rxSaving}
                    className="w-full mt-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-60">
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-[60]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PatientCard({ p, onClick }: { p: Patient; onClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
      onClick={onClick} className={`bg-white rounded-xl border-2 p-4 cursor-pointer hover:shadow-md transition-all group
        ${p.is_emergency ? 'border-red-300 hover:border-red-400' : 'border-slate-200 hover:border-sky-300'}`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`text-2xl font-bold tabular-nums ${p.is_emergency ? 'text-red-600' : 'text-sky-600'}`}>
          #{String(p.queue_number).padStart(3,'0')}
        </span>
        <Badge status={p.status} emergency={p.is_emergency} />
      </div>
      <p className="font-semibold text-slate-800 truncate">{p.name}</p>
      <p className="text-xs text-slate-500 mt-0.5">{p.age} yrs · {minsAgo(p.check_in_at)}</p>
      <p className="text-xs text-sky-600 mt-2 group-hover:underline">View Details →</p>
    </motion.div>
  )
}
