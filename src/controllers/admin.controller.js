const adminService = require('../services/admin.service');
const facilityService = require('../services/facility.service');
const { logAction } = require('../utils/logger');

async function getDashboardSummary(req, res, next) {
  try {
    const summary = await adminService.getDashboardSummary();
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

async function getRevenueChart(req, res, next) {
  try {
    const data = await adminService.getRevenueChart();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function getBookingStatusChart(req, res, next) {
  try {
    const data = await adminService.getBookingStatusChart();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function getOccupancyChart(req, res, next) {
  try {
    const data = await adminService.getOccupancyChart();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// Facilities
async function getAllFacilities(req, res, next) {
  try {
    const filters = req.query;
    const facilities = await adminService.getAllFacilitiesAdmin(filters);
    res.status(200).json(facilities);
  } catch (err) {
    next(err);
  }
}

async function getFacilityById(req, res, next) {
  try {
    const facility = await facilityService.getFacilityById(req.params.id);
    res.status(200).json(facility);
  } catch (err) {
    next(err);
  }
}

async function createFacility(req, res, next) {
  try {
    const data = req.body;
    if (req.file) {
      data.image_url = `/uploads/facilities/${req.file.filename}`;
    }
    const id = await adminService.createFacility(data);
    
    await logAction({
      userId: req.user.id,
      action: 'FACILITY_CREATE',
      entityType: 'FACILITY',
      entityId: id,
      details: { name: data.name },
      ipAddress: req.ip
    });

    res.status(201).json({ id, message: 'Facility created successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateFacility(req, res, next) {
  try {
    const data = req.body;
    if (req.file) {
      data.image_url = `/uploads/facilities/${req.file.filename}`;
    }
    const success = await adminService.updateFacility(req.params.id, data);
    if (!success) return res.status(404).json({ message: 'Facility not found' });

    await logAction({
      userId: req.user.id,
      action: 'FACILITY_UPDATE',
      entityType: 'FACILITY',
      entityId: req.params.id,
      details: { name: data.name },
      ipAddress: req.ip
    });

    res.status(200).json({ message: 'Facility updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function deleteFacility(req, res, next) {
  try {
    const success = await adminService.deleteFacility(req.params.id);
    if (!success) return res.status(404).json({ message: 'Facility not found' });

    await logAction({
      userId: req.user.id,
      action: 'FACILITY_DELETE',
      entityType: 'FACILITY',
      entityId: req.params.id,
      ipAddress: req.ip
    });

    res.status(200).json({ message: 'Facility deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function listBookings(req, res, next) {
  try {
    const rows = await adminService.listBookings();
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardSummary,
  getRevenueChart,
  getBookingStatusChart,
  getOccupancyChart,
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  listBookings,
};
