'use client'
import { useState, useEffect, useCallback } from 'react'

interface Record {
  id: number
  name: string
  phone: string
  address: string
  date: string
  created_at: string
}

const today = () => new Date().toISOString().split('T')[0]

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export default function Page() {
  const [records, setRecords] = useState<Record[]>([])
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', address: '', date: today() })

  const load = useCallback(async () => {
    const res = await fetch('/api/records')
    if (res.ok) setRecords(await res.json())
    setFetching(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ name: '', phone: '', address: '', date: today() })
      setToast('Record saved.')
      setTimeout(() => setToast(''), 3000)
      await load()
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="border-b border-gray-200 pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Data Entry</h1>
          <p className="mt-1 text-sm text-gray-500">Add records and export them as an Excel spreadsheet.</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity">
            {toast}
          </div>
        )}

        {/* Form card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">New Record</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Full Name" value={form.name} onChange={set('name')} placeholder="e.g. John Smith" required />
            <Field label="Phone Number" value={form.phone} onChange={set('phone')} placeholder="e.g. +1 555 000 0000" required />
            <Field label="Address" value={form.address} onChange={set('address')} placeholder="Street, City, Country" required />
            <Field label="Date" type="date" value={form.date} onChange={set('date')} required />
            <div className="sm:col-span-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm({ name: '', phone: '', address: '', date: today() })}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save Record'}
              </button>
            </div>
          </form>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Records</h2>
              <p className="text-xs text-gray-400 mt-0.5">{records.length} {records.length === 1 ? 'entry' : 'entries'}</p>
            </div>
            <a
              href="/api/export"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </a>
          </div>

          {fetching ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">No records yet. Add one above to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {['#', 'Name', 'Phone', 'Address', 'Date'].map(h => (
                      <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id} className="border-t border-gray-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-gray-400 tabular-nums">{i + 1}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                      <td className="px-6 py-4 text-gray-600 tabular-nums">{r.phone}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{r.address}</td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{fmt(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />
    </div>
  )
}
