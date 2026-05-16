const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminMiddleware = require('../middleware/admin');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads/facilities');
fs.mkdirSync(uploadDir, { recursive: true });

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'facility-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only images (jpg, png, webp) are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Protect all admin routes
router.use(authMiddleware, adminMiddleware);

// Dashboard
router.get('/dashboard/summary', adminController.getDashboardSummary);
router.get('/dashboard/revenue-chart', adminController.getRevenueChart);
router.get('/dashboard/booking-status-chart', adminController.getBookingStatusChart);
router.get('/dashboard/occupancy-chart', adminController.getOccupancyChart);

router.get('/bookings', adminController.listBookings);
router.post('/check-in/lookup', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), adminController.lookupTicketForCheckIn);
router.post('/check-in/scan', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), adminController.checkInTicket);
router.post('/check-in/confirm', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), adminController.checkInTicket);

// Facilities CRUD
router.get('/facilities', adminController.getAllFacilities);
router.get('/facilities/:id', adminController.getFacilityById);
router.post('/facilities', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), upload.single('image'), adminController.createFacility);
router.put('/facilities/:id', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), upload.single('image'), adminController.updateFacility);
router.patch('/facilities/:id/status', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), adminController.updateFacilityStatus);
router.post('/facilities/:id/image', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), upload.single('image'), adminController.updateFacilityImage);
router.delete('/facilities/:id', requirePermission(['SUPER_ADMIN', 'ADMIN', 'STAFF']), adminController.deleteFacility);

module.exports = router;
