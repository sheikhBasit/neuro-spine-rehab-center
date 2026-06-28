import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function Root() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (s.role === 'admin') redirect('/admin')
  if (s.role === 'doctor') redirect('/doctor')
  redirect('/entry')
}
