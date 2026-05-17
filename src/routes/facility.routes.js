const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facility.controller');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const reviewUploadDir = path.join(__dirname, '../../public/uploads/reviews');
fs.mkdirSync(reviewUploadDir, { recursive: true });

const reviewUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, reviewUploadDir),
    filename: (req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `review-${suffix}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    cb(allowed ? null : new Error('Only photo and video uploads are allowed'), allowed);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 6,
  },
});

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

// GET /api/facilities/:id/reviews
router.get('/:id/reviews', facilityController.getFacilityReviews);

// POST /api/facilities/:id/reviews
router.post('/:id/reviews', authMiddleware, reviewUpload.array('media', 6), facilityController.createFacilityReview);

// GET /api/facilities/:id/availability
router.get('/:id/availability', facilityController.checkAvailability);

// POST /api/facilities/:id/quote
router.post('/:id/quote', authMiddleware, facilityController.quoteBooking);

// POST /api/facilities/:id/book
router.post('/:id/book', authMiddleware, facilityController.bookFacility);

module.exports = router;
