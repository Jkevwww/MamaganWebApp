const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');
const qrUtils = require('../utils/qr');
const crypto = require('crypto');

const FACILITY_COLUMNS = `
  id, name, category, size, description, image_url, inventory_count,
  capacity_min, capacity_max, price_min, price_max,
  day_rate_min, day_rate_max, night_surcharge_min, night_surcharge_max,
  hourly_rate, daily_rate, rental_type, active, bookable,
  bookable AS is_bookable,
  unavailable_reason, restricted_during_peak_hours, deleted_at, created_at, updated_at
`;

const CATEGORIES = new Set(['COTTAGE', 'CABANA', 'BEACH_EQUIPMENT']);
const SIZES = new Set(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE']);
const RENTAL_TYPES = new Set(['FIXED', 'HOURLY', 'DAILY', 'HOURLY_OR_DAILY']);

function toNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function toText(value) {
  const normalized = toNull(value);
  return normalized === null ? null : String(normalized).trim();
}

function toEnum(value) {
  const normalized = toText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue ? 1 : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized) ? 1 : 0;
}

function toNonNegativeInteger(value, field, { required = false } = {}) {
  const normalized = toNull(value);
  if (normalized === null) {
    if (required) throw new AppError(`${field} is required`, 400);
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${field} must be 0 or greater`, 400);
  }
  return parsed;
}

function toNonNegativeDecimal(value, field, { required = false } = {}) {
  const normalized = toNull(value);
  if (normalized === null) {
    if (required) throw new AppError(`${field} is required`, 400);
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${field} must be 0 or greater`, 400);
  }
  return parsed;
}

function assertEnum(field, value, allowed, required = false) {
  if (!value) {
    if (required) throw new AppError(`${field} is required`, 400);
    return null;
  }
  if (!allowed.has(value)) {
    throw new AppError(`${field} has an invalid value`, 400);
  }
  return value;
}

