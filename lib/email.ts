import nodemailer from 'nodemailer'

export function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_PORT || '465') === '465',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export async function sendExpiryAlert(items: { name: string; expiry_date: string; quantity: number; unit: string; days_left: number }[]) {
  const transporter = getTransporter()
  if (!transporter) return { ok: false, reason: 'SMTP not configured' }

  const to = process.env.ALERT_EMAIL || process.env.SMTP_USER!
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.quantity} ${i.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${new Date(i.expiry_date).toLocaleDateString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${i.days_left <= 7 ? '#dc2626' : '#d97706'};font-weight:bold;">${i.days_left <= 0 ? 'EXPIRED' : `${i.days_left} days`}</td>
    </tr>`
  ).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;">
      <div style="background:linear-gradient(135deg,#312e81,#1e1b4b);padding:24px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;font-size:20px;">⚠️ Inventory Expiry Alert</h2>
        <p style="color:#a5b4fc;margin:4px 0 0;">Neuro Spine Rehab Center</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="color:#475569;">The following consumable items are expiring soon or have already expired:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#94a3b8;text-transform:uppercase;">Item</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#94a3b8;text-transform:uppercase;">Stock</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#94a3b8;text-transform:uppercase;">Expiry Date</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#94a3b8;text-transform:uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px;">Please restock or dispose of expired items promptly.</p>
      </div>
    </div>`

  await transporter.sendMail({
    from: `"Neuro Spine Rehab Center" <${process.env.SMTP_USER}>`,
    to,
    subject: `⚠️ Inventory Alert — ${items.length} item${items.length > 1 ? 's' : ''} expiring`,
    html,
  })
  return { ok: true }
}
