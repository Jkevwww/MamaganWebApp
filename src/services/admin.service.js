const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');

async function getAllUsers() {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  );
  return rows;
}

async function getAllBookings() {
  const [rows] = await pool.query(
    `SELECT b.id, u.name AS user_name, u.email AS user_email,
            f.name AS facility, b.date, b.start_time, b.end_time, b.status, b.created_at
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN facilities f ON f.id = b.facility_id
     ORDER BY b.date DESC`
  );
  return rows;
}

async function updateBookingStatus(bookingId, status) {
  const validStatuses = ['pending', 'approved', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid booking status', 400);
  }

  const [result] = await pool.query(
    'UPDATE bookings SET status = ? WHERE id = ?',
    [status, bookingId]
  );

  if (result.affectedRows === 0) {
    throw new AppError('Booking not found', 404);
  }

  return { bookingId, status };
}

async function getDashboardStats() {
  const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users WHERE role = ?', ['user']);
  const [[{ totalFacilities }]] = await pool.query('SELECT COUNT(*) AS totalFacilities FROM facilities');
  const [[{ totalBookings }]] = await pool.query('SELECT COUNT(*) AS totalBookings FROM bookings');
  const [[{ pendingBookings }]] = await pool.query("SELECT COUNT(*) AS pendingBookings FROM bookings WHERE status = 'pending'");

  return { totalUsers, totalFacilities, totalBookings, pendingBookings };
}

module.exports = { getAllUsers, getAllBookings, updateBookingStatus, getDashboardStats };
