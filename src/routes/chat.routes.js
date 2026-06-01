const express = require('express');

const { pool } = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { AppError } = require('../middleware/error');

const router = express.Router();

const MESSAGE_LIMIT = 1000;
const THREAD_STATUS = new Set(['OPEN', 'CLOSED']);

function cleanMessage(value) {
  return String(value || '').trim().slice(0, MESSAGE_LIMIT);
}

function cleanStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  return THREAD_STATUS.has(status) ? status : null;
}

async function getOrCreateUserThread(userId) {
  await pool.query(
    `INSERT IGNORE INTO chat_threads (user_id, status, last_message_at)
     VALUES (?, 'OPEN', NOW())`,
    [userId]
  );

  const [rows] = await pool.query(
    `SELECT id, user_id, status, last_message_at, created_at, updated_at
     FROM chat_threads
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows[0]) {
    throw new AppError('Unable to create chat thread.', 500);
  }

  return rows[0];
}

async function getThreadForAdmin(threadId) {
  const [rows] = await pool.query(
    `SELECT
       t.id,
       t.user_id,
       t.status,
       t.last_message_at,
       t.created_at,
       t.updated_at,
       u.name AS user_name,
       u.email AS user_email,
       u.phone AS user_phone,
       u.avatar_url AS user_avatar_url
     FROM chat_threads t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = ?
     LIMIT 1`,
    [threadId]
  );

  if (!rows[0]) {
    throw new AppError('Chat thread not found.', 404);
  }

  return rows[0];
}

async function listMessages(threadId) {
  const [rows] = await pool.query(
    `SELECT
       m.id,
       m.thread_id,
       m.sender_id,
       m.sender_type,
       m.message,
       m.read_by_user_at,
       m.read_by_admin_at,
       m.created_at,
       u.name AS sender_name,
       u.avatar_url AS sender_avatar_url
     FROM chat_messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.thread_id = ?
     ORDER BY m.id ASC`,
    [threadId]
  );
  return rows;
}

async function createMessage({ threadId, senderId, senderType, message }) {
  const [result] = await pool.query(
    `INSERT INTO chat_messages (thread_id, sender_id, sender_type, message)
     VALUES (?, ?, ?, ?)`,
    [threadId, senderId, senderType, message]
  );

  await pool.query(
    `UPDATE chat_threads
     SET status = 'OPEN', last_message_at = NOW()
     WHERE id = ?`,
    [threadId]
  );

  const [rows] = await pool.query(
    `SELECT
       m.id,
       m.thread_id,
       m.sender_id,
       m.sender_type,
       m.message,
       m.read_by_user_at,
       m.read_by_admin_at,
       m.created_at,
       u.name AS sender_name,
       u.avatar_url AS sender_avatar_url
     FROM chat_messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return rows[0];
}

router.get('/thread', requireAuth, async (req, res, next) => {
  try {
    const thread = await getOrCreateUserThread(req.user.id);

    await pool.query(
      `UPDATE chat_messages
       SET read_by_user_at = COALESCE(read_by_user_at, NOW())
       WHERE thread_id = ? AND sender_type = 'ADMIN'`,
      [thread.id]
    );

    const messages = await listMessages(thread.id);
    return res.json({ thread, messages });
  } catch (err) {
    return next(err);
  }
});

router.post('/messages', requireAuth, async (req, res, next) => {
  try {
    const message = cleanMessage(req.body.message);
    if (!message) {
      throw new AppError('Message is required.', 400);
    }

    const thread = await getOrCreateUserThread(req.user.id);
    const saved = await createMessage({
      threadId: thread.id,
      senderId: req.user.id,
      senderType: 'USER',
      message,
    });

    return res.status(201).json({ message: saved });
  } catch (err) {
    return next(err);
  }
});

router.get('/admin/threads', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.user_id,
         t.status,
         t.last_message_at,
         t.created_at,
         t.updated_at,
         u.name AS user_name,
         u.email AS user_email,
         u.phone AS user_phone,
         u.avatar_url AS user_avatar_url,
         latest.message AS last_message,
         latest.sender_type AS last_sender_type,
         latest.created_at AS last_message_created_at,
         COALESCE(unread.unread_count, 0) AS unread_count
       FROM chat_threads t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN chat_messages latest ON latest.id = (
         SELECT id
         FROM chat_messages
         WHERE thread_id = t.id
         ORDER BY id DESC
         LIMIT 1
       )
       LEFT JOIN (
         SELECT thread_id, COUNT(*) AS unread_count
         FROM chat_messages
         WHERE sender_type = 'USER' AND read_by_admin_at IS NULL
         GROUP BY thread_id
       ) unread ON unread.thread_id = t.id
       ORDER BY COALESCE(t.last_message_at, t.created_at) DESC, t.id DESC`
    );

    return res.json({ threads: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/admin/threads/:threadId/messages', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const threadId = parseInt(req.params.threadId, 10);
    if (!Number.isFinite(threadId)) {
      throw new AppError('Invalid chat thread.', 400);
    }

    const thread = await getThreadForAdmin(threadId);
    await pool.query(
      `UPDATE chat_messages
       SET read_by_admin_at = COALESCE(read_by_admin_at, NOW())
       WHERE thread_id = ? AND sender_type = 'USER'`,
      [threadId]
    );

    const messages = await listMessages(threadId);
    return res.json({ thread, messages });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/threads/:threadId/messages', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const threadId = parseInt(req.params.threadId, 10);
    if (!Number.isFinite(threadId)) {
      throw new AppError('Invalid chat thread.', 400);
    }

    const message = cleanMessage(req.body.message);
    if (!message) {
      throw new AppError('Message is required.', 400);
    }

    await getThreadForAdmin(threadId);
    const saved = await createMessage({
      threadId,
      senderId: req.user.id,
      senderType: 'ADMIN',
      message,
    });

    return res.status(201).json({ message: saved });
  } catch (err) {
    return next(err);
  }
});

router.patch('/admin/threads/:threadId/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const threadId = parseInt(req.params.threadId, 10);
    if (!Number.isFinite(threadId)) {
      throw new AppError('Invalid chat thread.', 400);
    }

    const status = cleanStatus(req.body.status);
    if (!status) {
      throw new AppError('Status must be OPEN or CLOSED.', 400);
    }

    await getThreadForAdmin(threadId);
    await pool.query(
      `UPDATE chat_threads
       SET status = ?
       WHERE id = ?`,
      [status, threadId]
    );

    const thread = await getThreadForAdmin(threadId);
    return res.json({ thread });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
