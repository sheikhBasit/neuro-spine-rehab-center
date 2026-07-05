import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'doctor', 'data_entry'])
    const sp             = new URL(req.url).searchParams
    const date           = sp.get('date')
    const search         = sp.get('search')?.trim() || ''
    const from           = sp.get('from')
    const to             = sp.get('to')
    const payment_status = sp.get('payment_status')
    const gender         = sp.get('gender')
    const is_emergency   = sp.get('is_emergency')  // 'true' | 'false' | null

    // search mode: across all dates with filters
    if (search || from || to || payment_status || gender || is_emergency !== null) {
      const like   = `%${search}%`
      const fromD  = from || '2000-01-01'
      const toD    = to   || '2100-12-31'
      const patients = await sql`
        SELECT p.id, p.name, p.age, p.age_unit, p.gender, p.guardian_name, p.cnic_bform, p.phone, p.address,
               p.queue_number, p.is_emergency, p.status, p.check_in_at, p.seen_at,
               p.bp, p.temperature, p.pulse, p.weight,
               p.payment_method, p.bill_amount, p.discount, p.amount_paid, p.change_due, p.payment_status,
               u.name AS doctor_name
        FROM patients p LEFT JOIN users u ON p.seen_by_doctor_id = u.id
        WHERE p.check_in_at::date BETWEEN ${fromD}::date AND ${toD}::date
          AND (${search} = '' OR p.name ILIKE ${like} OR p.phone ILIKE ${like} OR p.cnic_bform ILIKE ${like})
          AND (${payment_status || ''} = '' OR p.payment_status = ${payment_status || ''})
          AND (${gender || ''} = '' OR p.gender = ${gender || ''})
          AND (${is_emergency || ''} = '' OR p.is_emergency = ${is_emergency === 'true'})
        ORDER BY p.check_in_at DESC
        LIMIT 200
      `
      return NextResponse.json(patients)
    }

    // default: single date queue (existing behaviour)
    const patients = await sql`
      SELECT
        p.id, p.name, p.age, p.age_unit, p.gender, p.guardian_name, p.cnic_bform, p.phone, p.address,
        p.queue_number, p.is_emergency, p.status, p.check_in_at, p.seen_at,
        p.bp, p.temperature, p.pulse, p.weight,
        p.payment_method, p.bill_amount, p.discount, p.amount_paid, p.change_due, p.payment_status,
        u.name AS doctor_name
      FROM patients p
      LEFT JOIN users u ON p.seen_by_doctor_id = u.id
      WHERE p.check_in_at::date = ${date || new Date().toISOString().slice(0, 10)}::date
      ORDER BY p.is_emergency DESC, p.check_in_at ASC
    `
    return NextResponse.json(patients)
  } catch (e) {
    console.error(e)
    return authErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(['data_entry', 'admin'])
    const {
      name, age, age_unit, gender, guardian_name, cnic_bform, phone, address, is_emergency,
      payment_method, bill_amount, discount, amount_paid, payment_status,
      check_in_at, bp, temperature, pulse, weight,
    } = await req.json()

    if (!name || !age || !phone || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const ageUnit = age_unit === 'months' ? 'months' : 'years'

    const payMethod  = payment_method  || 'cash'
    const bill       = parseFloat(bill_amount)  || 0
    const disc       = parseFloat(discount)     || 0
    const paid       = parseFloat(amount_paid)  || 0
    const netBill    = Math.max(0, bill - disc)
    const change     = payMethod === 'cash' ? Math.max(0, paid - netBill) : 0
    const payStatus  = payment_status || (paid >= netBill && netBill > 0 ? 'paid' : netBill === 0 ? 'pending' : 'partial')

    // Queue number for the target date (default today)
    const targetDate = check_in_at ? check_in_at.split('T')[0] : null
    const [{ count }] = targetDate
      ? await sql`SELECT COUNT(*) AS count FROM patients WHERE check_in_at::date = ${targetDate}::date`
      : await sql`SELECT COUNT(*) AS count FROM patients WHERE check_in_at::date = CURRENT_DATE`
    const queue_number = parseInt(count) + 1

    const genderVal = gender || 'male'
    const vitals = { bp: bp || '', temperature: temperature || '', pulse: pulse || '', weight: weight || '' }
    const [patient] = check_in_at
      ? await sql`
          INSERT INTO patients (name, age, age_unit, gender, guardian_name, cnic_bform, phone, address, queue_number, is_emergency,
                                payment_method, bill_amount, discount, amount_paid, change_due, payment_status, check_in_at,
                                bp, temperature, pulse, weight)
          VALUES (${name}, ${parseInt(age)}, ${ageUnit}, ${genderVal}, ${guardian_name || ''}, ${cnic_bform || ''},
                  ${phone}, ${address}, ${queue_number}, ${!!is_emergency},
                  ${payMethod}, ${bill}, ${disc}, ${paid}, ${change}, ${payStatus}, ${check_in_at},
                  ${vitals.bp}, ${vitals.temperature}, ${vitals.pulse}, ${vitals.weight})
          RETURNING *`
      : await sql`
          INSERT INTO patients (name, age, age_unit, gender, guardian_name, cnic_bform, phone, address, queue_number, is_emergency,
                                payment_method, bill_amount, discount, amount_paid, change_due, payment_status,
                                bp, temperature, pulse, weight)
          VALUES (${name}, ${parseInt(age)}, ${ageUnit}, ${genderVal}, ${guardian_name || ''}, ${cnic_bform || ''},
                  ${phone}, ${address}, ${queue_number}, ${!!is_emergency},
                  ${payMethod}, ${bill}, ${disc}, ${paid}, ${change}, ${payStatus},
                  ${vitals.bp}, ${vitals.temperature}, ${vitals.pulse}, ${vitals.weight})
          RETURNING *`

    return NextResponse.json(patient, { status: 201 })
  } catch (e) {
    console.error(e)
    return authErrorResponse(e)
  }
}
