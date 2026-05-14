const { pool } = require('../config/db');

async function getDashboardSummary() {
  const [[totalBookings]] = await pool.query("SELECT COUNT(*) as count FROM bookings");
  const [[pendingBookings]] = await pool.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'");
  const [[monthlyRevenue]] = await pool.query(
    "SELECT SUM(total_amount) as total FROM bookings WHERE payment_status = 'paid' AND MONTH(date) = MONTH(CURRENT_DATE())"
  );
  const [[todayCheckins]] = await pool.query("SELECT COUNT(*) as count FROM bookings WHERE date = CURRENT_DATE() AND status = 'approved'");
  const [[totalUnits]] = await pool.query("SELECT SUM(inventory_count) as count FROM facilities WHERE active = 1");

  return {
    totalBookings: totalBookings.count,
    pendingBookings: pendingBookings.count,
    monthlyRevenue: monthlyRevenue.total || 0,
    todayCheckins: todayCheckins.count,
    availableUnits: totalUnits.count,
    bookingTrend: 15 // Mock trend
  };
}

async function getRevenueChart() {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(date, '%b') as label, SUM(total_amount) as value
    FROM bookings
    WHERE payment_status = 'paid'
    GROUP BY MONTH(date)
    ORDER BY date ASC
    LIMIT 6
  `);
  
  return {
    labels: rows.map(r => r.label),
    values: rows.map(r => r.value)
  };
}

async function getBookingStatusChart() {
  const [rows] = await pool.query(`
    SELECT status as label, COUNT(*) as value
    FROM bookings
    GROUP BY status
  `);

  return {
    labels: rows.map(r => r.label.toUpperCase()),
    values: rows.map(r => r.value)
  };
}

async function getOccupancyChart() {
  // Simple mock data for now
  return {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [30, 45, 35, 50, 85, 95, 90]
  };
}

// Facility Admin CRUD
async function getAllFacilitiesAdmin(filters = {}) {
  let query = 'SELECT * FROM facilities WHERE 1=1';
  const params = [];

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters.active !== undefined) {
    query += ' AND active = ?';
    params.push(filters.active);
  }
  if (filters.search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' ORDER BY category, name';
  const [rows] = await pool.query(query, params);
  return rows;
}

async function createFacility(data) {
  const [result] = await pool.query(
    `INSERT INTO facilities (
      name, category, size, description, image_url, inventory_count,
      capacity_min, capacity_max, price_min, price_max,
      day_rate_min, day_rate_max, night_surcharge_min, night_surcharge_max,
      hourly_rate, daily_rate, rental_type, active, bookable,
      unavailable_reason, restricted_during_peak_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.category, data.size, data.description, data.image_url, data.inventory_count,
      data.capacity_min, data.capacity_max, data.price_min, data.price_max,
      data.day_rate_min, data.day_rate_max, data.night_surcharge_min, data.night_surcharge_max,
      data.hourly_rate, data.daily_rate, data.rental_type, data.active ?? 1, data.bookable ?? 1,
      data.unavailable_reason || null, data.restricted_during_peak_hours ?? 0
    ]
  );
  return result.insertId;
}

async function updateFacility(id, data) {
  const [result] = await pool.query(
    `UPDATE facilities SET 
      name=?, category=?, size=?, description=?, image_url=?, inventory_count=?,
      capacity_min=?, capacity_max=?, price_min=?, price_max=?,
      day_rate_min=?, day_rate_max=?, night_surcharge_min=?, night_surcharge_max=?,
      hourly_rate=?, daily_rate=?, rental_type=?, active=?, bookable=?,
      unavailable_reason=?, restricted_during_peak_hours=?
    WHERE id = ?`,
    [
      data.name, data.category, data.size, data.description, data.image_url, data.inventory_count,
      data.capacity_min, data.capacity_max, data.price_min, data.price_max,
      data.day_rate_min, data.day_rate_max, data.night_surcharge_min, data.night_surcharge_max,
      data.hourly_rate, data.daily_rate, data.rental_type, data.active, data.bookable,
      data.unavailable_reason, data.restricted_during_peak_hours, id
    ]
  );
  return result.affectedRows > 0;
}

async function deleteFacility(id) {
  // Use soft delete by setting active=0 if preferred, or hard delete
  const [result] = await pool.query("DELETE FROM facilities WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  getDashboardSummary,
  getRevenueChart,
  getBookingStatusChart,
  getOccupancyChart,
  getAllFacilitiesAdmin,
  createFacility,
  updateFacility,
  deleteFacility
};
