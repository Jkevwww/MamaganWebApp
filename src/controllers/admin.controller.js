const adminService = require('../services/admin.service');
const { logSystemAction } = require('../utils/logger');

function requestMeta(req) {
  return {
    userId: req.user?.id || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

async function logFacilityAction(req, action, targetId, details) {
  const { userId, ipAddress, userAgent } = requestMeta(req);
  await logSystemAction({
    userId,
    action,
    module: 'FACILITIES',
    targetType: 'FACILITY',
    targetId,
    details,
    ipAddress,
    userAgent,
  });
}

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
    const facility = await adminService.getFacilityByIdAdmin(req.params.id);
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

    await logFacilityAction(req, 'FACILITY_CREATED', id, { name: data.name, category: data.category });

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

    await logFacilityAction(req, 'FACILITY_UPDATED', req.params.id, { name: data.name, category: data.category });

    res.status(200).json({ message: 'Facility updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateFacilityStatus(req, res, next) {
  try {
    const success = await adminService.updateFacilityStatus(req.params.id, req.body);
    if (!success) return res.status(404).json({ message: 'Facility not found' });

    await logFacilityAction(req, 'FACILITY_STATUS_UPDATED', req.params.id, {
      active: req.body.active,
      bookable: req.body.bookable,
    });

    res.status(200).json({ message: 'Facility status updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateFacilityImage(req, res, next) {
  try {
    const imageUrl = req.file ? `/uploads/facilities/${req.file.filename}` : req.body.image_url;
    const success = await adminService.updateFacilityImage(req.params.id, imageUrl || null);
    if (!success) return res.status(404).json({ message: 'Facility not found' });

    await logFacilityAction(req, 'FACILITY_IMAGE_UPDATED', req.params.id, { image_url: imageUrl || null });

    res.status(200).json({ image_url: imageUrl || null, message: 'Facility image updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function deleteFacility(req, res, next) {
  try {
    const success = await adminService.deleteFacility(req.params.id);
    if (!success) return res.status(404).json({ message: 'Facility not found' });

    await logFacilityAction(req, 'FACILITY_DELETED', req.params.id, {});

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

async function checkInTicket(req, res, next) {
  try {
    const result = await adminService.checkInTicket(req.body, req.user?.id || null);

    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: result.status === 'checked_in' ? 'GUEST_CHECKED_IN' : 'GUEST_CHECK_IN_RESCAN',
      module: 'CHECK_IN',
      targetType: 'BOOKING',
      targetId: result.booking?.id,
      details: {
        ticket_status: result.ticketStatus,
        payment_status: result.booking?.payment_status,
        facility_name: result.booking?.facility_name,
      },
      ipAddress,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function lookupTicketForCheckIn(req, res, next) {
  try {
    const result = await adminService.getTicketCheckInDetails(req.body);

    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'CHECK_IN_TICKET_LOOKUP',
      module: 'CHECK_IN',
      targetType: 'BOOKING',
      targetId: result.booking?.id,
      details: {
        ticket_status: result.ticketStatus,
        payment_status: result.booking?.payment_status,
        reference_number: result.referenceNumber,
        payment_reference: result.paymentReference,
      },
      ipAddress,
      userAgent,
    });

    res.status(200).json(result);
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
  updateFacilityStatus,
  updateFacilityImage,
  deleteFacility,
  listBookings,
  lookupTicketForCheckIn,
  checkInTicket,
};
