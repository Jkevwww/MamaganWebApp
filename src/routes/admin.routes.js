const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminMiddleware = require('../middleware/admin');

// All admin routes require admin role
router.use(adminMiddleware);

// GET /api/admin/stats
router.get('/stats', adminController.getDashboardStats);

// GET /api/admin/users
router.get('/users', adminController.getAllUsers);

// GET /api/admin/bookings
router.get('/bookings', adminController.getAllBookings);

// PATCH /api/admin/bookings/:id
router.patch('/bookings/:id', adminController.updateBookingStatus);

module.exports = router;
