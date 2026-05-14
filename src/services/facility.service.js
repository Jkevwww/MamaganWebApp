const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');

/**
 * Get all facilities with optional filters
 */
async function getAllFacilities(filters = {}) {
  let query = 'SELECT * FROM facilities WHERE 1=1';
  const params = [];

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.is_bookable !== undefined) {
    query += ' AND is_bookable = ?';
    params.push(filters.is_bookable ? 1 : 0);
  }

  if (filters.min_price) {
    query += ' AND price_min >= ?';
    params.push(filters.min_price);
  }

  if (filters.max_price) {
    query += ' AND price_max <= ?';
    params.push(filters.max_price);
  }

  if (filters.capacity) {
    query += ' AND capacity_max >= ?';
    params.push(filters.capacity);
  }

  query += ' ORDER BY category, name';

  const [rows] = await pool.query(query, params);
  return rows;
}

async function getFacilityById(id) {
  const [rows] = await pool.query('SELECT * FROM facilities WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('Facility not found', 404);
  }
  return rows[0];
}

/**
 * Check availability for a specific facility, date, and time
 */
async function checkAvailability(facilityId, date, startTime, endTime, quantity = 1) {
  const facility = await getFacilityById(facilityId);

  if (!facility.is_bookable) {
    return { 
      available: false, 
      reason: facility.unavailable_reason || 'Facility is not available for booking' 
    };
  }

  // 1. Check Blackout Periods
  const [blackouts] = await pool.query(
    `SELECT * FROM blackout_periods 
     WHERE (facility_id IS NULL OR facility_id = ?) 
     AND (? BETWEEN start_date AND end_date)`,
    [facilityId, date]
  );

  if (blackouts.length > 0) {
    return { 
      available: false, 
      reason: `Blackout period: ${blackouts[0].reason || 'Resource is closed for maintenance'}` 
    };
  }

  // 2. Check Beach Equipment Peak Hours (Task: "Cannot be rented during peak hours")
  // Let's define peak hours as 11:00 AM to 2:00 PM for equipment
  if (facility.category === 'Equipment') {
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    const isPeak = (h) => (h >= 11 && h < 14);
    if (isPeak(startHour) || isPeak(endHour - 1)) {
       return {
         available: false,
         reason: 'Beach equipment cannot be rented during peak hours (11AM - 2PM)'
       };
    }
  }

  // 3. Check existing bookings for inventory count
  // We check for overlapping bookings that are NOT cancelled
  const [bookings] = await pool.query(
    `SELECT SUM(quantity) as total_booked FROM bookings
     WHERE facility_id = ? AND date = ? AND status NOT IN ('cancelled', 'failed', 'refunded')
     AND NOT (end_time <= ? OR start_time >= ?)`,
    [facilityId, date, startTime, endTime]
  );

  const totalBooked = parseInt(bookings[0].total_booked || 0);
  const remaining = facility.units - totalBooked;

  if (remaining < quantity) {
    return {
      available: false,
      reason: `Fully booked. Only ${remaining} unit(s) remaining for this slot.`,
      remaining
    };
  }

  return { available: true, remaining };
}

/**
 * Calculate total amount based on resort rules
 */
function calculateTotal(facility, { quantity, guest_count, startTime, endTime, bookingType }) {
  let total = 0;
  quantity = parseInt(quantity) || 1;
  guest_count = parseInt(guest_count) || 1;

  if (facility.category === 'Cottage') {
    // price_min used for fixed, otherwise average or min
    total = facility.price_min * quantity;
  } 
  else if (facility.category === 'Room') {
    total = facility.price_min * quantity;
    // Surcharge for NIGHT booking (Task: Add ₱200 or ₱500 depending on number of persons)
    if (bookingType === 'NIGHT') {
      const surcharge = guest_count > 6 ? 500 : 200;
      total += (surcharge * quantity);
    }
  } 
  else if (facility.category === 'Equipment') {
    if (bookingType === 'HOURLY') {
      const start = new Date(`1970-01-01T${startTime}`);
      const end = new Date(`1970-01-01T${endTime}`);
      const hours = Math.ceil((end - start) / (1000 * 60 * 60));
      total = facility.price_min * hours * quantity;
    } else {
      // DAILY
      total = facility.price_max * quantity; // Assuming price_max is the daily rate for equipment
    }
  }

  return total;
}

/**
 * Create a new booking
 */
async function bookFacility({ facilityId, userId, date, start_time, end_time, quantity, guest_count, notes, bookingType }) {
  const facility = await getFacilityById(facilityId);
  
  // Validation guest count
  if (guest_count > (facility.capacity_max * quantity)) {
    throw new AppError(`Guest count exceeds maximum capacity (${facility.capacity_max * quantity} pax)`, 400);
  }

  const availability = await checkAvailability(facilityId, date, start_time, end_time, quantity);
  if (!availability.available) {
    throw new AppError(availability.reason, 400);
  }

  const total_amount = calculateTotal(facility, { quantity, guest_count, startTime: start_time, endTime: end_time, bookingType });

  const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [result] = await conn.query(
      `INSERT INTO bookings (
        facility_id, user_id, date, start_time, end_time, 
        quantity, guest_count, total_amount, booking_type, 
        notes, status, payment_status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
      [
        facilityId, userId, date, start_time, end_time, 
        quantity, guest_count, total_amount, bookingType || 'DAY', 
        notes || null, expires_at
      ]
    );

    await conn.commit();
    return { 
      bookingId: result.insertId, 
      status: 'pending', 
      total_amount,
      expires_at 
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getUserBookings(userId) {
  const [rows] = await pool.query(
    `SELECT b.*, f.name AS facility_name, f.category, f.image_url
     FROM bookings b
     JOIN facilities f ON f.id = b.facility_id
     WHERE b.user_id = ?
     ORDER BY b.date DESC, b.created_at DESC`,
    [userId]
  );
  return rows;
}

async function getBookingById(bookingId, userId) {
  const [rows] = await pool.query(
    `SELECT b.*, f.name AS facility_name, f.description AS facility_desc, f.image_url, f.category
     FROM bookings b
     JOIN facilities f ON f.id = b.facility_id
     WHERE b.id = ? AND b.user_id = ?`,
    [bookingId, userId]
  );
  if (rows.length === 0) {
    throw new AppError('Booking not found', 404);
  }
  return rows[0];
}

async function cancelBooking(bookingId, userId) {
  const [result] = await pool.query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status != 'cancelled'",
    [bookingId, userId]
  );
  if (result.affectedRows === 0) {
    throw new AppError('Booking not found or already cancelled', 404);
  }
  return { message: 'Booking cancelled successfully' };
}

module.exports = { 
  getAllFacilities, 
  getFacilityById, 
  checkAvailability, 
  bookFacility, 
  getUserBookings,
  getBookingById,
  cancelBooking
};
