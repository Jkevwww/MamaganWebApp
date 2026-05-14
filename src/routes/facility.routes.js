const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facility.controller');
const authMiddleware = require('../middleware/auth');

// GET /api/facilities
router.get('/', facilityController.getAllFacilities);

// GET /api/facilities/bookings  (user's own bookings)
router.get('/bookings', authMiddleware, facilityController.getUserBookings);

// GET /api/facilities/:id
router.get('/:id', facilityController.getFacilityById);

// POST /api/facilities/:id/book
router.post('/:id/book', authMiddleware, facilityController.bookFacility);

module.exports = router;
