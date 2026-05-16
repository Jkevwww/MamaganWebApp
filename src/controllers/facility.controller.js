const facilityService = require('../services/facility.service');

async function getAllFacilities(req, res, next) {
  try {
    const { category, min_price, max_price, capacity } = req.query;
    const facilities = await facilityService.getAllFacilities({
      category,
      min_price,
      max_price,
      capacity
    });
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

async function checkAvailability(req, res, next) {
  try {
    const { date, startTime, endTime, quantity } = req.query;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'date, startTime, and endTime are required' });
    }
    const result = await facilityService.checkAvailability(
      req.params.id, 
      date, 
      startTime, 
      endTime, 
      parseInt(quantity) || 1
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function bookFacility(req, res, next) {
  try {
    const { date, start_time, end_time, quantity, guest_count, notes, bookingType } = req.body;
    
    if (!date || !start_time || !end_time) {
      return res.status(400).json({ message: 'date, start_time, and end_time are required' });
    }

    const result = await facilityService.bookFacility({
      facilityId: req.params.id,
      userId: req.user.id,
      date,
      start_time,
      end_time,
      quantity: parseInt(quantity) || 1,
      guest_count: parseInt(guest_count) || 1,
      notes,
      bookingType
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

async function getBookingById(req, res, next) {
  try {
    const booking = await facilityService.getBookingById(req.params.id, req.user.id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const result = await facilityService.cancelBooking(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteBooking(req, res, next) {
  try {
    const result = await facilityService.deleteBooking(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getTicketForBooking(req, res, next) {
  try {
    const ticket = await facilityService.getTicketForBooking(req.params.id, req.user.id);
    res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
}

module.exports = { 
  getAllFacilities, 
  getFacilityById, 
  checkAvailability, 
  bookFacility, 
  getUserBookings,
  getBookingById,
  cancelBooking,
  deleteBooking,
  getTicketForBooking
};
