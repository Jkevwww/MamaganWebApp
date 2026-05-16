const { AppError } = require('../middleware/error');

function emailFrom() {
  return process.env.EMAIL_FROM || process.env.MAIL_FROM || 'Mamagan Resort <no-reply@mamagan.local>';
}

function verificationHtml(code) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2>Mamagan Resort email verification</h2>
      <p>Use this code to finish creating your account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
      <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

async function sendWithResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend email failed: ${body || res.status}`);
  }
}

async function sendWithBrevo({ to, subject, text, html }) {
  const sender = emailFrom();
  const match = sender.match(/^(.*)<(.+)>$/);
  const senderName = match ? match[1].trim() : 'Mamagan Resort';
  const senderEmail = match ? match[2].trim() : sender;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName || 'Mamagan Resort', email: senderEmail },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo email failed: ${body || res.status}`);
  }
}

async function sendVerificationCode(to, code) {
  const subject = 'Your Mamagan Resort verification code';
  const text = `Your Mamagan Resort verification code is ${code}. This code expires in 10 minutes.`;
  const html = verificationHtml(code);

  if (process.env.RESEND_API_KEY) {
    await sendWithResend({ to, subject, text, html });
    return { delivered: true, provider: 'resend' };
  }

  if (process.env.BREVO_API_KEY) {
    await sendWithBrevo({ to, subject, text, html });
    return { delivered: true, provider: 'brevo' };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Email service is not configured', 500);
  }

  console.log(`[DEV EMAIL] Verification code for ${to}: ${code}`);
  return { delivered: false, provider: 'console' };
}

module.exports = { sendVerificationCode };
