'use client'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface Props {
  data: {
    patientsPerDay: { date: string; count: number }[]
    perDoctor: { doctor_name: string; count: number }[]
    statusBreakdown: { status: string; count: number }[]
  }
}

const PIE_COLORS: Record<string, string> = {
  waiting: '#0ea5e9', in_progress: '#f59e0b', done: '#10b981'
}
const FALLBACK_COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6']

export default function Charts({ data }: Props) {
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Line chart — patients per day */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-4">Patients Per Day (Last 14 Days)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.patientsPerDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(l) => fmtDate(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} name="Patients" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart — status breakdown today */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-4">Status Today</p>
        {data.statusBreakdown.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {data.statusBreakdown.map((entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[entry.status] || FALLBACK_COLORS[i % 4]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart — per doctor */}
      <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-4">Patients per Doctor (Last 7 Days)</p>
        {data.perDoctor.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No doctor activity yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.perDoctor}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="doctor_name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Patients" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
