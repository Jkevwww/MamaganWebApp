const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');

async function getAllFacilities() {
  const [rows] = await pool.query(
    'SELECT id, name, description, capacity, price_per_hour, image_url, is_available FROM facilities ORDER BY name'
  );
  return rows;
}

async function getFacilityById(id) {
  const [rows] = await pool.query('SELECT * FROM facilities WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('Facility not found', 404);
  }
  return rows[0];
}

async function bookFacility({ facilityId, userId, date, start_time, end_time, notes }) {
  const [facility] = await pool.query(
    'SELECT id, is_available FROM facilities WHERE id = ?',
    [facilityId]
  );
  if (facility.length === 0) {
    throw new AppError('Facility not found', 404);
  }
  if (!facility[0].is_available) {
    throw new AppError('Facility is not available for booking', 400);
  }

  // Check for conflicting bookings
  const [conflicts] = await pool.query(
    `SELECT id FROM bookings
     WHERE facility_id = ? AND date = ? AND status != 'cancelled'
       AND NOT (end_time <= ? OR start_time >= ?)`,
    [facilityId, date, start_time, end_time]
  );
  if (conflicts.length > 0) {
    throw new AppError('Facility is already booked for the selected time slot', 409);
  }

  const [result] = await pool.query(
    `INSERT INTO bookings (facility_id, user_id, date, start_time, end_time, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [facilityId, userId, date, start_time, end_time, notes || null]
  );

  return { bookingId: result.insertId, status: 'pending' };
}

async function getUserBookings(userId) {
  const [rows] = await pool.query(
    `SELECT b.id, f.name AS facility, b.date, b.start_time, b.end_time, b.status, b.created_at
     FROM bookings b
     JOIN facilities f ON f.id = b.facility_id
     WHERE b.user_id = ?
     ORDER BY b.date DESC`,
    [userId]
  );
  return rows;
}

module.exports = { getAllFacilities, getFacilityById, bookFacility, getUserBookings };
