'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
    if (data.role === 'admin') router.push('/admin')
    else if (data.role === 'doctor') router.push('/doctor')
    else router.push('/entry')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-3xl mb-5 shadow-2xl shadow-indigo-500/30"
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Neuro Spine</h1>
          <h2 className="text-xl font-semibold text-indigo-300 mt-0.5">Rehab Center</h2>
          <p className="text-slate-400 text-sm mt-2">Clinic Management System</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl shadow-indigo-900/30 p-8 border border-white/20">
          <h3 className="text-xl font-bold text-slate-800 mb-1">Welcome back</h3>
          <p className="text-slate-500 text-sm mb-7">Sign in to access your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="field-input"
                placeholder="you@clinic.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="field-input pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition">
                  {showPw ? <EyeOff /> : <Eye />}
                </button>
              </div>
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

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Contact administrator for account access
        </p>
      </motion.div>
    </div>
  )
}

function Eye() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
}
function EyeOff() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
}
