require('dotenv').config();
const mysql = require('mysql2/promise');
const { getConnectionOptions } = require('./db-config');
const { createOrUpdateAdminAccount } = require('./create-admin');

const FACILITIES = [
  // COTTAGES
  {
    name: 'Small Cottage',
    category: 'Cottage',
    size: 'Small',
    description: 'Perfect for small families or groups of friends.',
    units: 5,
    price_min: 500.00,
    price_max: 500.00,
    capacity_min: 1,
    capacity_max: 6,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Medium Cottage',
    category: 'Cottage',
    size: 'Medium',
    description: 'A medium-sized cottage for larger groups.',
    units: 0,
    price_min: 800.00,
    price_max: 800.00,
    capacity_min: 1,
    capacity_max: 10,
    is_available: 0,
    is_bookable: 0,
    unavailable_reason: 'Currently unavailable',
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Large Cottage',
    category: 'Cottage',
    size: 'Large',
    description: 'Spacious cottage for big families and gatherings.',
    units: 4,
    price_min: 1000.00,
    price_max: 1500.00,
    capacity_min: 1,
    capacity_max: 15,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Extra Large Cottage',
    category: 'Cottage',
    size: 'Extra Large',
    description: 'Our biggest cottage for very large groups.',
    units: 1,
    price_min: 2000.00,
    price_max: 2000.00,
    capacity_min: 1,
    capacity_max: 25,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=400&q=80',
  },
  // ROOMS / CABANAS
  {
    name: 'Small Room/Cabana',
    category: 'Room',
    size: 'Small',
    description: 'Cozy room for a small group or couple.',
    units: 2,
    price_min: 1200.00,
    price_max: 1500.00,
    capacity_min: 2,
    capacity_max: 6,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Medium Room/Cabana',
    category: 'Room',
    size: 'Medium',
    description: 'Comfortable room for families.',
    units: 4,
    price_min: 1700.00,
    price_max: 1700.00,
    capacity_min: 6,
    capacity_max: 8,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1515362778563-6a8d0e44bc0b?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Large Room/Cabana',
    category: 'Room',
    size: 'Large',
    description: 'Large room for up to 12 people.',
    units: 1,
    price_min: 3000.00,
    price_max: 3000.00,
    capacity_min: 1,
    capacity_max: 12,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Extra Large Room/Cabana',
    category: 'Room',
    size: 'Extra Large',
    description: 'Extra large cabana for big groups.',
    units: 1,
    price_min: 6000.00,
    price_max: 6000.00,
    capacity_min: 1,
    capacity_max: 30,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=400&q=80',
  },
  // BEACH EQUIPMENT
  {
    name: 'Life Vest',
    category: 'Equipment',
    size: 'Standard',
    description: 'Essential safety gear for water activities.',
    units: 50,
    price_min: 100.00,
    price_max: 500.00,
    capacity_min: 1,
    capacity_max: 1,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'HOURLY',
    image_url: 'https://images.unsplash.com/photo-1562155847-c05f7386b174?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Boat',
    category: 'Equipment',
    size: 'Standard',
    description: 'Enjoy a boat ride along the coast.',
    units: 5,
    price_min: 100.00,
    price_max: 500.00,
    capacity_min: 1,
    capacity_max: 6,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'HOURLY',
    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Stand Paddle Boat',
    category: 'Equipment',
    size: 'Standard',
    description: 'Fun and active way to explore the water.',
    units: 10,
    price_min: 100.00,
    price_max: 500.00,
    capacity_min: 1,
    capacity_max: 1,
    is_available: 1,
    is_bookable: 1,
    rental_type: 'HOURLY',
    image_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=400&q=80',
  },
];

async function seed() {
  const conn = await mysql.createConnection(getConnectionOptions());
  console.log('✅ Connected to database for seeding\n');

  await createOrUpdateAdminAccount(conn, { skipWhenMissing: true });

  // Clear existing facilities to avoid conflicts with new structure
  // In a real app we'd be more careful, but for seed we can reset
  await conn.query('DELETE FROM bookings');
  await conn.query('DELETE FROM facilities');
  console.log('  ✅ Existing facilities and bookings cleared');

  let added = 0;
  for (const f of FACILITIES) {
    await conn.query(
      `INSERT INTO facilities (name, category, size, description, units, price_min, price_max, capacity_min, capacity_max, is_available, is_bookable, unavailable_reason, rental_type, image_url, price_per_hour)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.name, f.category, f.size, f.description, f.units, f.price_min, f.price_max, f.capacity_min, f.capacity_max, f.is_available, f.is_bookable, f.unavailable_reason || null, f.rental_type, f.image_url, f.price_min]
    );
    console.log('  ✅ Facility added:', f.name);
    added++;
  }

  await conn.end();
  console.log('\n✅ Seeding complete.');
}

seed().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
