const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facility.controller');
const authMiddleware = require('../middleware/auth');

// GET /api/facilities
router.get('/', facilityController.getAllFacilities);

// GET /api/facilities/my-bookings
router.get('/my-bookings', authMiddleware, facilityController.getUserBookings);

// GET /api/facilities/bookings/:id
router.get('/bookings/:id', authMiddleware, facilityController.getBookingById);

// GET /api/facilities/bookings/:id/ticket
router.get('/bookings/:id/ticket', authMiddleware, facilityController.getTicketForBooking);

// PATCH /api/facilities/bookings/:id/cancel
router.patch('/bookings/:id/cancel', authMiddleware, facilityController.cancelBooking);

// DELETE /api/facilities/bookings/:id
router.delete('/bookings/:id', authMiddleware, facilityController.deleteBooking);

// GET /api/facilities/:id
router.get('/:id', facilityController.getFacilityById);

// GET /api/facilities/:id/availability
router.get('/:id/availability', facilityController.checkAvailability);

// POST /api/facilities/:id/quote
router.post('/:id/quote', authMiddleware, facilityController.quoteBooking);

// POST /api/facilities/:id/book
router.post('/:id/book', authMiddleware, facilityController.bookFacility);

module.exports = router;
