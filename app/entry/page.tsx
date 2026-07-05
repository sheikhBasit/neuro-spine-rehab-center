'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { installRoleFetch } from '@/lib/roleFetch'

interface Patient {
  id: number; name: string; age: number; queue_number: number
  is_emergency: boolean; status: string; check_in_at: string; phone: string
  payment_method: string; bill_amount: number; discount: number
  amount_paid: number; change_due: number; payment_status: string
}
interface LookupResult { id: number; name: string; age: number; guardian_name: string; cnic_bform: string; phone: string; address: string }

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  waiting:     { bg: 'bg-sky-50 border-sky-200',       text: 'text-sky-700',     dot: 'bg-sky-400' },
  in_progress: { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  done:        { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
}

const PAY_METHODS = [
  { key: 'cash',       label: '💵 Cash',      color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { key: 'easypaisa', label: '📱 EasyPaisa',  color: 'border-green-400 bg-green-50 text-green-700' },
  { key: 'jazzcash',  label: '🔴 JazzCash',   color: 'border-red-400 bg-red-50 text-red-700' },
  { key: 'bank',      label: '🏦 Bank',       color: 'border-blue-400 bg-blue-50 text-blue-700' },
]

const todayStr = () => new Date().toISOString().slice(0, 16) // 'YYYY-MM-DDTHH:MM'
const dateLabel = (d: string) => new Date(d).toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

const blank = {
  name: '', age: '', gender: 'male', guardian_name: '', cnic_bform: '', phone: '', address: '',
  is_emergency: false,
  bp: '', temperature: '', pulse: '', weight: '',
  payment_method: 'cash', bill_amount: '', discount: '', amount_paid: '',
  check_in_at: '',
}

function validateCNIC(v: string) { const d = v.replace(/[-\s]/g, ''); return d === '' || d.length === 13 }
function validatePhone(v: string) { return v.replace(/[-\s]/g, '').length === 11 }

function pkr(n: number | string) { return `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}` }

export default function EntryPanel() {
  installRoleFetch('data_entry')
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
  const [queueDate, setQueueDate] = useState(new Date().toISOString().slice(0, 10))
  const queueDateRef = useRef(new Date().toISOString().slice(0, 10))
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const jumpToForm = () => {
    nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    nameInputRef.current?.focus()
  }

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'cnic_bform') setCnicError(validateCNIC(v) ? '' : 'Must be exactly 13 digits')
    if (k === 'phone') {
      setPhoneError(v.length > 3 && !validatePhone(v) ? 'Must be 11 digits' : '')
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
      if (v.replace(/[-\s]/g, '').length >= 6) {
        lookupTimer.current = setTimeout(async () => {
          const r = await fetch(`/api/patients/lookup?phone=${encodeURIComponent(v)}`)
          if (r.ok) { const d = await r.json(); setLookupResults(d); setShowLookup(d.length > 0) }
        }, 400)
      } else { setLookupResults([]); setShowLookup(false) }
    }
  }

  const prefill = (p: LookupResult) => {
    setForm(f => ({ ...f, name: p.name, age: String(p.age), guardian_name: p.guardian_name, cnic_bform: p.cnic_bform, address: p.address }))
    setCnicError(''); setShowLookup(false)
  }

  const loadQueue = useCallback(async (date?: string) => {
    const d = date ?? queueDateRef.current
    const r = await fetch(`/api/patients?date=${d}`)
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) {
      const data = await r.json()
      setPatients(data)
      if (d === new Date().toISOString().slice(0, 10))
        localStorage.setItem('cache_entry_queue', JSON.stringify(data))
    }
  }, [router])

  useEffect(() => {
    const cached = localStorage.getItem('cache_entry_queue')
    if (cached) setPatients(JSON.parse(cached))
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d))
    loadQueue()
    const id = setInterval(() => loadQueue(), 3000)
    return () => clearInterval(id)
  }, [loadQueue])

  // Cash change calculation
  const bill    = parseFloat(form.bill_amount)  || 0
  const disc    = parseFloat(form.discount)     || 0
  const netBill = Math.max(0, bill - disc)
  const paid    = parseFloat(form.amount_paid)  || 0
  const change  = form.payment_method === 'cash' ? paid - netBill : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cnicError) return
    if (!validatePhone(form.phone)) { setPhoneError('Must be 11 digits'); return }
    setSubmitting(true); setError('')

    const body = {
      ...form,
      age: parseInt(form.age),
      bill_amount:  bill,
      discount:     disc,
      amount_paid:  paid,
      payment_status: paid >= netBill && netBill > 0 ? 'paid' : netBill === 0 ? 'pending' : paid > 0 ? 'partial' : 'pending',
      check_in_at: form.check_in_at || undefined,
    }

    const res = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to register patient'); setSubmitting(false); return }

    let docWarn = ''
    for (const file of files) {
      const fd = new FormData(); fd.append('file', file); fd.append('patient_id', String(data.id))
      const dr = await fetch('/api/documents', { method: 'POST', body: fd })
      if (!dr.ok) { const de = await dr.json(); docWarn = de.error || 'Document upload failed' }
    }

    notify(`Patient #${String(data.queue_number).padStart(3, '0')} registered${docWarn ? ' (⚠ ' + docWarn + ')' : ''}`)
    // Keep check_in_at pinned to selected date so batch entry stays on same date
    const keepDate = queueDateRef.current
    setForm({ ...blank, check_in_at: isToday ? '' : `${keepDate}T09:00` })
    setFiles([]); setFileKey(k => k + 1); setPhoneError(''); setCnicError('')
    await loadQueue(keepDate)
    setSubmitting(false)
  }

  const deletePatient = async (id: number) => {
    await fetch(`/api/patients/${id}`, { method: 'DELETE' })
    await loadQueue()
  }

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const todayISO = new Date().toISOString().slice(0, 10)
  const isToday  = queueDate === todayISO

  // When the date changes, sync form.check_in_at so new registrations land on that date
  const changeDate = (date: string) => {
    queueDateRef.current = date
    setQueueDate(date)
    if (date === todayISO) {
      setForm(f => ({ ...f, check_in_at: '' }))
    } else {
      setForm(f => ({ ...f, check_in_at: `${date}T09:00` }))
    }
    loadQueue(date)
  }

  const waiting    = patients.filter(p => p.status === 'waiting').length
  const inProgress = patients.filter(p => p.status === 'in_progress').length
  const done       = patients.filter(p => p.status === 'done').length

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-lg border-b border-indigo-800/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-sky-400 rounded-xl flex items-center justify-center text-sm font-bold shadow-md">NS</div>
          <div>
            <p className="font-bold text-sm leading-tight">Neuro Spine Rehab Center</p>
            <p className="text-indigo-300 text-xs">Data Entry</p>
          </div>
        </div>

        {/* Central date selector — controls both view & add */}
        <div className="flex items-center gap-2 bg-indigo-900/60 border border-indigo-700/40 rounded-xl px-3 py-1.5">
          {!isToday && (
            <button onClick={() => changeDate(todayISO)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition whitespace-nowrap">
              ← Today
            </button>
          )}
          <input
            type="date"
            value={queueDate}
            max={todayISO}
            onChange={e => changeDate(e.target.value)}
            className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer [color-scheme:dark]"
          />
          {!isToday && (
            <span className="text-xs text-amber-400 font-bold whitespace-nowrap">📅 Historical</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={jumpToForm}
            className="text-xs bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white px-3.5 py-1.5 rounded-full font-bold shadow-sm transition flex items-center gap-1.5">
            <span className="text-sm leading-none">+</span> Register Patient
          </button>
          <span className="text-xs bg-indigo-800/60 border border-indigo-700/40 px-3 py-1.5 rounded-full font-medium">
            Data Entry{user ? ` · ${user.name}` : ''}
          </span>
          <button onClick={logout} className="text-xs text-indigo-300 hover:text-white transition font-medium">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 max-w-[1600px] mx-auto w-full">
        {/* Left: Registration form */}
        <div className="lg:col-span-3 p-6 overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Register Patient</h2>
                <p className="text-xs text-slate-500">
                  Adding to: <span className={`font-bold ${isToday ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isToday ? 'Today' : dateLabel(queueDate)}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Emergency toggle */}
              <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer select-none transition
                ${form.is_emergency ? 'border-red-400 bg-red-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <input type="checkbox" checked={form.is_emergency}
                  onChange={e => setForm(f => ({ ...f, is_emergency: e.target.checked }))} className="w-4 h-4 accent-red-500" />
                <div>
                  <p className="text-sm font-bold text-red-700">🚨 Emergency / Priority Case</p>
                  <p className="text-xs text-slate-500">Patient floats to top of queue</p>
                </div>
              </label>

              {/* Patient info */}
              <div className="card p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Full Name *"           value={form.name}           onChange={set('name')}           placeholder="Patient full name"   required inputRef={nameInputRef} />
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender *</label>
                    <div className="flex gap-2">
                      {[['male','👨 Male'],['female','👩 Female'],['other','⚧ Other']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setForm(f => ({ ...f, gender: v }))}
                          className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition
                            ${form.gender === v ? v === 'male' ? 'border-blue-400 bg-blue-50 text-blue-700' : v === 'female' ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-purple-400 bg-purple-50 text-purple-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="Age *"                 value={form.age}            onChange={set('age')}            placeholder="e.g. 45" type="number" required />
                  <Field label="Father / Husband Name" value={form.guardian_name}  onChange={set('guardian_name')}  placeholder="Guardian name" />
                  <Field label="CNIC / B-Form No."     value={form.cnic_bform}     onChange={set('cnic_bform')}     placeholder="35202-XXXXXXX-1" error={cnicError} />
                  <div className="relative">
                    <Field label="Phone Number *" value={form.phone} onChange={set('phone')} placeholder="03XX-XXXXXXX" required error={phoneError} />
                    <AnimatePresence>
                      {showLookup && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute top-full left-0 right-0 z-10 mt-1 bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-lg">
                          <p className="text-xs font-bold text-amber-700 mb-2">Family members already on this number — click to pre-fill their details:</p>
                          {lookupResults.map(p => (
                            <button key={p.id} type="button" onClick={() => prefill(p)}
                              className="w-full text-left px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition text-sm mb-1">
                              <span className="font-semibold text-slate-800">{p.name}</span>
                              <span className="text-slate-500 text-xs ml-2">{p.age} yrs · {p.cnic_bform || 'No CNIC'}</span>
                            </button>
                          ))}
                          <button type="button" onClick={() => setShowLookup(false)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition">
                            None of these — register a new family member with this number
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address *</label>
                    <textarea value={form.address} onChange={set('address')} required rows={2}
                      className="field-input resize-none" placeholder="Street, City, District" />
                  </div>
                </div>
              </div>

              {/* Vitals */}
              <div className="card p-5">
                <p className="text-sm font-bold text-slate-700 mb-3">Vitals <span className="text-xs font-normal text-slate-400 ml-1">(optional)</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'bp',          label: 'BP',           placeholder: 'e.g. 120/80',  unit: 'mmHg' },
                    { key: 'temperature', label: 'Temperature',  placeholder: 'e.g. 98.6',    unit: '°F' },
                    { key: 'pulse',       label: 'Pulse',        placeholder: 'e.g. 72',      unit: 'bpm' },
                    { key: 'weight',      label: 'Weight',       placeholder: 'e.g. 65',      unit: 'kg' },
                  ].map(v => (
                    <div key={v.key}>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{v.label}</label>
                      <div className="relative">
                        <input value={(form as unknown as Record<string,string>)[v.key]} onChange={set(v.key)}
                          placeholder={v.placeholder} className="field-input pr-10 text-sm" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">{v.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Check-in date & time */}
              <div className={`card p-5 ${!isToday ? 'border-2 border-amber-300 bg-amber-50/40' : ''}`}>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Date &amp; Time of Visit
                  {!isToday && <span className="ml-2 text-xs font-bold text-amber-600">← set from date picker above</span>}
                  {isToday && <span className="ml-2 text-xs font-normal text-slate-400">(defaults to now — change to backdate)</span>}
                </label>
                <div className="flex gap-3 items-center">
                  <input type="datetime-local" value={form.check_in_at}
                    max={todayStr()}
                    onChange={e => setForm(f => ({ ...f, check_in_at: e.target.value }))}
                    className="field-input flex-1" />
                  {form.check_in_at && isToday && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, check_in_at: '' }))}
                      className="text-xs text-slate-400 hover:text-slate-600 transition whitespace-nowrap">✕ Now</button>
                  )}
                </div>
              </div>

              {/* Payment */}
              <div className="card p-5 space-y-4">
                <p className="text-sm font-bold text-slate-700">Payment</p>

                {/* Method selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAY_METHODS.map(m => (
                    <button key={m.key} type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: m.key }))}
                      className={`py-2.5 rounded-xl border-2 text-xs font-bold transition ${form.payment_method === m.key ? m.color : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bill Amount (PKR)</label>
                    <input type="number" min={0} step={1} value={form.bill_amount} onChange={set('bill_amount')}
                      placeholder="0" className="field-input" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Discount (PKR)</label>
                    <input type="number" min={0} step={1} value={form.discount} onChange={set('discount')}
                      placeholder="0" className="field-input" />
                  </div>
                </div>

                {/* Net bill */}
                {(bill > 0 || disc > 0) && (
                  <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-2.5 border border-indigo-100">
                    <span className="text-sm text-indigo-600 font-semibold">Net Bill</span>
                    <span className="text-lg font-black text-indigo-700">{pkr(netBill)}</span>
                  </div>
                )}

                {/* Cash: amount received + change */}
                {form.payment_method === 'cash' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount Received (PKR)</label>
                      <input type="number" min={0} step={1} value={form.amount_paid} onChange={set('amount_paid')}
                        placeholder="0" className="field-input" />
                    </div>
                    {paid > 0 && (
                      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                        className={`rounded-xl px-4 py-3 border-2 flex items-center justify-between
                          ${change >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                        <span className={`text-sm font-bold ${change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {change >= 0 ? '💰 Change to Return' : '⚠️ Amount Short'}
                        </span>
                        <span className={`text-xl font-black ${change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {pkr(Math.abs(change))}
                        </span>
                      </motion.div>
                    )}
                  </>
                )}

                {/* Payment status badge */}
                {netBill > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    Status:&nbsp;
                    <span className={`px-2.5 py-1 rounded-full font-bold border ${
                      paid >= netBill ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : paid > 0 ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {paid >= netBill ? '✓ Paid' : paid > 0 ? 'Partial' : 'Pending'}
                    </span>
                  </div>
                )}
              </div>

              {/* Document upload */}
              <div className="card p-5">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Related Documents</label>
                <label key={fileKey} className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition bg-white">
                  <svg className="w-5 h-5 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-slate-500 font-medium">Upload X-rays, reports…</span>
                  <input type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                        <svg className="w-3 h-3 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
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
        <div className="lg:col-span-2 border-l border-slate-200 bg-white/60">
          <div className="sticky top-[65px] h-[calc(100vh-65px)] flex flex-col">
            {/* Queue header */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800">Queue</h2>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  {isToday ? 'Live' : dateLabel(queueDate).split(',')[0]}
                </span>
              </div>

              {/* Date picker — mirrors the navbar date selector */}
              <div className="flex gap-2 items-center mb-3">
                <input type="date" value={queueDate} max={todayISO}
                  onChange={e => changeDate(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm flex-1" />
                {!isToday && (
                  <button onClick={() => changeDate(todayISO)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold whitespace-nowrap transition">Today</button>
                )}
              </div>

              <div className="flex gap-2">
                {[{ l: 'Wait', n: waiting, c: 'bg-sky-100 text-sky-700' }, { l: 'Active', n: inProgress, c: 'bg-amber-100 text-amber-700' }, { l: 'Done', n: done, c: 'bg-emerald-100 text-emerald-700' }].map(s => (
                  <div key={s.l} className={`flex-1 text-center py-1.5 rounded-lg ${s.c}`}>
                    <p className="text-lg font-black">{s.n}</p>
                    <p className="text-xs font-semibold">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Queue list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {patients.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No patients for this date</div>
              ) : (
                <>
                  {patients.filter(p => p.is_emergency).map((p, i) => <QCard key={p.id} p={p} i={i} onDelete={deletePatient} />)}
                  {patients.filter(p => !p.is_emergency && p.status === 'waiting').map((p, i) => <QCard key={p.id} p={p} i={i} onDelete={deletePatient} />)}
                  {patients.filter(p => !p.is_emergency && p.status === 'in_progress').map((p, i) => <QCard key={p.id} p={p} i={i} onDelete={deletePatient} />)}
                  {patients.filter(p => p.status === 'done').map((p, i) => <QCard key={p.id} p={p} i={i} dim onDelete={deletePatient} />)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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

function QCard({ p, i, dim, onDelete }: { p: Patient; i: number; dim?: boolean; onDelete?: (id: number) => void }) {
  const s = STATUS_STYLE[p.status] || STATUS_STYLE.waiting
  const payColor = p.payment_status === 'paid' ? 'text-emerald-600' : p.payment_status === 'partial' ? 'text-amber-600' : 'text-slate-400'
  const dt = new Date(p.check_in_at)
  const timeStr = dt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  const dateStr = dt.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })
  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: dim ? 0.45 : 1, x: 0 }} transition={{ delay: i * 0.03 }}
      className={`rounded-xl border px-4 py-3 bg-white transition group ${p.is_emergency ? 'border-red-300 bg-red-50' : `border-slate-200 ${s.bg}`}`}>
      <div className="flex items-center gap-3">
        <span className={`text-xl font-black tabular-nums w-12 shrink-0 ${p.is_emergency ? 'text-red-600' : 'text-slate-600'}`}>
          #{String(p.queue_number).padStart(3, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
          <p className="text-xs text-slate-500">{p.age} yrs · {dateStr} · {timeStr}</p>
        </div>
        <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
          <span className={`flex items-center gap-1 text-xs font-bold ${p.is_emergency ? 'text-red-600' : s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.is_emergency ? 'bg-red-500' : s.dot}`} />
            {p.is_emergency ? 'EMRG' : p.status === 'in_progress' ? 'Active' : p.status}
          </span>
          {p.bill_amount > 0 && (
            <span className={`text-xs font-semibold ${payColor}`}>
              PKR {Number(p.bill_amount).toLocaleString()}
            </span>
          )}
          {onDelete && (
            <button onClick={() => { if (confirm(`Delete ${p.name} from queue?`)) onDelete(p.id) }}
              className="text-xs text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 leading-none mt-0.5">
              ✕ delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required, error, inputRef }:
  { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; placeholder?: string; required?: boolean; error?: string; inputRef?: React.MutableRefObject<HTMLInputElement | null> }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <input ref={inputRef} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className={`field-input ${error ? 'border-red-400 focus:ring-red-400' : ''}`} />
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  )
}
