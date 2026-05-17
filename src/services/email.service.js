const nodemailer = require('nodemailer');
const { AppError } = require('../middleware/error');

function emailFrom() {
  return process.env.EMAIL_FROM
    || process.env.SMTP_FROM
    || process.env.MAIL_FROM
    || (process.env.SMTP_USER ? `Mamagan Resort <${process.env.SMTP_USER}>` : 'Mamagan Resort <no-reply@mamagan.local>');
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function cleanSmtpPass() {
  return String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
}

function smtpTimeoutMs() {
  const parsed = Number.parseInt(process.env.SMTP_TIMEOUT_MS || '12000', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 12000;
}

function smtpSecure() {
  if (String(process.env.SMTP_SECURE || '').toLowerCase() === 'true') return true;
  return Number(process.env.SMTP_PORT || 587) === 465;
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

function deliveryError(err, provider) {
  const message = String(err?.message || '');
  const response = String(err?.response || '');
  const code = String(err?.code || err?.responseCode || '');
  const detail = `${code} ${message} ${response}`.toLowerCase();

  console.error(`[EMAIL] ${provider} delivery failed:`, {
    code: err?.code,
    responseCode: err?.responseCode,
    command: err?.command,
    message,
    response,
  });

  if (provider === 'SMTP') {
    if (
      code === 'EAUTH'
      || detail.includes('534')
      || detail.includes('535')
      || detail.includes('5.7.8')
      || detail.includes('5.7.9')
      || detail.includes('application-specific password')
      || detail.includes('username and password not accepted')
      || detail.includes('auth')
    ) {
      return new AppError(
        'Email login failed. Check SMTP_USER and SMTP_PASS. For Gmail, SMTP_PASS must be a 16-character Google App Password.',
        502
      );
    }
    if (
      code === 'ECONNECTION'
      || code === 'ETIMEDOUT'
      || detail.includes('timeout')
      || detail.includes('greeting never received')
      || detail.includes('connection')
    ) {
      return new AppError('Email server connection failed. Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE.', 502);
    }
    if (detail.includes('sender') || detail.includes('from') || detail.includes('not owned')) {
      return new AppError('Email sender was rejected. EMAIL_FROM must use the same Gmail address as SMTP_USER.', 502);
    }
    if (detail.includes('recipient') || detail.includes('rcpt') || detail.includes('mailbox')) {
      return new AppError('The client email address was rejected by the email provider. Check that the email address is valid.', 502);
    }
  }

  return new AppError(
    `Verification email could not be sent through ${provider}. Check the email provider settings. SMTP detail: ${code || 'unknown'}.`,
    502
  );
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

async function sendWithSmtp({ to, subject, text, html }) {
  const transporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST || '').trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: smtpSecure(),
    auth: {
      user: String(process.env.SMTP_USER || '').trim(),
      pass: cleanSmtpPass(),
    },
    connectionTimeout: smtpTimeoutMs(),
    greetingTimeout: smtpTimeoutMs(),
    socketTimeout: smtpTimeoutMs(),
  });

  await transporter.sendMail({
    from: emailFrom(),
    to,
    subject,
    text,
    html,
  });
}

async function sendVerificationCode(to, code) {
  const subject = 'Your Mamagan Resort verification code';
  const text = `Your Mamagan Resort verification code is ${code}. This code expires in 10 minutes.`;
  const html = verificationHtml(code);

  if (process.env.RESEND_API_KEY) {
    try {
      await sendWithResend({ to, subject, text, html });
      return { delivered: true, provider: 'resend' };
    } catch (err) {
      throw deliveryError(err, 'Resend');
    }
  }

  if (process.env.BREVO_API_KEY) {
    try {
      await sendWithBrevo({ to, subject, text, html });
      return { delivered: true, provider: 'brevo' };
    } catch (err) {
      throw deliveryError(err, 'Brevo');
    }
  }

  if (smtpConfigured()) {
    try {
      await sendWithSmtp({ to, subject, text, html });
      return { delivered: true, provider: 'smtp' };
    } catch (err) {
      throw deliveryError(err, 'SMTP');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new AppError(
      'Email service is not configured. Set RESEND_API_KEY, BREVO_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS.',
      500
    );
  }

  console.log(`[DEV EMAIL] Verification code for ${to}: ${code}`);
  return { delivered: false, provider: 'console' };
}

module.exports = { sendVerificationCode };