function validatePriceRange(min, max, minField, maxField) {
  if (min !== null && max !== null && max < min) {
    throw new AppError(`${maxField} must be greater than or equal to ${minField}`, 400);
  }
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizePromoCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function generateUniquePromoCode() {
  for (let i = 0; i < 8; i++) {
    const code = `MAMA${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const [rows] = await pool.query('SELECT id FROM promotions WHERE code = ? LIMIT 1', [code]);
    if (rows.length === 0) return code;
  }
  throw new AppError('Unable to generate a unique promo code', 500);
}

function normalizeFacilityPayload(input = {}, existing = null) {
  const data = { ...(existing || {}), ...input };
  const name = toText(data.name);
  const category = assertEnum('category', toEnum(data.category), CATEGORIES, true);
  const active = toBoolean(data.active, true);
  const bookable = toBoolean(data.bookable, true);
  const restricted = toBoolean(data.restricted_during_peak_hours, false);
  const inventoryCount = toNonNegativeInteger(data.inventory_count, 'inventory_count', { required: true });

  if (!name) throw new AppError('name is required', 400);

  const normalized = {
    name,
    category,
    size: null,
    description: toText(data.description),
    image_url: toText(data.image_url),
    inventory_count: inventoryCount,
    capacity_min: toNonNegativeInteger(data.capacity_min, 'capacity_min'),
    capacity_max: toNonNegativeInteger(data.capacity_max, 'capacity_max'),
    price_min: toNonNegativeDecimal(data.price_min, 'price_min'),
    price_max: toNonNegativeDecimal(data.price_max, 'price_max'),
    day_rate_min: toNonNegativeDecimal(data.day_rate_min, 'day_rate_min'),
    day_rate_max: toNonNegativeDecimal(data.day_rate_max, 'day_rate_max'),
    night_surcharge_min: toNonNegativeDecimal(data.night_surcharge_min, 'night_surcharge_min'),
    night_surcharge_max: toNonNegativeDecimal(data.night_surcharge_max, 'night_surcharge_max'),
    hourly_rate: toNonNegativeDecimal(data.hourly_rate, 'hourly_rate'),
    daily_rate: toNonNegativeDecimal(data.daily_rate, 'daily_rate'),
    rental_type: assertEnum('rental_type', toEnum(data.rental_type) || 'FIXED', RENTAL_TYPES, true),
    active,
    bookable,
    unavailable_reason: toText(data.unavailable_reason),
    restricted_during_peak_hours: restricted,
  };

  if (category === 'COTTAGE') {
    normalized.size = assertEnum('size', toEnum(data.size), SIZES, true);
    normalized.rental_type = 'FIXED';
    normalized.capacity_min = null;
    normalized.capacity_max = null;
    normalized.day_rate_min = null;
    normalized.day_rate_max = null;
    normalized.night_surcharge_min = null;
    normalized.night_surcharge_max = null;
    normalized.hourly_rate = null;
    normalized.daily_rate = null;

    if (bookable) {
      normalized.price_min = toNonNegativeDecimal(data.price_min, 'price_min', { required: true });
      normalized.price_max = toNonNegativeDecimal(data.price_max, 'price_max', { required: true });
      validatePriceRange(normalized.price_min, normalized.price_max, 'price_min', 'price_max');
    }
  }

  if (category === 'CABANA') {
    normalized.size = assertEnum('size', toEnum(data.size), SIZES, true);
    normalized.rental_type = 'DAILY';
    normalized.capacity_min = toNonNegativeInteger(data.capacity_min, 'capacity_min', { required: true });
    normalized.capacity_max = toNonNegativeInteger(data.capacity_max, 'capacity_max', { required: true });
    normalized.day_rate_min = toNonNegativeDecimal(data.day_rate_min, 'day_rate_min', { required: true });
    normalized.day_rate_max = toNonNegativeDecimal(data.day_rate_max, 'day_rate_max', { required: true });
    normalized.night_surcharge_min = toNonNegativeDecimal(data.night_surcharge_min, 'night_surcharge_min', { required: true });
    normalized.night_surcharge_max = toNonNegativeDecimal(data.night_surcharge_max, 'night_surcharge_max', { required: true });
    normalized.price_min = normalized.day_rate_min;
    normalized.price_max = normalized.day_rate_max;
    normalized.hourly_rate = null;
    normalized.daily_rate = null;
    validatePriceRange(normalized.day_rate_min, normalized.day_rate_max, 'day_rate_min', 'day_rate_max');
    validatePriceRange(normalized.night_surcharge_min, normalized.night_surcharge_max, 'night_surcharge_min', 'night_surcharge_max');
    if (normalized.capacity_max < normalized.capacity_min) {
      throw new AppError('capacity_max must be greater than or equal to capacity_min', 400);
    }
  }

  if (category === 'BEACH_EQUIPMENT') {
    normalized.size = null;
    normalized.rental_type = assertEnum('rental_type', toEnum(data.rental_type), new Set(['HOURLY', 'DAILY', 'HOURLY_OR_DAILY']), true);
    normalized.hourly_rate = toNonNegativeDecimal(data.hourly_rate, 'hourly_rate', { required: true });
    normalized.daily_rate = toNonNegativeDecimal(data.daily_rate, 'daily_rate', { required: true });
    normalized.price_min = normalized.hourly_rate;
    normalized.price_max = normalized.daily_rate;
    normalized.day_rate_min = null;
    normalized.day_rate_max = null;
    normalized.night_surcharge_min = null;
    normalized.night_surcharge_max = null;
  }

  if (!normalized.bookable && !normalized.unavailable_reason) {
    normalized.unavailable_reason = 'Currently unavailable';
  }

  if (!normalized.active) {
    normalized.bookable = 0;
  }

  return normalized;
}

async function getDashboardSummary() {
  const [[totals]] = await pool.query(`
    SELECT
      COUNT(*) AS total_bookings,
      SUM(status = 'pending') AS pending_bookings,
      SUM(status = 'approved') AS approved_bookings,
      SUM(status = 'cancelled') AS cancelled_bookings,
      SUM(payment_status = 'paid') AS paid_bookings,
      SUM(payment_status = 'pending') AS pending_payments,
      SUM(payment_status = 'failed') AS failed_payments
    FROM bookings
  `);
  const [[monthlyRevenue]] = await pool.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS total FROM bookings WHERE payment_status = 'paid' AND YEAR(date) = YEAR(CURRENT_DATE()) AND MONTH(date) = MONTH(CURRENT_DATE())"
  );
  const [[currentMonthBookings]] = await pool.query(
    "SELECT COUNT(*) AS count FROM bookings WHERE YEAR(date) = YEAR(CURRENT_DATE()) AND MONTH(date) = MONTH(CURRENT_DATE())"
  );
  const [[previousMonthBookings]] = await pool.query(
    "SELECT COUNT(*) AS count FROM bookings WHERE date >= DATE_FORMAT(CURRENT_DATE() - INTERVAL 1 MONTH, '%Y-%m-01') AND date < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')"
  );
  const [[todayBookings]] = await pool.query("SELECT COUNT(*) AS count FROM bookings WHERE date = CURRENT_DATE() AND status != 'cancelled'");
  const [[todayCheckins]] = await pool.query("SELECT COUNT(*) AS count FROM tickets WHERE DATE(checked_in_at) = CURRENT_DATE()");
  const [[totalUnits]] = await pool.query('SELECT COALESCE(SUM(inventory_count), 0) AS count FROM facilities WHERE active = 1 AND deleted_at IS NULL');

  const currentCount = Number(currentMonthBookings.count || 0);
  const previousCount = Number(previousMonthBookings.count || 0);
  const bookingTrend = previousCount > 0
    ? Math.round(((currentCount - previousCount) / previousCount) * 100)
    : (currentCount > 0 ? 100 : 0);

  return {
    totalBookings: Number(totals.total_bookings || 0),
    pendingBookings: Number(totals.pending_bookings || 0),
    approvedBookings: Number(totals.approved_bookings || 0),
    cancelledBookings: Number(totals.cancelled_bookings || 0),
    paidBookings: Number(totals.paid_bookings || 0),
    pendingPayments: Number(totals.pending_payments || 0),
    failedPayments: Number(totals.failed_payments || 0),
    monthlyRevenue: Number(monthlyRevenue.total || 0),
    todayBookings: Number(todayBookings.count || 0),
    todayCheckins: Number(todayCheckins.count || 0),
    availableUnits: Number(totalUnits.count || 0),
    bookingTrend,
  };
}

async function getRevenueChart() {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(date, '%b %Y') AS label, COALESCE(SUM(total_amount), 0) AS value
    FROM bookings
    WHERE payment_status = 'paid'
      AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
    GROUP BY YEAR(date), MONTH(date), DATE_FORMAT(date, '%b %Y')
    ORDER BY MIN(date) ASC
  `);

  return {
    labels: rows.map((r) => r.label),
    values: rows.map((r) => Number(r.value || 0)),
  };
}

async function getBookingStatusChart() {
  const [rows] = await pool.query(`
    SELECT status as label, COUNT(*) as value
    FROM bookings
    GROUP BY status
  `);

  return {
    labels: rows.map((r) => String(r.label).toUpperCase()),
    values: rows.map((r) => Number(r.value || 0)),
  };
}

async function getPaymentStatusChart() {
  const [rows] = await pool.query(`
    SELECT COALESCE(payment_status, 'pending') AS label, COUNT(*) AS value
    FROM bookings
    GROUP BY COALESCE(payment_status, 'pending')
  `);

  return {
    labels: rows.map((r) => String(r.label).toUpperCase()),
    values: rows.map((r) => Number(r.value || 0)),
  };
}

async function getOccupancyChart() {
  const [rows] = await pool.query(`
    SELECT
      DATE_FORMAT(d.day, '%a') AS label,
      LEAST(
        100,
        ROUND((COALESCE(SUM(b.quantity), 0) / NULLIF((SELECT COALESCE(SUM(inventory_count), 0) FROM facilities WHERE active = 1 AND deleted_at IS NULL), 0)) * 100)
      ) AS value
    FROM (
      SELECT CURRENT_DATE() AS day
      UNION ALL SELECT CURRENT_DATE() + INTERVAL 1 DAY
      UNION ALL SELECT CURRENT_DATE() + INTERVAL 2 DAY
      UNION ALL SELECT CURRENT_DATE() + INTERVAL 3 DAY
      UNION ALL SELECT CURRENT_DATE() + INTERVAL 4 DAY
      UNION ALL SELECT CURRENT_DATE() + INTERVAL 5 DAY
      UNION ALL SELECT CURRENT_DATE() + INTERVAL 6 DAY
    ) d
    LEFT JOIN bookings b
      ON b.date = d.day
      AND b.status != 'cancelled'
    GROUP BY d.day
    ORDER BY d.day
  `);

  return {
    labels: rows.map((r) => r.label),
    values: rows.map((r) => Number(r.value || 0)),
  };
}

async function getCategoryUsageChart() {
  const [rows] = await pool.query(`
    SELECT COALESCE(f.category, 'UNKNOWN') AS label, COUNT(b.id) AS value
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    WHERE b.status != 'cancelled'
    GROUP BY COALESCE(f.category, 'UNKNOWN')
    ORDER BY value DESC
  `);

  return {
    labels: rows.map((r) => String(r.label).replace(/_/g, ' ')),
    values: rows.map((r) => Number(r.value || 0)),
  };
}

async function getAllFacilitiesAdmin(filters = {}) {
  const where = ['deleted_at IS NULL'];
  const params = [];

  if (filters.search) {
    where.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.category) {
    where.push('category = ?');
    params.push(String(filters.category).toUpperCase());
  }
  if (filters.size) {
    where.push('size = ?');
    params.push(String(filters.size).toUpperCase());
  }
  if (filters.active !== undefined && filters.active !== '') {
    where.push('active = ?');
    params.push(toBoolean(filters.active));
  }
  if (filters.bookable !== undefined && filters.bookable !== '') {
    where.push('bookable = ?');
    params.push(toBoolean(filters.bookable));
  }

  const [rows] = await pool.query(
    `SELECT ${FACILITY_COLUMNS}
     FROM facilities
     WHERE ${where.join(' AND ')}
     ORDER BY FIELD(category, 'COTTAGE', 'CABANA', 'BEACH_EQUIPMENT'), FIELD(size, 'SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'), name`,
    params
  );
  return rows;
}

async function getFacilityByIdAdmin(id) {
  const [rows] = await pool.query(
    `SELECT ${FACILITY_COLUMNS} FROM facilities WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (rows.length === 0) throw new AppError('Facility not found', 404);
  return rows[0];
}

async function createFacility(data) {
  const facility = normalizeFacilityPayload(data);
  const [result] = await pool.query(
    `INSERT INTO facilities (
      name, category, size, description, image_url, inventory_count,
      capacity_min, capacity_max, price_min, price_max,
      day_rate_min, day_rate_max, night_surcharge_min, night_surcharge_max,
      hourly_rate, daily_rate, rental_type, active, bookable,
      unavailable_reason, restricted_during_peak_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      facility.name, facility.category, facility.size, facility.description, facility.image_url, facility.inventory_count,
      facility.capacity_min, facility.capacity_max, facility.price_min, facility.price_max,
      facility.day_rate_min, facility.day_rate_max, facility.night_surcharge_min, facility.night_surcharge_max,
      facility.hourly_rate, facility.daily_rate, facility.rental_type, facility.active, facility.bookable,
      facility.unavailable_reason, facility.restricted_during_peak_hours,
    ]
  );
  return result.insertId;
}

async function updateFacility(id, data) {
  const existing = await getFacilityByIdAdmin(id);
  const facility = normalizeFacilityPayload(data, existing);
  const [result] = await pool.query(
    `UPDATE facilities SET
      name = ?, category = ?, size = ?, description = ?, image_url = ?, inventory_count = ?,
      capacity_min = ?, capacity_max = ?, price_min = ?, price_max = ?,
      day_rate_min = ?, day_rate_max = ?, night_surcharge_min = ?, night_surcharge_max = ?,
      hourly_rate = ?, daily_rate = ?, rental_type = ?, active = ?, bookable = ?,
      unavailable_reason = ?, restricted_during_peak_hours = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [
      facility.name, facility.category, facility.size, facility.description, facility.image_url, facility.inventory_count,
      facility.capacity_min, facility.capacity_max, facility.price_min, facility.price_max,
      facility.day_rate_min, facility.day_rate_max, facility.night_surcharge_min, facility.night_surcharge_max,
      facility.hourly_rate, facility.daily_rate, facility.rental_type, facility.active, facility.bookable,
      facility.unavailable_reason, facility.restricted_during_peak_hours, id,
    ]
  );
  return result.affectedRows > 0;
}

async function updateFacilityStatus(id, data) {
  const existing = await getFacilityByIdAdmin(id);
  const active = data.active === undefined ? toBoolean(existing.active) : toBoolean(data.active);
  let bookable = data.bookable === undefined ? toBoolean(existing.bookable) : toBoolean(data.bookable);
  if (!active) bookable = 0;
  const unavailableReason = !bookable
    ? toText(data.unavailable_reason) || existing.unavailable_reason || 'Currently unavailable'
    : toText(data.unavailable_reason);

  const [result] = await pool.query(
    `UPDATE facilities
     SET active = ?, bookable = ?, unavailable_reason = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [active, bookable, unavailableReason, id]
  );
  return result.affectedRows > 0;
}

async function updateFacilityImage(id, imageUrl) {
  await getFacilityByIdAdmin(id);
  const [result] = await pool.query(
    'UPDATE facilities SET image_url = ? WHERE id = ? AND deleted_at IS NULL',
    [toText(imageUrl), id]
  );
  return result.affectedRows > 0;
}

async function deleteFacility(id) {
  const [result] = await pool.query(
    `UPDATE facilities
     SET deleted_at = NOW(), active = 0, bookable = 0
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return result.affectedRows > 0;
}

async function listBookings() {
  const [rows] = await pool.query(`
    SELECT
      b.id,
      b.facility_id,
      b.user_id,
      b.date,
      b.start_time,
      b.end_time,
      b.status,
      COALESCE(b.quantity, 1) AS quantity,
      COALESCE(b.guest_count, 1) AS guest_count,
      COALESCE(b.total_amount, 0) AS total_amount,
      COALESCE(b.payment_status, 'pending') AS payment_status,
      b.created_at,
      u.name AS user_name,
      u.email AS user_email,
      f.name AS facility_name
    FROM bookings b
    INNER JOIN users u ON u.id = b.user_id
    INNER JOIN facilities f ON f.id = b.facility_id
    ORDER BY b.date DESC, b.created_at DESC
    LIMIT 400
  `);
  return rows;
}

async function getCalendarData({ year, month, facilityId } = {}) {
  const today = new Date();
  const y = Number.parseInt(year, 10) || today.getFullYear();
  const m = Number.parseInt(month, 10) || today.getMonth() + 1;
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = formatLocalDate(new Date(y, m, 0));
  const params = [startDate, endDate];
  const facilityFilter = facilityId ? ' AND b.facility_id = ?' : '';
  if (facilityId) params.push(facilityId);

  const [bookings] = await pool.query(
    `SELECT
       b.id,
       b.facility_id,
       DATE_FORMAT(b.date, '%Y-%m-%d') AS date,
       b.start_time,
       b.end_time,
       b.status,
       COALESCE(b.payment_status, 'pending') AS payment_status,
       COALESCE(b.quantity, 1) AS quantity,
       COALESCE(b.guest_count, 1) AS guest_count,
       u.name AS user_name,
       f.name AS facility_name
     FROM bookings b
     INNER JOIN users u ON u.id = b.user_id
     INNER JOIN facilities f ON f.id = b.facility_id
     WHERE b.date BETWEEN ? AND ?
       AND b.status != 'cancelled'
       ${facilityFilter}
     ORDER BY b.date ASC, b.start_time ASC`,
    params
  );

  const blackoutParams = [endDate, startDate];
  const blackoutFacilityFilter = facilityId ? ' AND (bp.facility_id IS NULL OR bp.facility_id = ?)' : '';
  if (facilityId) blackoutParams.push(facilityId);

  const [blackouts] = await pool.query(
    `SELECT
       bp.id,
       bp.facility_id,
       DATE_FORMAT(bp.start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(bp.end_date, '%Y-%m-%d') AS end_date,
       bp.reason,
       f.name AS facility_name
     FROM blackout_periods bp
     LEFT JOIN facilities f ON f.id = bp.facility_id
     WHERE bp.start_date <= ?
       AND bp.end_date >= ?
       ${blackoutFacilityFilter}
     ORDER BY bp.start_date ASC, bp.end_date ASC`,
    blackoutParams
  );

  return { year: y, month: m, startDate, endDate, bookings, blackouts };
}

async function listBlackouts() {
  const [rows] = await pool.query(
    `SELECT
       bp.id,
       bp.facility_id,
       DATE_FORMAT(bp.start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(bp.end_date, '%Y-%m-%d') AS end_date,
       bp.reason,
       bp.created_at,
       f.name AS facility_name
     FROM blackout_periods bp
     LEFT JOIN facilities f ON f.id = bp.facility_id
     WHERE bp.end_date >= CURRENT_DATE()
     ORDER BY bp.start_date DESC, bp.end_date DESC
     LIMIT 200`
  );
  return rows;
}

async function createBlackout(data = {}) {
  const facilityId = toNull(data.facility_id);
  const startDate = toText(data.start_date);
  const endDate = toText(data.end_date);
  const reason = toText(data.reason) || 'Unavailable';

  if (!startDate || !endDate) {
    throw new AppError('start_date and end_date are required', 400);
  }

  if (endDate < startDate) {
    throw new AppError('end_date must be on or after start_date', 400);
  }

  if (facilityId) {
    await getFacilityByIdAdmin(facilityId);
  }

  const [result] = await pool.query(
    `INSERT INTO blackout_periods (facility_id, start_date, end_date, reason)
     VALUES (?, ?, ?, ?)`,
    [facilityId || null, startDate, endDate, reason]
  );

  return { id: result.insertId };
}

async function deleteBlackout(id) {
  const [result] = await pool.query('DELETE FROM blackout_periods WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function listPromotions() {
  const [rows] = await pool.query(
    `SELECT
       p.id, p.code, p.title, p.description, p.facility_id, p.discount_type,
       p.discount_value, p.min_amount, p.usage_limit, p.used_count,
       DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(p.end_date, '%Y-%m-%d') AS end_date,
       p.active, p.created_at, f.name AS facility_name
     FROM promotions p
     LEFT JOIN facilities f ON f.id = p.facility_id
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 200`
  );
  return rows;
}

async function createPromotion(data = {}) {
  const title = toText(data.title);
  const description = toText(data.description);
  const facilityId = toNull(data.facility_id);
  const discountType = assertEnum('discount_type', toEnum(data.discount_type) || 'PERCENT', new Set(['PERCENT', 'FIXED']), true);
  const discountValue = toNonNegativeDecimal(data.discount_value, 'discount_value', { required: true });
  const minAmount = toNonNegativeDecimal(data.min_amount, 'min_amount') || 0;
  const usageLimit = toNonNegativeInteger(data.usage_limit, 'usage_limit');
  const startDate = toText(data.start_date);
  const endDate = toText(data.end_date);
  const active = toBoolean(data.active, true);

  if (!title) throw new AppError('title is required', 400);
  if (!startDate || !endDate) throw new AppError('start_date and end_date are required', 400);
  if (endDate < startDate) throw new AppError('end_date must be on or after start_date', 400);
  if (discountType === 'PERCENT' && discountValue > 100) {
    throw new AppError('Percent discount cannot exceed 100', 400);
  }
  if (facilityId) await getFacilityByIdAdmin(facilityId);

  let code = normalizePromoCode(data.code);
  if (!code) {
    code = await generateUniquePromoCode();
  } else {
    const [existing] = await pool.query('SELECT id FROM promotions WHERE code = ? LIMIT 1', [code]);
    if (existing.length) throw new AppError('Promo code already exists', 400);
  }

  const [result] = await pool.query(
    `INSERT INTO promotions (
      code, title, description, facility_id, discount_type, discount_value,
      min_amount, usage_limit, start_date, end_date, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, title, description, facilityId || null, discountType, discountValue, minAmount, usageLimit, startDate, endDate, active]
  );

  return { id: result.insertId, code };
}

async function deletePromotion(id) {
  const [result] = await pool.query('DELETE FROM promotions WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function listSeasonalRates() {
  const [rows] = await pool.query(
    `SELECT
       sr.id, sr.name, sr.facility_id,
       DATE_FORMAT(sr.start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(sr.end_date, '%Y-%m-%d') AS end_date,
       sr.rate_multiplier, sr.active, sr.created_at,
       f.name AS facility_name
     FROM seasonal_rates sr
     LEFT JOIN facilities f ON f.id = sr.facility_id
     ORDER BY sr.start_date DESC, sr.id DESC
     LIMIT 200`
  );
  return rows;
}

async function createSeasonalRate(data = {}) {
  const name = toText(data.name);
  const facilityId = toNull(data.facility_id);
  const startDate = toText(data.start_date);
  const endDate = toText(data.end_date);
  const multiplier = toNonNegativeDecimal(data.rate_multiplier, 'rate_multiplier', { required: true });
  const active = toBoolean(data.active, true);

  if (!name) throw new AppError('name is required', 400);
  if (!startDate || !endDate) throw new AppError('start_date and end_date are required', 400);
  if (endDate < startDate) throw new AppError('end_date must be on or after start_date', 400);
  if (multiplier <= 0) throw new AppError('rate_multiplier must be greater than 0', 400);
  if (facilityId) await getFacilityByIdAdmin(facilityId);

  const [result] = await pool.query(
    `INSERT INTO seasonal_rates (name, facility_id, start_date, end_date, rate_multiplier, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, facilityId || null, startDate, endDate, multiplier, active]
  );

  return { id: result.insertId };
}

async function deleteSeasonalRate(id) {
  const [result] = await pool.query('DELETE FROM seasonal_rates WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

function normalizeCheckInRow(row) {
  const paymentReference = row.gcash_ref_no || row.provider_payment_id || row.reference_number;
  return {
    ticketId: row.ticket_id,
    ticketStatus: row.ticket_status,
    checkedIn: row.ticket_status === 'used',
    checkedInAt: row.checked_in_at,
    referenceNumber: row.reference_number,
    paymentReference,
    gcashRefNo: row.gcash_ref_no,
    providerPaymentId: row.provider_payment_id,
    paymentMethod: row.payment_method,
    paymentAmount: row.payment_amount,
    canCheckIn: row.booking_status !== 'cancelled' && row.payment_status === 'paid' && row.ticket_status === 'valid',
    booking: {
      id: row.booking_id,
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.booking_status,
      payment_status: row.payment_status,
      total_amount: row.total_amount,
      quantity: row.quantity,
      guest_count: row.guest_count,
      facility_name: row.facility_name,
      user_name: row.user_name,
      user_email: row.user_email,
    },
  };
}

function normalizeTicketLookup({ qrPayload, referenceNumber, code } = {}) {
  const raw = qrPayload || referenceNumber || code;
  const parsed = qrUtils.parseQrPayload(raw);
  const qrToken = parsed.qrToken || null;
  const ref = referenceNumber || parsed.referenceNumber || code || null;

  if (!qrToken && !ref) {
    throw new AppError('QR code or reference number is required', 400);
  }

  return {
    qrToken,
    referenceNumber: ref ? String(ref).trim() : null,
    raw: parsed.raw,
  };
}

async function getTicketCheckInDetails(input) {
  const lookup = normalizeTicketLookup(typeof input === 'object' ? input : { qrPayload: input });

  const [rows] = await pool.query(
    `SELECT
       t.id AS ticket_id,
       t.reference_number,
       t.status AS ticket_status,
       t.checked_in_at,
       b.id AS booking_id,
       b.date,
       b.start_time,
       b.end_time,
       b.status AS booking_status,
       COALESCE(b.payment_status, 'pending') AS payment_status,
       COALESCE(b.total_amount, 0) AS total_amount,
       COALESCE(b.quantity, 1) AS quantity,
       COALESCE(b.guest_count, 1) AS guest_count,
       u.name AS user_name,
       u.email AS user_email,
       f.name AS facility_name,
       p.payment_method,
       p.provider_payment_id,
       p.gcash_ref_no,
       p.amount AS payment_amount
     FROM tickets t
     INNER JOIN bookings b ON b.id = t.booking_id
     INNER JOIN users u ON u.id = b.user_id
     INNER JOIN facilities f ON f.id = b.facility_id
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id
       FROM payments p2
       WHERE p2.booking_id = b.id
       ORDER BY (p2.status = 'paid') DESC, p2.updated_at DESC, p2.id DESC
       LIMIT 1
     )
     WHERE t.qr_token = ?
        OR t.reference_number = ?
        OR EXISTS (
          SELECT 1
          FROM payments px
          WHERE px.booking_id = b.id
            AND (px.gcash_ref_no = ? OR px.provider_payment_id = ?)
        )
     LIMIT 1`,
    [lookup.qrToken, lookup.referenceNumber, lookup.referenceNumber, lookup.referenceNumber]
  );

  if (rows.length === 0) {
    throw new AppError('Ticket QR code or reference number was not found', 404);
  }

  const details = normalizeCheckInRow(rows[0]);
  return {
    status: 'found',
    message: details.canCheckIn
      ? 'Paid booking found. Review details before confirming check-in.'
      : 'Booking found. Review the status before check-in.',
    ...details,
  };
}

async function checkInTicket(input, checkedInBy = null) {
  const details = await getTicketCheckInDetails(input);

  if (details.booking.status === 'cancelled') {
    throw new AppError('This booking has been cancelled', 400);
  }

  if (details.booking.payment_status !== 'paid') {
    throw new AppError('This booking is not paid yet', 400);
  }

  if (details.ticketStatus === 'used') {
    return {
      ...details,
      status: 'already_checked_in',
      message: 'This guest has already been checked in',
    };
  }

  if (details.ticketStatus !== 'valid') {
    throw new AppError(`Ticket is ${details.ticketStatus}`, 400);
  }

  const [result] = await pool.query(
    "UPDATE tickets SET status = 'used', checked_in_at = NOW(), checked_in_by = ? WHERE id = ? AND status = 'valid'",
    [checkedInBy, details.ticketId]
  );

  if (result.affectedRows === 0) {
    const refreshed = await getTicketCheckInDetails(input);
    return {
      ...refreshed,
      status: 'already_checked_in',
      message: 'This guest has already been checked in',
    };
  }

  return {
    ...details,
    status: 'checked_in',
    message: 'Paid booking confirmed. Guest checked in.',
    ticketStatus: 'used',
    checkedIn: true,
    checkedInAt: new Date().toISOString(),
    canCheckIn: false,
  };
}

module.exports = {
  getDashboardSummary,
  getRevenueChart,
  getBookingStatusChart,
  getPaymentStatusChart,
  getOccupancyChart,
  getCategoryUsageChart,
  getAllFacilitiesAdmin,
  getFacilityByIdAdmin,
  createFacility,
  updateFacility,
  updateFacilityStatus,
  updateFacilityImage,
  deleteFacility,
  listBookings,
  getCalendarData,
  listBlackouts,
  createBlackout,
  deleteBlackout,
  listPromotions,
  createPromotion,
  deletePromotion,
  listSeasonalRates,
  createSeasonalRate,
  deleteSeasonalRate,
  getTicketCheckInDetails,
  checkInTicket,
};
