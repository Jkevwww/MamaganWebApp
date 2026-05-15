const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');

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
  const [[totalBookings]] = await pool.query('SELECT COUNT(*) as count FROM bookings');
  const [[pendingBookings]] = await pool.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'");
  const [[monthlyRevenue]] = await pool.query(
    "SELECT SUM(total_amount) as total FROM bookings WHERE payment_status = 'paid' AND MONTH(date) = MONTH(CURRENT_DATE())"
  );
  const [[todayCheckins]] = await pool.query("SELECT COUNT(*) as count FROM bookings WHERE date = CURRENT_DATE() AND status = 'approved'");
  const [[totalUnits]] = await pool.query('SELECT SUM(inventory_count) as count FROM facilities WHERE active = 1 AND deleted_at IS NULL');

  return {
    totalBookings: totalBookings.count,
    pendingBookings: pendingBookings.count,
    monthlyRevenue: monthlyRevenue.total || 0,
    todayCheckins: todayCheckins.count,
    availableUnits: totalUnits.count || 0,
    bookingTrend: 15,
  };
}

async function getRevenueChart() {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(date, '%b') as label, SUM(total_amount) as value
    FROM bookings
    WHERE payment_status = 'paid'
    GROUP BY MONTH(date), DATE_FORMAT(date, '%b')
    ORDER BY MIN(date) ASC
    LIMIT 6
  `);

  return {
    labels: rows.map((r) => r.label),
    values: rows.map((r) => r.value),
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
    values: rows.map((r) => r.value),
  };
}

async function getOccupancyChart() {
  return {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [30, 45, 35, 50, 85, 95, 90],
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

module.exports = {
  getDashboardSummary,
  getRevenueChart,
  getBookingStatusChart,
  getOccupancyChart,
  getAllFacilitiesAdmin,
  getFacilityByIdAdmin,
  createFacility,
  updateFacility,
  updateFacilityStatus,
  updateFacilityImage,
  deleteFacility,
  listBookings,
};
