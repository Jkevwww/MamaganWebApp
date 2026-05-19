const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

const SYSTEM_PROMPT = `
You are the Mamagan Fun & Adventure Beach Resort assistant.
Help guests with facility browsing, reservation steps, payment guidance, ticket/QR questions, and account navigation.
Keep answers concise and friendly. If a question needs live booking status, payment confirmation, or account-specific details, tell the guest to use the relevant page in the Mamagan website or contact resort staff.
Do not claim a booking, cancellation, refund, or payment has been completed.
`;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function normalizeMessages(messages, fallbackMessage) {
  if (!Array.isArray(messages)) {
    return fallbackMessage ? [{ role: 'user', content: fallbackMessage }] : [];
  }

  return messages
    .slice(-8)
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').trim().slice(0, 1200),
    }))
    .filter((message) => message.content);
}

router.post('/', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(503).json({
        message: 'AI assistant is not configured. Set OPENAI_API_KEY in the server environment.',
      });
    }

    const fallbackMessage = String(req.body.message || '').trim();
    const messages = normalizeMessages(req.body.messages, fallbackMessage);

    if (!messages.length) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.5',
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
    });

    return res.json({ reply: response.output_text || 'I could not generate a response right now.' });
  } catch (err) {
    if (err.status === 401) {
      return res.status(503).json({
        message: 'AI assistant API key was rejected. Check OPENAI_API_KEY in the server environment.',
      });
    }

    if (err.status === 429) {
      return res.status(429).json({
        message: 'AI assistant is receiving too many requests. Please try again later.',
      });
    }

    if (err.status >= 400) {
      return res.status(502).json({
        message: 'AI assistant could not complete the request right now.',
      });
    }

    return next(err);
  }
});

module.exports = router;
