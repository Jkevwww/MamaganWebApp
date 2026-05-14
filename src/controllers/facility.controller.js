const facilityService = require('../services/facility.service');

async function getAllFacilities(req, res, next) {
  try {
    const facilities = await facilityService.getAllFacilities();
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

async function bookFacility(req, res, next) {
  try {
    const { date, start_time, end_time, notes } = req.body;
    if (!date || !start_time || !end_time) {
      return res.status(400).json({ message: 'date, start_time, and end_time are required' });
    }
    const result = await facilityService.bookFacility({
      facilityId: req.params.id,
      userId: req.user.id,
      date,
      start_time,
      end_time,
      notes,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function getUserBookings(req, res, next) {
  try {
    const bookings = await facilityService.getUserBookings(req.user.id);
    res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllFacilities, getFacilityById, bookFacility, getUserBookings };
