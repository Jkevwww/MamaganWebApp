const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');
const qrUtils = require('../utils/qr');

const FACILITY_COLUMNS = `
  id, name, category, size, description, image_url, inventory_count,
  capacity_min, capacity_max, price_min, price_max,
  day_rate_min, day_rate_max, night_surcharge_min, night_surcharge_max,
  hourly_rate, daily_rate, rental_type, active, bookable,
  bookable AS is_bookable,
  unavailable_reason, restricted_during_peak_hours, created_at, updated_at
`;

/**
 * Get all facilities with optional filters
 */
async function getAllFacilities(filters = {}) {
  let query = `SELECT ${FACILITY_COLUMNS} FROM facilities WHERE active = 1 AND deleted_at IS NULL`;
  const params = [];

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.is_bookable !== undefined) {
    query += ' AND bookable = ?';
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

  query += ` ORDER BY FIELD(category, 'COTTAGE', 'CABANA', 'BEACH_EQUIPMENT'), FIELD(size, 'SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'), name`;

  const [rows] = await pool.query(query, params);
  return attachReviewSummaries(rows);
}

async function getFacilityById(id) {
  const [rows] = await pool.query(`SELECT ${FACILITY_COLUMNS} FROM facilities WHERE id = ? AND deleted_at IS NULL`, [id]);
  if (rows.length === 0) {
    throw new AppError('Facility not found', 404);
  }
  const [withReviews] = await attachReviewSummaries(rows);
  return withReviews;
}

function normalizeReview(row, media = []) {
  return {
    id: row.id,
    facility_id: row.facility_id,
    user_id: row.user_id,
    booking_id: row.booking_id,
    rating: Number(row.rating || 0),
    comment: row.comment || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_name: row.user_name,
    media,
  };
}

async function attachReviewSummaries(facilities) {
  if (!facilities.length) return facilities;
  const ids = facilities.map((facility) => facility.id);
  const placeholders = ids.map(() => '?').join(',');

  const [summaryRows] = await pool.query(
    `SELECT facility_id, COUNT(*) AS review_count, AVG(rating) AS average_rating
     FROM facility_reviews
     WHERE facility_id IN (${placeholders})
     GROUP BY facility_id`,
    ids
  );
  const summaryByFacility = new Map(summaryRows.map((row) => [Number(row.facility_id), row]));

  const [latestRows] = await pool.query(
    `SELECT fr.id, fr.facility_id, fr.rating, fr.comment, fr.created_at, u.name AS user_name
     FROM facility_reviews fr
     INNER JOIN users u ON u.id = fr.user_id
     WHERE fr.facility_id IN (${placeholders})
     ORDER BY fr.created_at DESC, fr.id DESC
     LIMIT 80`,
    ids
  );
  const latestByFacility = new Map();
  latestRows.forEach((row) => {
    const key = Number(row.facility_id);
    const current = latestByFacility.get(key) || [];
    if (current.length < 2) {
      current.push({
        id: row.id,
        rating: Number(row.rating || 0),
        comment: row.comment || '',
        user_name: row.user_name,
        created_at: row.created_at,
      });
      latestByFacility.set(key, current);
    }
  });

  return facilities.map((facility) => {
    const summary = summaryByFacility.get(Number(facility.id)) || {};
    return {
      ...facility,
      review_count: Number(summary.review_count || 0),
      average_rating: summary.average_rating ? Number(summary.average_rating) : null,
      latest_reviews: latestByFacility.get(Number(facility.id)) || [],
    };
  });
}

/**
 * Check availability for a specific facility, date, and time
 */
