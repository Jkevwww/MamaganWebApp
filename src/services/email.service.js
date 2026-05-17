const net = require('net');
const tls = require('tls');
const { AppError } = require('../middleware/error');

function emailFrom() {
  return process.env.EMAIL_FROM || process.env.MAIL_FROM || 'Mamagan Resort <no-reply@mamagan.local>';
}

function parseEmailAddress(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function smtpSecure() {
  if (String(process.env.SMTP_SECURE || '').toLowerCase() === 'true') return true;
  return Number(process.env.SMTP_PORT || 587) === 465;
}

function encodeHeader(value) {
  const text = String(value || '');
  return /^[\x00-\x7F]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function buildMimeMessage({ from, to, subject, text, html }) {
  const boundary = `mamagan-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function createSmtpClient({ host, port, secure }) {
  const socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  socket.setEncoding('utf8');
  socket.setTimeout(Number(process.env.SMTP_TIMEOUT_MS || 20000));

  let buffer = '';
  const pending = [];

  function flush() {
    while (pending.length > 0) {
      const complete = buffer.match(/(?:^|\r?\n)(\d{3}) [^\r\n]*(?:\r?\n|$)/);
      if (!complete) return;
      const endIndex = complete.index + complete[0].length;
      const response = buffer.slice(0, endIndex).trim();
      buffer = buffer.slice(endIndex);
      pending.shift()(response);
    }
  }

  socket.on('data', (chunk) => {
    buffer += chunk;
    flush();
  });

  socket.on('timeout', () => {
    socket.destroy(new Error('SMTP connection timed out'));
  });

  socket.on('error', (err) => {
    while (pending.length > 0) pending.shift()(err);
  });

  function readResponse() {
    return new Promise((resolve, reject) => {
      pending.push((result) => {
        if (result instanceof Error) reject(result);
        else resolve(result);
      });
      flush();
    });
  }

  async function expect(command, validCodes) {
    if (command) socket.write(`${command}\r\n`);
    const response = await readResponse();
    const code = Number(String(response).slice(0, 3));
    if (!validCodes.includes(code)) {
      throw new Error(`SMTP command failed: ${response}`);
    }
    return response;
  }

  return { socket, expect };
}

async function sendWithSmtp({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = smtpSecure();
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  const fromHeader = process.env.SMTP_FROM
    || process.env.EMAIL_FROM
    || process.env.MAIL_FROM
    || `Mamagan Resort <${username}>`;
  const fromAddress = parseEmailAddress(fromHeader);
  const message = buildMimeMessage({ from: fromHeader, to, subject, text, html });
  let client = createSmtpClient({ host, port, secure });

  await client.expect(null, [220]);
  await client.expect(`EHLO ${process.env.SMTP_HELO_NAME || 'mamagan.local'}`, [250]);

  if (!secure && String(process.env.SMTP_STARTTLS || 'true').toLowerCase() !== 'false') {
    await client.expect('STARTTLS', [220]);
    client.socket.removeAllListeners('data');
    client.socket.removeAllListeners('error');
    client.socket.removeAllListeners('timeout');
    const tlsSocket = tls.connect({ socket: client.socket, servername: host });
    await new Promise((resolve, reject) => {
      tlsSocket.once('secureConnect', resolve);
      tlsSocket.once('error', reject);
    });
    client = createSmtpClientFromSocket(tlsSocket);
    await client.expect(`EHLO ${process.env.SMTP_HELO_NAME || 'mamagan.local'}`, [250]);
  }

  await client.expect(
    `AUTH PLAIN ${Buffer.from(`\0${username}\0${password}`, 'utf8').toString('base64')}`,
    [235]
  );
  await client.expect(`MAIL FROM:<${fromAddress}>`, [250]);
  await client.expect(`RCPT TO:<${to}>`, [250, 251]);
  await client.expect('DATA', [354]);
  client.socket.write(`${message.replace(/\r?\n\./g, '\r\n..')}\r\n.\r\n`);
  await client.expect(null, [250]);
  await client.expect('QUIT', [221]);
  client.socket.end();
}

function createSmtpClientFromSocket(socket) {
  socket.setEncoding('utf8');
  socket.setTimeout(Number(process.env.SMTP_TIMEOUT_MS || 20000));

  let buffer = '';
  const pending = [];

  function flush() {
    while (pending.length > 0) {
      const complete = buffer.match(/(?:^|\r?\n)(\d{3}) [^\r\n]*(?:\r?\n|$)/);
      if (!complete) return;
      const endIndex = complete.index + complete[0].length;
      const response = buffer.slice(0, endIndex).trim();
      buffer = buffer.slice(endIndex);
      pending.shift()(response);
    }
  }

  socket.on('data', (chunk) => {
    buffer += chunk;
    flush();
  });
  socket.on('timeout', () => socket.destroy(new Error('SMTP connection timed out')));
  socket.on('error', (err) => {
    while (pending.length > 0) pending.shift()(err);
  });

  function readResponse() {
    return new Promise((resolve, reject) => {
      pending.push((result) => {
        if (result instanceof Error) reject(result);
        else resolve(result);
      });
      flush();
    });
  }

  async function expect(command, validCodes) {
    if (command) socket.write(`${command}\r\n`);
    const response = await readResponse();
    const code = Number(String(response).slice(0, 3));
    if (!validCodes.includes(code)) {
      throw new Error(`SMTP command failed: ${response}`);
    }
    return response;
  }

  return { socket, expect };
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

  if (smtpConfigured()) {
    await sendWithSmtp({ to, subject, text, html });
    return { delivered: true, provider: 'smtp' };
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
