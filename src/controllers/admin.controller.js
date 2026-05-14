const adminService = require('../services/admin.service');

async function getDashboardStats(req, res, next) {
  try {
    const stats = await adminService.getDashboardStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

async function getAllUsers(req, res, next) {
  try {
    const users = await adminService.getAllUsers();
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}

async function getAllBookings(req, res, next) {
  try {
    const bookings = await adminService.getAllBookings();
    res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
}

async function updateBookingStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }
    const result = await adminService.updateBookingStatus(req.params.id, status);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats, getAllUsers, getAllBookings, updateBookingStatus };
