'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Patient {
  id: number; name: string; age: number; gender: string; queue_number: number; is_emergency: boolean
  status: string; check_in_at: string; guardian_name: string; cnic_bform: string
  phone: string; address: string; doctor_name?: string
  payment_method: string; bill_amount: number; discount: number
  amount_paid: number; change_due: number; payment_status: string
}
interface Document { id: number; url: string; file_name: string }
interface Medicine { name: string; dosage: string; instructions: string }
interface Prescription {
  id: number; doctor_name: string; qualification: string; speciality: string; license_no: string
  complaint: string; history: string; examination: string; diagnosis: string
  lab_tests: string[] | null; advice: string
  medicines: Medicine[] | null; image_url: string | null; notes: string; created_at: string
}
interface PatientDetail extends Patient {
  bp: string; temperature: string; pulse: string; weight: string
  documents: Document[]; prescriptions: Prescription[]
}

const LAB_TESTS = ['CBC','LFT','RFT','Vitamin D3','CPK','Thyroid T3','T4','TSH','Anti-CCP','BSR','BSF','HbA1c']

const S: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  waiting:     { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400',     border: 'border-sky-200' },
  in_progress: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   border: 'border-amber-200' },
  done:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', border: 'border-emerald-200' },
}

function Badge({ status, emergency }: { status: string; emergency?: boolean }) {
  if (emergency) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">🚨 EMERGENCY</span>
  const s = S[status] || S.waiting
  return (
    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${s.text} ${s.bg} border ${s.border}`}>
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
  const [user, setUser] = useState<{ name: string; id: number; qualification: string; speciality: string; license_no: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [medicines, setMedicines] = useState<Medicine[]>([{ name: '', dosage: '', instructions: '' }])
  const [rxNotes, setRxNotes] = useState('')
  const [rxImage, setRxImage] = useState<File | null>(null)
  const [rxSaving, setRxSaving] = useState(false)
  const [rxTab, setRxTab] = useState<'manual' | 'photo'>('manual')
  const [rxComplaint, setRxComplaint] = useState('')
  const [rxHistory, setRxHistory] = useState('')
  const [rxExamination, setRxExamination] = useState('')
  const [rxDiagnosis, setRxDiagnosis] = useState('')
  const [rxLabTests, setRxLabTests] = useState<string[]>([])
  const [rxAdvice, setRxAdvice] = useState('')
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<'all' | 'waiting' | 'in_progress' | 'done'>('all')
  const [queueDate, setQueueDate] = useState(new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState<ShiftState>({ status: 'idle' })
  const [elapsed, setElapsed] = useState(0)

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  useEffect(() => {
    const saved = localStorage.getItem('doctor_shift')
    if (saved) {
      const s: ShiftState = JSON.parse(saved)
      setShift(s)
      if (s.status === 'active') setElapsed(Math.floor((Date.now() - s.startedAt) / 1000))
    }
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
    if (id) await fetch(`/api/attendance/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'shift_end' })
    })
    saveShift({ status: 'idle' }); setElapsed(0); notify('Shift ended')
  }

  const loadQueue = useCallback(async (date?: string) => {
    const d = date ?? queueDate
    const r = await fetch(`/api/patients?date=${d}`)
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) {
      const data = await r.json()
      setPatients(data)
      if (d === new Date().toISOString().slice(0, 10))
        localStorage.setItem('cache_doctor_queue', JSON.stringify(data))
    }
  }, [router, queueDate])

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
    if (r.ok) {
      setSelected(await r.json())
      setMedicines([{ name: '', dosage: '', instructions: '' }])
      setRxNotes(''); setRxImage(null)
      setRxComplaint(''); setRxHistory(''); setRxExamination('')
      setRxDiagnosis(''); setRxLabTests([]); setRxAdvice('')
    }
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
    notify(status === 'in_progress' ? 'Patient called in' : status === 'done' ? 'Marked as done ✓' : 'Status updated')
    await loadQueue()
    await refreshSelected()
    setActionLoading(false)
  }

  const savePrescription = async (andPrint = false) => {
    if (!selected) return
    if (rxTab === 'manual' && !rxComplaint.trim()) { notify('Chief Complaint is required'); return }
    if (rxTab === 'manual' && !rxDiagnosis.trim())  { notify('Diagnosis is required'); return }
    setRxSaving(true)
    const fd = new FormData()
    fd.append('patient_id', String(selected.id))
    fd.append('notes',       rxNotes)
    fd.append('complaint',   rxComplaint)
    fd.append('history',     rxHistory)
    fd.append('examination', rxExamination)
    fd.append('diagnosis',   rxDiagnosis)
    fd.append('lab_tests',   JSON.stringify(rxLabTests))
    fd.append('advice',      rxAdvice)
    if (rxTab === 'manual') {
      const valid = medicines.filter(m => m.name.trim())
      if (valid.length) fd.append('medicines', JSON.stringify(valid))
    } else if (rxImage) {
      fd.append('file', rxImage)
    } else {
      notify('Upload a prescription image'); setRxSaving(false); return
    }
    const r = await fetch('/api/prescriptions', { method: 'POST', body: fd })
    if (r.ok) {
      const saved = await r.json()
      // Merge doctor info from current session so printPrescription has it
      const forPrint = { ...saved, doctor_name: user?.name, qualification: user?.qualification, speciality: user?.speciality, license_no: user?.license_no }
      notify('Prescription saved ✓')
      if (andPrint) printPrescription(forPrint)
      setMedicines([{ name: '', dosage: '', instructions: '' }])
      setRxNotes(''); setRxImage(null)
      setRxComplaint(''); setRxHistory(''); setRxExamination('')
      setRxDiagnosis(''); setRxLabTests([]); setRxAdvice('')
      await refreshSelected()
    } else {
      notify((await r.json()).error || 'Failed to save')
    }
    setRxSaving(false)
  }

  const printPrescription = (rx: Prescription) => {
    if (!selected) return
    const doc = window.open('', '_blank', 'width=900,height=700')
    if (!doc) return
    const net = Math.max(0, (selected.bill_amount || 0) - (selected.discount || 0))
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Prescription — ${selected.name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;padding:24px;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #3730a3;padding-bottom:12px;margin-bottom:14px;}
      .clinic-name{font-size:22px;font-weight:800;color:#3730a3;letter-spacing:-0.5px;}
      .doctor-block{text-align:right;}
      .doctor-name{font-size:16px;font-weight:700;color:#1e293b;}
      .doctor-sub{font-size:11px;color:#64748b;margin-top:2px;}
      .patient-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:#f1f5f9;border-radius:8px;padding:10px 14px;margin-bottom:14px;}
      .pf label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;}
      .pf span{font-weight:600;color:#1e293b;font-size:12px;}
      .vitals-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;margin-bottom:14px;}
      .vf{text-align:center;}
      .vf label{font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;}
      .vf span{font-weight:700;color:#3730a3;font-size:13px;}
      .section{margin-bottom:11px;}
      .section-title{font-size:11px;font-weight:700;color:#3730a3;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #c7d2fe;padding-bottom:3px;margin-bottom:6px;}
      .section-body{font-size:12.5px;color:#334155;min-height:24px;white-space:pre-wrap;}
      .tests-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;}
      .test-item{display:flex;align-items:center;gap:6px;font-size:12px;}
      .test-item .box{width:12px;height:12px;border:1.5px solid #6366f1;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;color:#4f46e5;font-size:9px;font-weight:900;}
      .med-table{width:100%;border-collapse:collapse;font-size:12px;}
      .med-table th{background:#eef2ff;padding:6px 10px;text-align:left;font-size:10px;color:#4338ca;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
      .med-table td{padding:6px 10px;border-bottom:1px solid #f1f5f9;}
      .med-table tr:last-child td{border-bottom:none;}
      .footer{margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px dashed #cbd5e1;padding-top:10px;}
      .payment-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:#dcfce7;color:#166534;border:1px solid #86efac;}
      .sig-block{text-align:right;}
      .sig-line{width:140px;border-top:1.5px solid #1e293b;margin:40px 0 4px auto;}
      .sig-label{font-size:10px;color:#64748b;font-weight:600;}
      @media print{body{padding:0;} @page{size:A4;margin:18mm;}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="clinic-name">Neuro Spine Rehab Center</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px;">Orthopaedics, Spine &amp; Rehabilitation</div>
      </div>
      <div class="doctor-block">
        <div class="doctor-name">Dr. ${rx.doctor_name}</div>
        ${rx.qualification ? `<div class="doctor-sub">${rx.qualification}</div>` : ''}
        ${rx.speciality ? `<div class="doctor-sub">${rx.speciality}</div>` : ''}
        ${rx.license_no ? `<div class="doctor-sub">Lic# ${rx.license_no}</div>` : ''}
      </div>
    </div>
    <div class="patient-bar">
      <div class="pf"><label>Patient</label><span>${selected.name}</span></div>
      <div class="pf"><label>Age / Gender</label><span>${selected.age} yrs / ${selected.gender || 'male'}</span></div>
      <div class="pf"><label>Date</label><span>${new Date(rx.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
      <div class="pf"><label>MR #</label><span>${String(selected.queue_number).padStart(3,'0')}</span></div>
    </div>
    ${(selected.bp || selected.temperature || selected.pulse || selected.weight) ? `
    <div class="vitals-bar">
      ${[['BP',selected.bp,'mmHg'],['Temp',selected.temperature,'°F'],['Pulse',selected.pulse,'bpm'],['Weight',selected.weight,'kg']].map(([l,v,u])=>`
      <div class="vf"><label>${l}</label><span>${v||'—'} <small style="font-size:10px;font-weight:400;color:#64748b">${v?u:''}</small></span></div>`).join('')}
    </div>` : ''}
    ${rx.complaint ? `<div class="section"><div class="section-title">Chief Complaint</div><div class="section-body">${rx.complaint}</div></div>` : ''}
    ${rx.history ? `<div class="section"><div class="section-title">History</div><div class="section-body">${rx.history}</div></div>` : ''}
    ${rx.examination ? `<div class="section"><div class="section-title">Examination</div><div class="section-body">${rx.examination}</div></div>` : ''}
    ${rx.diagnosis ? `<div class="section"><div class="section-title">Diagnosis</div><div class="section-body" style="font-weight:700;font-size:13px;">${rx.diagnosis}</div></div>` : ''}
    ${rx.lab_tests && rx.lab_tests.length > 0 ? `
    <div class="section"><div class="section-title">Investigation / Lab Tests</div>
    <div class="tests-grid">${rx.lab_tests.map(t=>`<div class="test-item"><span class="box">✓</span>${t}</div>`).join('')}</div></div>` : ''}
    ${rx.medicines && rx.medicines.length > 0 ? `
    <div class="section"><div class="section-title">Rx — Medicines</div>
    <table class="med-table"><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Instructions</th></tr></thead><tbody>
    ${rx.medicines.map((m,i)=>`<tr><td>${i+1}</td><td><strong>${m.name}</strong></td><td>${m.dosage||'—'}</td><td>${m.instructions||'—'}</td></tr>`).join('')}
    </tbody></table></div>` : ''}
    ${rx.advice ? `<div class="section"><div class="section-title">Advice</div><div class="section-body">${rx.advice}</div></div>` : ''}
    ${rx.notes ? `<div class="section"><div class="section-title">Notes</div><div class="section-body" style="color:#64748b;">${rx.notes}</div></div>` : ''}
    <div class="footer">
      <div>
        ${net > 0 ? `<span class="payment-badge">Fee: PKR ${net.toLocaleString()}</span>` : ''}
        <div style="font-size:10px;color:#94a3b8;margin-top:6px;">Printed: ${new Date().toLocaleString('en-PK')}</div>
      </div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Doctor's Signature</div></div>
    </div>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`
    doc.document.write(html)
    doc.document.close()
  }

  const addMed = () => setMedicines(m => [...m, { name: '', dosage: '', instructions: '' }])
  const removeMed = (i: number) => setMedicines(m => m.filter((_, idx) => idx !== i))
  const updateMed = (i: number, k: keyof Medicine, v: string) =>
    setMedicines(m => m.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }

  const filtered = patients.filter(p => filter === 'all' || p.status === filter)
  const waiting = patients.filter(p => p.status === 'waiting').length
  const inProgress = patients.filter(p => p.status === 'in_progress').length

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
          {shift.status === 'idle' ? (
            <button onClick={startShift} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-full font-bold transition shadow">
              ▶ Start Shift
            </button>
          ) : shift.status === 'active' ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />{fmtElapsed(elapsed)}
              </span>
              <button onClick={takeBreak} className="text-xs bg-amber-500 hover:bg-amber-400 text-white px-2.5 py-1.5 rounded-full font-bold transition">⏸ Break</button>
              <button onClick={endShift} className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2.5 py-1.5 rounded-full font-bold transition">■ End</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400 font-bold">On Break</span>
              <button onClick={resumeShift} className="text-xs bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-full font-bold transition">▶ Resume</button>
              <button onClick={endShift} className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2.5 py-1.5 rounded-full font-bold transition">■ End</button>
            </div>
          )}
          <span className="text-xs bg-indigo-800/60 border border-indigo-700/40 px-3 py-1.5 rounded-full font-medium">{user?.name}</span>
          <button onClick={logout} className="text-xs text-indigo-300 hover:text-white transition font-medium">Sign Out</button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 max-w-[1800px] mx-auto w-full">

        {/* LEFT: Patient detail / empty state */}
        <div className="lg:col-span-3 border-r border-slate-200 min-h-[calc(100vh-65px)]">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col"
              >
                {/* Detail header */}
                <div className={`px-6 py-5 border-b flex items-start justify-between
                  ${selected.is_emergency ? 'bg-gradient-to-br from-red-50 to-red-100/40 border-red-200' : 'bg-gradient-to-br from-indigo-50 to-white border-slate-200'}`}>
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className={`text-4xl font-black tabular-nums ${selected.is_emergency ? 'text-red-600' : 'text-indigo-600'}`}>
                        #{String(selected.queue_number).padStart(3, '0')}
                      </span>
                      <Badge status={selected.status} emergency={selected.is_emergency} />
                    </div>
                    <p className="font-bold text-slate-800 text-xl">{selected.name}
                      <span className="text-slate-400 font-normal text-base ml-2">· {selected.age} yrs · {selected.gender || 'male'}</span>
                    </p>
                    {selected.doctor_name && <p className="text-sm text-slate-500 mt-0.5">Being seen by {selected.doctor_name}</p>}
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="text-slate-400 hover:text-slate-700 transition p-2 rounded-xl hover:bg-slate-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Patient info */}
                  <div className="card p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Patient Information</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {[
                        ['Guardian', selected.guardian_name || '—'],
                        ['CNIC / B-Form', selected.cnic_bform || '—'],
                        ['Phone', selected.phone],
                        ['Check-in', new Date(selected.check_in_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })],
                        ['Status', selected.status.replace('_', ' ')],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-xs text-slate-400 font-semibold mb-0.5">{k}</p>
                          <p className="font-bold text-slate-700 capitalize">{v}</p>
                        </div>
                      ))}
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-xs text-slate-400 font-semibold mb-0.5">Address</p>
                        <p className="font-bold text-slate-700">{selected.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="card p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Queue Actions</p>
                    <div className="flex gap-3">
                      {selected.status === 'waiting' && (
                        <button onClick={() => updateStatus('in_progress')} disabled={actionLoading}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition shadow-md shadow-amber-100 disabled:opacity-60 text-base">
                          📢 Call Patient
                        </button>
                      )}
                      {selected.status === 'in_progress' && (
                        <button onClick={() => updateStatus('done')} disabled={actionLoading}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-md shadow-emerald-100 disabled:opacity-60 text-base">
                          ✓ Mark as Done
                        </button>
                      )}
                      {selected.status !== 'waiting' && (
                        <button onClick={() => updateStatus('waiting')} disabled={actionLoading}
                          className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition disabled:opacity-60">
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Payment info */}
                  {(selected.bill_amount > 0 || selected.payment_method) && (
                    <div className="card p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Payment</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        {([
                          ['Method', selected.payment_method?.toUpperCase() || '—'],
                          ['Bill', `PKR ${Number(selected.bill_amount || 0).toLocaleString()}`],
                          ['Discount', `PKR ${Number(selected.discount || 0).toLocaleString()}`],
                          ['Net Bill', `PKR ${Math.max(0, (selected.bill_amount || 0) - (selected.discount || 0)).toLocaleString()}`],
                          ...(selected.payment_method === 'cash' ? [
                            ['Received', `PKR ${Number(selected.amount_paid || 0).toLocaleString()}`],
                            ['Change', `PKR ${Number(selected.change_due || 0).toLocaleString()}`],
                          ] : []),
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-xs text-slate-400 font-semibold mb-0.5">{k}</p>
                            <p className="font-bold text-slate-700">{v}</p>
                          </div>
                        ))}
                        <div>
                          <p className="text-xs text-slate-400 font-semibold mb-0.5">Status</p>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-block
                            ${selected.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : selected.payment_status === 'partial' ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {selected.payment_status === 'paid' ? '✓ Paid' : selected.payment_status === 'partial' ? 'Partial' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {selected.documents.length > 0 && (
                    <div className="card p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Documents ({selected.documents.length})</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selected.documents.map(d => (
                          <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2.5 text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-3 rounded-xl transition hover:bg-indigo-100 border border-indigo-100">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="font-medium truncate">{d.file_name}</span>
                            <span className="ml-auto text-xs text-indigo-400 shrink-0">View ↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vitals (from entry) */}
                  {(selected.bp || selected.temperature || selected.pulse || selected.weight) && (
                    <div className="card p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vitals (at entry)</p>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        {[['BP', selected.bp, 'mmHg'], ['Temp', selected.temperature, '°F'], ['Pulse', selected.pulse, 'bpm'], ['Weight', selected.weight, 'kg']].map(([l,v,u]) => v ? (
                          <div key={l} className="bg-indigo-50 rounded-xl py-3 px-2 border border-indigo-100">
                            <p className="text-xs text-indigo-400 font-bold mb-1">{l}</p>
                            <p className="font-black text-indigo-700 text-base">{v}</p>
                            <p className="text-xs text-slate-400">{u}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {/* Past prescriptions */}
                  {selected.prescriptions.length > 0 && (
                    <div className="card p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Previous Prescriptions ({selected.prescriptions.length})</p>
                      <div className="space-y-3">
                        {selected.prescriptions.map(rx => (
                          <div key={rx.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-slate-400 font-semibold">
                                Dr. {rx.doctor_name} · {new Date(rx.created_at).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
                              </p>
                              <button onClick={() => printPrescription(rx)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition border border-indigo-200">
                                🖨 Print PDF
                              </button>
                            </div>
                            {rx.complaint && <p className="text-xs text-slate-600 mb-1"><span className="font-bold text-slate-700">Complaint:</span> {rx.complaint}</p>}
                            {rx.diagnosis && <p className="text-xs font-bold text-indigo-700 mb-1">Dx: {rx.diagnosis}</p>}
                            {rx.lab_tests && rx.lab_tests.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {rx.lab_tests.map(t => <span key={t} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{t}</span>)}
                              </div>
                            )}
                            {rx.medicines && rx.medicines.length > 0 && (
                              <ul className="space-y-1">
                                {rx.medicines.map((m, i) => (
                                  <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                    <span className="text-indigo-400 font-bold">•</span>
                                    <span><span className="font-bold">{m.name}</span>
                                      {m.dosage && <span className="text-slate-500"> · {m.dosage}</span>}
                                      {m.instructions && <span className="text-slate-400 italic"> — {m.instructions}</span>}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {rx.advice && <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-200 pt-2">Advice: {rx.advice}</p>}
                            {rx.image_url && <a href={rx.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 font-medium hover:underline mt-1 inline-block">View Image ↗</a>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New prescription form */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Prescription</p>
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(['manual', 'photo'] as const).map(t => (
                          <button key={t} onClick={() => setRxTab(t)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${rxTab === t ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>
                            {t === 'manual' ? '✏ Manual' : '📷 Photo'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {rxTab === 'manual' ? (
                      <div className="space-y-4">
                        {/* Row 1: Complaint (required) + History */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">
                              Chief Complaint <span className="text-red-500">*</span>
                            </label>
                            <textarea value={rxComplaint} onChange={e => setRxComplaint(e.target.value)}
                              placeholder="Main symptom or reason for visit…" rows={3}
                              className={`field-input resize-none text-sm ${!rxComplaint.trim() ? 'border-red-200 focus:ring-red-400' : ''}`} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">History</label>
                            <textarea value={rxHistory} onChange={e => setRxHistory(e.target.value)}
                              placeholder="Relevant medical / family history…" rows={3}
                              className="field-input resize-none text-sm" />
                          </div>
                        </div>

                        {/* Row 2: Examination + Diagnosis (required) */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Examination</label>
                            <textarea value={rxExamination} onChange={e => setRxExamination(e.target.value)}
                              placeholder="Physical examination findings…" rows={3}
                              className="field-input resize-none text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">
                              Diagnosis <span className="text-red-500">*</span>
                            </label>
                            <textarea value={rxDiagnosis} onChange={e => setRxDiagnosis(e.target.value)}
                              placeholder="Clinical diagnosis…" rows={3}
                              className={`field-input resize-none text-sm font-semibold ${!rxDiagnosis.trim() ? 'border-red-200 focus:ring-red-400' : 'border-indigo-300'}`} />
                          </div>
                        </div>

                        {/* Lab tests */}
                        <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3">
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            Investigations / Lab Tests
                            {rxLabTests.length > 0 && <span className="ml-2 text-violet-600 normal-case font-semibold">({rxLabTests.length} selected)</span>}
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {LAB_TESTS.map(t => (
                              <label key={t} onClick={() => setRxLabTests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                                className={`flex items-center gap-2 cursor-pointer px-2.5 py-2 rounded-lg border transition text-xs font-semibold select-none
                                  ${rxLabTests.includes(t) ? 'border-violet-400 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50'}`}>
                                <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition
                                  ${rxLabTests.includes(t) ? 'bg-violet-500 border-violet-500 text-white' : 'border-slate-300'}`}>
                                  {rxLabTests.includes(t) && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                                </span>
                                {t}
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Medicines table */}
                        <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Rx — Medicines</label>
                            <button onClick={addMed} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg transition">+ Add</button>
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
                              <span className="col-span-5">Medicine</span>
                              <span className="col-span-3">Dosage</span>
                              <span className="col-span-3">Instructions</span>
                            </div>
                            {medicines.map((m, i) => (
                              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                <input value={m.name} onChange={e => updateMed(i, 'name', e.target.value)}
                                  placeholder={`Medicine ${i + 1}`} className="col-span-5 field-input text-sm py-2" />
                                <input value={m.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)}
                                  placeholder="e.g. 500mg" className="col-span-3 field-input text-sm py-2" />
                                <input value={m.instructions} onChange={e => updateMed(i, 'instructions', e.target.value)}
                                  placeholder="1×0×1 / Morning…" className="col-span-3 field-input text-sm py-2" />
                                <button onClick={() => removeMed(i)}
                                  className="col-span-1 text-slate-300 hover:text-red-500 transition text-xl text-center leading-none">×</button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Advice */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Advice</label>
                          <textarea value={rxAdvice} onChange={e => setRxAdvice(e.target.value)}
                            placeholder="Rest, diet, follow-up date, next visit…" rows={2}
                            className="field-input resize-none text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Internal Notes <span className="font-normal text-slate-400">(not printed)</span></label>
                          <textarea value={rxNotes} onChange={e => setRxNotes(e.target.value)}
                            placeholder="Notes only visible to clinic staff…" rows={1}
                            className="field-input resize-none text-sm" />
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition bg-white">
                        {rxImage ? <p className="text-sm text-slate-600 font-medium">{rxImage.name}</p> : (
                          <><svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-sm text-slate-500 font-medium">Upload prescription photo</span></>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={e => setRxImage(e.target.files?.[0] || null)} />
                      </label>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => savePrescription(false)} disabled={rxSaving}
                        className="flex-1 py-3 rounded-xl font-bold text-sm border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 transition disabled:opacity-50">
                        {rxSaving ? 'Saving…' : '💾 Save'}
                      </button>
                      {rxTab === 'manual' && (
                        <button onClick={() => savePrescription(true)} disabled={rxSaving}
                          className="flex-1 btn-primary py-3 text-sm">
                          {rxSaving ? '…' : '🖨 Save & Print'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mb-5 mx-auto">
                  <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">No patient selected</h3>
                <p className="text-slate-400 text-sm max-w-xs">Click any patient from the queue on the right to view their details and manage their visit.</p>
                {shift.status === 'idle' && (
                  <button onClick={startShift}
                    className="mt-6 btn-primary px-6 py-3 text-sm">
                    ▶ Start Your Shift
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: Live queue */}
        <div className="lg:col-span-2 bg-white/60 border-l border-slate-200">
          <div className="sticky top-[65px] h-[calc(100vh-65px)] flex flex-col">
            {/* Queue header */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-800">Queue</h2>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  {queueDate === new Date().toISOString().slice(0, 10) ? 'Live' : queueDate}
                </span>
              </div>
              {/* Date picker */}
              <div className="flex gap-2 items-center mb-3">
                <input type="date" value={queueDate} max={new Date().toISOString().slice(0, 10)}
                  onChange={e => { setQueueDate(e.target.value); loadQueue(e.target.value); setSelected(null) }}
                  className="field-input flex-1 text-xs py-1.5" />
                {queueDate !== new Date().toISOString().slice(0, 10) && (
                  <button onClick={() => { const t = new Date().toISOString().slice(0, 10); setQueueDate(t); loadQueue(t) }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold whitespace-nowrap transition">Today</button>
                )}
              </div>
              <div className="flex gap-2 mb-3">
                {[
                  { label: 'Waiting', count: waiting, color: 'bg-sky-100 text-sky-700' },
                  { label: 'Active', count: inProgress, color: 'bg-amber-100 text-amber-700' },
                  { label: 'Done', count: patients.filter(p => p.status === 'done').length, color: 'bg-emerald-100 text-emerald-700' },
                ].map(s => (
                  <div key={s.label} className={`flex-1 text-center py-1.5 rounded-lg ${s.color}`}>
                    <p className="text-lg font-black">{s.count}</p>
                    <p className="text-xs font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Filter */}
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['all', 'waiting', 'in_progress', 'done'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition ${filter === f ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                    {f === 'all' ? 'All' : f === 'in_progress' ? 'Active' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No patients</div>
              ) : (
                <>
                  {/* Emergencies first */}
                  {filtered.filter(p => p.is_emergency).map((p, i) => (
                    <QueueCard key={p.id} p={p} index={i} active={selected?.id === p.id} onClick={() => openPatient(p)} />
                  ))}
                  {filtered.filter(p => !p.is_emergency).map((p, i) => (
                    <QueueCard key={p.id} p={p} index={i} active={selected?.id === p.id} onClick={() => openPatient(p)} />
                  ))}
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

function QueueCard({ p, onClick, index, active }: { p: Patient; onClick: () => void; index: number; active: boolean }) {
  const s = S[p.status] || S.waiting
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }} layout
      onClick={onClick}
      className={`rounded-xl border-2 px-4 py-3 cursor-pointer transition-all
        ${active
          ? 'border-indigo-400 bg-indigo-50 shadow-md'
          : p.is_emergency
            ? 'border-red-300 bg-red-50 hover:border-red-400 hover:shadow-sm'
            : `border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm ${p.status === 'done' ? 'opacity-50' : ''}`
        }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-xl font-black tabular-nums w-12 shrink-0 ${p.is_emergency ? 'text-red-600' : active ? 'text-indigo-600' : 'text-slate-600'}`}>
          #{String(p.queue_number).padStart(3, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{p.age} yrs · {minsAgo(p.check_in_at)}</p>
        </div>
        <div className="shrink-0">
          {p.is_emergency
            ? <span className="text-xs font-bold text-red-600">EMRG</span>
            : <span className={`flex items-center gap-1 text-xs font-bold ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {p.status === 'in_progress' ? 'Active' : p.status}
              </span>
          }
        </div>
      </div>
    </motion.div>
  )
}