async function checkAvailability(facilityId, date, startTime, endTime, quantity = 1) {
  const facility = await getFacilityById(facilityId);

  if (!facility.bookable || !facility.active) {
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

  // 2. Check Beach Equipment Peak Hours
  if (facility.restricted_during_peak_hours) {
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    const isPeak = (h) => (h >= 11 && h < 14);
    if (isPeak(startHour) || isPeak(endHour - 1)) {
       return {
         available: false,
         reason: 'This facility cannot be rented during peak hours (11AM - 2PM)'
       };
    }
  }

  // 3. Check existing bookings for inventory count
  const [bookings] = await pool.query(
    `SELECT SUM(quantity) as total_booked FROM bookings
     WHERE facility_id = ? AND date = ? AND status NOT IN ('cancelled', 'failed', 'refunded')
     AND NOT (end_time <= ? OR start_time >= ?)`,
    [facilityId, date, startTime, endTime]
  );

  const totalBooked = parseInt(bookings[0].total_booked || 0);
  const remaining = facility.inventory_count - totalBooked;

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

  if (facility.category === 'COTTAGE') {
    total = facility.price_min * quantity;
  } 
  else if (facility.category === 'CABANA') {
    total = (facility.day_rate_min || facility.price_min) * quantity;
    if (bookingType === 'NIGHT') {
      const surcharge = guest_count > 6
        ? (facility.night_surcharge_max || 500)
        : (facility.night_surcharge_min || 200);
      total += (surcharge * quantity);
    }
  } 
  else if (facility.category === 'BEACH_EQUIPMENT') {
    if (facility.rental_type === 'HOURLY') {
      const start = new Date(`1970-01-01T${startTime}`);
      const end = new Date(`1970-01-01T${endTime}`);
      const hours = Math.ceil((end - start) / (1000 * 60 * 60));
      total = (facility.hourly_rate || facility.price_min) * hours * quantity;
    } else if (facility.rental_type === 'HOURLY_OR_DAILY') {
      const start = new Date(`1970-01-01T${startTime}`);
      const end = new Date(`1970-01-01T${endTime}`);
      const hours = Math.ceil((end - start) / (1000 * 60 * 60));
      total = hours >= 8
        ? (facility.daily_rate || facility.price_max) * quantity
        : (facility.hourly_rate || facility.price_min) * hours * quantity;
    } else {
      total = (facility.daily_rate || facility.price_max) * quantity; 
    }
  }

  return total;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function getSeasonalRateForBooking(facilityId, date) {
  const [rows] = await pool.query(
    `SELECT id, name, rate_multiplier
     FROM seasonal_rates
     WHERE active = 1
       AND ? BETWEEN start_date AND end_date
       AND (facility_id IS NULL OR facility_id = ?)
     ORDER BY facility_id IS NOT NULL DESC, rate_multiplier DESC, id DESC
     LIMIT 1`,
    [date, facilityId]
  );
  return rows[0] || null;
}

async function getApplicablePromotion({ promoCode, facilityId, date, subtotal }) {
  const code = String(promoCode || '').trim().toUpperCase();
  if (!code) return null;

  const [rows] = await pool.query(
    `SELECT id, code, title, discount_type, discount_value, min_amount, usage_limit, used_count
     FROM promotions
     WHERE active = 1
       AND UPPER(code) = ?
       AND ? BETWEEN start_date AND end_date
       AND (facility_id IS NULL OR facility_id = ?)
     ORDER BY facility_id IS NOT NULL DESC, id DESC
     LIMIT 1`,
    [code, date, facilityId]
  );

  const promo = rows[0];
  if (!promo) {
    throw new AppError('Promo code is invalid or expired', 400);
  }

  if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
    throw new AppError('Promo code usage limit has been reached', 400);
  }

  if (subtotal < Number(promo.min_amount || 0)) {
    throw new AppError(`Promo code requires a minimum booking amount of PHP ${Number(promo.min_amount).toLocaleString()}`, 400);
  }

  const discountValue = Number(promo.discount_value || 0);
  const discountAmount = promo.discount_type === 'FIXED'
    ? Math.min(discountValue, subtotal)
    : Math.min(subtotal * (discountValue / 100), subtotal);

  return {
    id: promo.id,
    code: promo.code,
    title: promo.title,
    discount_type: promo.discount_type,
    discount_value: discountValue,
    discount_amount: roundMoney(discountAmount),
  };
}

async function quoteBooking({ facilityId, date, start_time, end_time, quantity, guest_count, bookingType, promo_code }) {
  const facility = await getFacilityById(facilityId);
  const parsedQuantity = parseInt(quantity, 10) || 1;
  const parsedGuestCount = parseInt(guest_count, 10) || 1;

  if (!date || !start_time || !end_time) {
    throw new AppError('date, start_time, and end_time are required', 400);
  }

  if (facility.capacity_max && parsedGuestCount > (facility.capacity_max * parsedQuantity)) {
    throw new AppError(`Guest count exceeds maximum capacity (${facility.capacity_max * parsedQuantity} pax)`, 400);
  }

  const baseAmount = calculateTotal(facility, {
    quantity: parsedQuantity,
    guest_count: parsedGuestCount,
    startTime: start_time,
    endTime: end_time,
    bookingType
  });

  const seasonalRate = await getSeasonalRateForBooking(facilityId, date);
  const seasonalMultiplier = seasonalRate ? Number(seasonalRate.rate_multiplier || 1) : 1;
  const subtotal = roundMoney(baseAmount * seasonalMultiplier);
  const promo = await getApplicablePromotion({
    promoCode: promo_code,
    facilityId,
    date,
    subtotal,
  });
  const discountAmount = promo ? promo.discount_amount : 0;
  const totalAmount = roundMoney(Math.max(subtotal - discountAmount, 0));

  return {
    base_amount: roundMoney(baseAmount),
    seasonal_rate: seasonalRate,
    seasonal_multiplier: seasonalMultiplier,
    subtotal_amount: subtotal,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    promo,
  };
}

/**
 * Create a new booking
 */
async function bookFacility({ facilityId, userId, date, start_time, end_time, quantity, guest_count, notes, bookingType, promo_code }) {
  const facility = await getFacilityById(facilityId);
  
  if (facility.capacity_max && guest_count > (facility.capacity_max * quantity)) {
    throw new AppError(`Guest count exceeds maximum capacity (${facility.capacity_max * quantity} pax)`, 400);
  }

  const availability = await checkAvailability(facilityId, date, start_time, end_time, quantity);
  if (!availability.available) {
    throw new AppError(availability.reason, 400);
  }

  const quote = await quoteBooking({
    facilityId,
    date,
    start_time,
    end_time,
    quantity,
    guest_count,
    bookingType,
    promo_code
  });
  const total_amount = quote.total_amount;
  const expires_at = new Date(Date.now() + 15 * 60 * 1000); 

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [result] = await conn.query(
      `INSERT INTO bookings (
        facility_id, user_id, date, start_time, end_time, 
        quantity, guest_count, total_amount, booking_type, 
        notes, status, payment_status, expires_at,
        subtotal_amount, discount_amount, promo_code, promo_id, seasonal_rate_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?)`,
      [
        facilityId, userId, date, start_time, end_time, 
        quantity, guest_count, total_amount, bookingType || 'DAY', 
        notes || null, expires_at,
        quote.subtotal_amount,
        quote.discount_amount,
        quote.promo?.code || null,
        quote.promo?.id || null,
        quote.seasonal_rate?.id || null
      ]
    );

    if (quote.promo?.id) {
      await conn.query('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [quote.promo.id]);
    }

    await conn.commit();
    return { bookingId: result.insertId, status: 'pending', total_amount, expires_at, quote };
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

async function deleteBooking(bookingId, userId) {
  const [result] = await pool.query(
    "DELETE FROM bookings WHERE id = ? AND user_id = ? AND payment_status != 'paid'",
    [bookingId, userId]
  );
  if (result.affectedRows === 0) {
    throw new AppError('Booking not found or cannot be deleted', 404);
  }
  return { message: 'Booking deleted successfully' };
}

async function getTicketForBooking(bookingId, userId) {
  const [rows] = await pool.query(
    `SELECT 
       b.id,
       b.date,
       b.start_time,
       b.end_time,
       b.total_amount,
       b.quantity,
       b.guest_count,
       b.payment_status,
       b.status AS booking_status,
       f.name AS facility_name,
       t.qr_token,
       t.reference_number,
       t.status AS ticket_status,
       p.payment_method,
       p.provider_payment_id,
       p.gcash_ref_no
     FROM bookings b
     JOIN facilities f ON f.id = b.facility_id
     LEFT JOIN tickets t ON t.booking_id = b.id
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id
       FROM payments p2
       WHERE p2.booking_id = b.id
       ORDER BY (p2.status = 'paid') DESC, p2.updated_at DESC, p2.id DESC
       LIMIT 1
     )
     WHERE b.id = ? AND b.user_id = ?`,
    [bookingId, userId]
  );

  if (rows.length === 0) {
    throw new AppError('Booking not found', 404);
  }

  const booking = rows[0];
  if (booking.payment_status !== 'paid') {
    throw new AppError('Ticket is available after successful payment', 400);
  }

  let qrToken = booking.qr_token;
  let referenceNumber = booking.reference_number;
  let ticketStatus = booking.ticket_status;

  if (!qrToken) {
    qrToken = qrUtils.generateQrToken(bookingId);
    referenceNumber = qrUtils.generateTicketReference(bookingId);
    ticketStatus = 'valid';
    await pool.query(
      `INSERT INTO tickets (booking_id, qr_token, reference_number, status)
       VALUES (?, ?, ?, 'valid')
       ON DUPLICATE KEY UPDATE status='valid', reference_number=COALESCE(reference_number, VALUES(reference_number))`,
      [bookingId, qrToken, referenceNumber]
    );
  } else if (!referenceNumber) {
    referenceNumber = qrUtils.generateTicketReference(bookingId);
    await pool.query(
      'UPDATE tickets SET reference_number = ? WHERE booking_id = ? AND reference_number IS NULL',
      [referenceNumber, bookingId]
    );
  }

  const paymentReference = booking.gcash_ref_no || booking.provider_payment_id || referenceNumber;
  const qrDataUrl = await qrUtils.generateQrDataUrl(qrToken, paymentReference);

  return {
    id: booking.id,
    facility_name: booking.facility_name,
    date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    total_amount: booking.total_amount,
    quantity: booking.quantity,
    guest_count: booking.guest_count,
    booking_status: booking.booking_status,
    payment_status: booking.payment_status,
    ticket_status: ticketStatus,
    reference_number: referenceNumber,
    payment_reference: paymentReference,
    payment_method: booking.payment_method,
    gcash_ref_no: booking.gcash_ref_no,
    provider_payment_id: booking.provider_payment_id,
    qr_data_url: qrDataUrl
  };
}

async function getFacilityReviews(facilityId) {
  await getFacilityById(facilityId);

  const [reviews] = await pool.query(
    `SELECT fr.*, u.name AS user_name
     FROM facility_reviews fr
     INNER JOIN users u ON u.id = fr.user_id
     WHERE fr.facility_id = ?
     ORDER BY fr.created_at DESC, fr.id DESC
     LIMIT 100`,
    [facilityId]
  );

  if (!reviews.length) {
    return { reviews: [], summary: { review_count: 0, average_rating: null } };
  }

  const reviewIds = reviews.map((review) => review.id);
  const placeholders = reviewIds.map(() => '?').join(',');
  const [mediaRows] = await pool.query(
    `SELECT id, review_id, media_type, media_url, original_name, mime_type, file_size
     FROM facility_review_media
     WHERE review_id IN (${placeholders})
     ORDER BY id ASC`,
    reviewIds
  );
  const mediaByReview = new Map();
  mediaRows.forEach((media) => {
    const items = mediaByReview.get(media.review_id) || [];
    items.push({
      id: media.id,
      type: media.media_type,
      url: media.media_url,
      original_name: media.original_name,
      mime_type: media.mime_type,
      file_size: media.file_size,
    });
    mediaByReview.set(media.review_id, items);
  });

  const [[summary]] = await pool.query(
    'SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating FROM facility_reviews WHERE facility_id = ?',
    [facilityId]
  );

  return {
    reviews: reviews.map((review) => normalizeReview(review, mediaByReview.get(review.id) || [])),
    summary: {
      review_count: Number(summary.review_count || 0),
      average_rating: summary.average_rating ? Number(summary.average_rating) : null,
    },
  };
}

async function findEligibleReviewBooking(facilityId, userId) {
  const [rows] = await pool.query(
    `SELECT id
     FROM bookings
     WHERE facility_id = ?
       AND user_id = ?
       AND status != 'cancelled'
       AND (payment_status = 'paid' OR status = 'approved')
     ORDER BY date DESC, created_at DESC, id DESC
     LIMIT 1`,
    [facilityId, userId]
  );
  return rows[0] || null;
}

async function createFacilityReview({ facilityId, userId, rating, comment, mediaFiles = [] }) {
  await getFacilityById(facilityId);
  const parsedRating = Number.parseInt(rating, 10);
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  const text = String(comment || '').trim();
  if (!text && mediaFiles.length === 0) {
    throw new AppError('Add a comment or at least one photo/video', 400);
  }
  if (text.length > 1500) {
    throw new AppError('Comment must be 1500 characters or fewer', 400);
  }

  const booking = await findEligibleReviewBooking(facilityId, userId);
  if (!booking) {
    throw new AppError('Only users with a paid or approved booking for this facility can leave a review', 403);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO facility_reviews (facility_id, user_id, booking_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         booking_id = VALUES(booking_id),
         rating = VALUES(rating),
         comment = VALUES(comment),
         updated_at = CURRENT_TIMESTAMP`,
      [facilityId, userId, booking.id, parsedRating, text || null]
    );

    let reviewId = result.insertId;
    if (!reviewId) {
      const [existing] = await conn.query(
        'SELECT id FROM facility_reviews WHERE facility_id = ? AND user_id = ? LIMIT 1',
        [facilityId, userId]
      );
      reviewId = existing[0].id;
    }

    if (mediaFiles.length) {
      const values = mediaFiles.map((file) => [
        reviewId,
        file.mimetype.startsWith('video/') ? 'video' : 'image',
        `/uploads/reviews/${file.filename}`,
        file.originalname || null,
        file.mimetype || null,
        file.size || null,
      ]);
      await conn.query(
        `INSERT INTO facility_review_media
          (review_id, media_type, media_url, original_name, mime_type, file_size)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    return { id: reviewId, message: 'Review submitted' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { 
  getAllFacilities, 
  getFacilityById, 
  checkAvailability, 
  quoteBooking,
  bookFacility, 
  getUserBookings,
  getBookingById,
  cancelBooking,
  deleteBooking,
  getTicketForBooking,
  getFacilityReviews,
  createFacilityReview
};
