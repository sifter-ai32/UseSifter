import { Resend } from 'resend'

let resend: Resend
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export { getResend }

export async function sendOtpEmail(to: string, otpCode: string) {
  await getResend().emails.send({
    from: 'Sifter <noreply@usesifter.com>',
    to,
    subject: 'Your Sifter verification code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111;">Verify your email</h2>
        <p style="margin: 0 0 24px; font-size: 14px; color: #666;">Enter this code to complete your Sifter signup:</p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111;">${otpCode}</span>
        </div>
        <p style="margin: 0; font-size: 13px; color: #999;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })
}

export async function sendDealConfirmationEmail(
  to: string,
  recipientName: string,
  projectTitle: string,
  agreedRate: number,
  rateType: string,
  otherPartyName: string,
  role: 'client' | 'freelancer'
) {
  const isClient = role === 'client'
  const subject = isClient
    ? `Deal confirmed: ${otherPartyName} accepted your project "${projectTitle}"`
    : `You've been matched: "${projectTitle}" on Sifter`

  const body = isClient
    ? `<p>Great news! <strong>${otherPartyName}</strong> has accepted the terms for <strong>${projectTitle}</strong> at <strong>$${agreedRate}/${rateType}</strong>.</p><p>You can now collaborate in your Sifter Deal Room.</p>`
    : `<p>You've accepted the terms for <strong>${projectTitle}</strong> at <strong>$${agreedRate}/${rateType}</strong>.</p><p>The client, <strong>${otherPartyName}</strong>, will be in touch via your Sifter Deal Room.</p>`

  await getResend().emails.send({
    from: 'Sifter <noreply@usesifter.com>',
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111;">Deal Confirmed</h2>
        ${body}
        <a href="https://usesifter.com/deal-rooms" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #111; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px;">Open Deal Room</a>
      </div>
    `,
  })
}
