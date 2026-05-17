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

async function getPaymentStatusChart(req, res, next) {
  try {
    const data = await adminService.getPaymentStatusChart();
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

async function getCategoryUsageChart(req, res, next) {
  try {
    const data = await adminService.getCategoryUsageChart();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function getReports(req, res, next) {
  try {
    const data = await adminService.getReports(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const data = await adminService.listUsers(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function createStaffUser(req, res, next) {
  try {
    const result = await adminService.createStaffUser(req.body);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'STAFF_USER_CREATED',
      module: 'USERS',
      targetType: 'USER',
      targetId: result.id,
      details: { email: req.body?.email, access_tier: req.body?.access_tier || req.body?.accessTier },
      ipAddress,
      userAgent,
    });
    res.status(201).json({ ...result, message: 'Staff account created' });
  } catch (err) {
    next(err);
  }
}

async function updateUserAccess(req, res, next) {
  try {
    const result = await adminService.updateUserAccess(req.params.id, req.body, req.user?.id || null);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'USER_ACCESS_UPDATED',
      module: 'USERS',
      targetType: 'USER',
      targetId: result.id,
      details: { access_tier: result.access_tier, active: result.active },
      ipAddress,
      userAgent,
    });
    res.status(200).json({ ...result, message: 'User account updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const result = await adminService.deleteUser(req.params.id, req.user?.id || null);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'USER_DELETED',
      module: 'USERS',
      targetType: 'USER',
      targetId: result.id,
      details: {
        email: result.email,
        access_tier: result.access_tier,
        booking_count: result.booking_count,
      },
      ipAddress,
      userAgent,
    });
    res.status(200).json({ ...result, message: 'User account deleted' });
  } catch (err) {
    next(err);
  }
}

async function listSystemLogs(req, res, next) {
  try {
    const data = await adminService.listSystemLogs(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const data = await adminService.getSettings();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await adminService.updateSettings(req.body, req.user?.id || null);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'SETTINGS_UPDATED',
      module: 'SETTINGS',
      targetType: 'APP_SETTINGS',
      targetId: 'global',
      details: { sections: Object.keys(req.body || {}) },
      ipAddress,
      userAgent,
    });
    res.status(200).json({ ...data, message: 'Settings updated' });
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

async function getCalendarData(req, res, next) {
  try {
    const data = await adminService.getCalendarData(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

async function listBlackouts(req, res, next) {
  try {
    const rows = await adminService.listBlackouts();
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

async function createBlackout(req, res, next) {
  try {
    const result = await adminService.createBlackout(req.body);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'BLACKOUT_CREATED',
      module: 'CALENDAR',
      targetType: 'BLACKOUT',
      targetId: result.id,
      details: req.body,
      ipAddress,
      userAgent,
    });
    res.status(201).json({ ...result, message: 'Blackout window created' });
  } catch (err) {
    next(err);
  }
}

async function deleteBlackout(req, res, next) {
  try {
    const success = await adminService.deleteBlackout(req.params.id);
    if (!success) return res.status(404).json({ message: 'Blackout window not found' });

    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'BLACKOUT_DELETED',
      module: 'CALENDAR',
      targetType: 'BLACKOUT',
      targetId: req.params.id,
      details: {},
      ipAddress,
      userAgent,
    });
    res.status(200).json({ message: 'Blackout window deleted' });
  } catch (err) {
    next(err);
  }
}

async function listPromotions(req, res, next) {
  try {
    res.status(200).json(await adminService.listPromotions());
  } catch (err) {
    next(err);
  }
}

async function createPromotion(req, res, next) {
  try {
    const result = await adminService.createPromotion(req.body);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'PROMOTION_CREATED',
      module: 'RATES',
      targetType: 'PROMOTION',
      targetId: result.id,
      details: { ...req.body, code: result.code },
      ipAddress,
      userAgent,
    });
    res.status(201).json({ ...result, message: 'Promotion created' });
  } catch (err) {
    next(err);
  }
}

async function deletePromotion(req, res, next) {
  try {
    const success = await adminService.deletePromotion(req.params.id);
    if (!success) return res.status(404).json({ message: 'Promotion not found' });
    res.status(200).json({ message: 'Promotion deleted' });
  } catch (err) {
    next(err);
  }
}

async function listSeasonalRates(req, res, next) {
  try {
    res.status(200).json(await adminService.listSeasonalRates());
  } catch (err) {
    next(err);
  }
}

async function createSeasonalRate(req, res, next) {
  try {
    const result = await adminService.createSeasonalRate(req.body);
    const { userId, ipAddress, userAgent } = requestMeta(req);
    await logSystemAction({
      userId,
      action: 'SEASONAL_RATE_CREATED',
      module: 'RATES',
      targetType: 'SEASONAL_RATE',
      targetId: result.id,
      details: req.body,
      ipAddress,
      userAgent,
    });
    res.status(201).json({ ...result, message: 'Seasonal rate created' });
  } catch (err) {
    next(err);
  }
}

async function deleteSeasonalRate(req, res, next) {
  try {
    const success = await adminService.deleteSeasonalRate(req.params.id);
    if (!success) return res.status(404).json({ message: 'Seasonal rate not found' });
    res.status(200).json({ message: 'Seasonal rate deleted' });
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
  getPaymentStatusChart,
  getOccupancyChart,
  getCategoryUsageChart,
  getReports,
  listUsers,
  createStaffUser,
  updateUserAccess,
  deleteUser,
  listSystemLogs,
  getSettings,
  updateSettings,
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  updateFacilityStatus,
  updateFacilityImage,
  deleteFacility,
  listBookings,
  getCalendarData,
  listBlackouts,
  createBlackout,
  deleteBlackout,
  listPromotions,
  createPromotion,
  deletePromotion,
  listSeasonalRates,
  createSeasonalRate,
  deleteSeasonalRate,
  lookupTicketForCheckIn,
  checkInTicket,
};
