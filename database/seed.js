require('dotenv').config();
const mysql = require('mysql2/promise');
const { getConnectionOptions } = require('./db-config');
const { createOrUpdateAdminAccount } = require('./create-admin');

const FACILITIES = [
  {
    name: 'Small Cottage',
    category: 'COTTAGE',
    size: 'SMALL',
    description: 'Small day-use cottage for families and small groups.',
    inventory_count: 5,
    price_min: 500,
    price_max: 500,
    active: 1,
    bookable: 1,
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Medium Cottage',
    category: 'COTTAGE',
    size: 'MEDIUM',
    description: 'Medium cottage currently unavailable for reservations.',
    inventory_count: 0,
    price_min: null,
    price_max: null,
    active: 0,
    bookable: 0,
    unavailable_reason: 'Currently unavailable',
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Large Cottage',
    category: 'COTTAGE',
    size: 'LARGE',
    description: 'Large cottage for bigger day-use gatherings.',
    inventory_count: 4,
    price_min: 1000,
    price_max: 1500,
    active: 1,
    bookable: 1,
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Extra Large Cottage',
    category: 'COTTAGE',
    size: 'EXTRA_LARGE',
    description: 'Extra large cottage for large groups.',
    inventory_count: 1,
    price_min: 2000,
    price_max: 2000,
    active: 1,
    bookable: 1,
    rental_type: 'FIXED',
    image_url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Small Room/Cabana',
    category: 'CABANA',
    size: 'SMALL',
    description: 'Small room/cabana for 2 to 6 guests.',
    inventory_count: 2,
    capacity_min: 2,
    capacity_max: 6,
    price_min: 1200,
    price_max: 1500,
    day_rate_min: 1200,
    day_rate_max: 1500,
    night_surcharge_min: 200,
    night_surcharge_max: 500,
    active: 1,
    bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Medium Room/Cabana',
    category: 'CABANA',
    size: 'MEDIUM',
    description: 'Medium room/cabana for 6 to 8 guests.',
    inventory_count: 4,
    capacity_min: 6,
    capacity_max: 8,
    price_min: 1700,
    price_max: 1700,
    day_rate_min: 1700,
    day_rate_max: 1700,
    night_surcharge_min: 200,
    night_surcharge_max: 500,
    active: 1,
    bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1515362778563-6a8d0e44bc0b?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Large Room/Cabana',
    category: 'CABANA',
    size: 'LARGE',
    description: 'Large room/cabana for up to 12 guests.',
    inventory_count: 1,
    capacity_min: 1,
    capacity_max: 12,
    price_min: 3000,
    price_max: 3000,
    day_rate_min: 3000,
    day_rate_max: 3000,
    night_surcharge_min: 200,
    night_surcharge_max: 500,
    active: 1,
    bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Extra Large Room/Cabana',
    category: 'CABANA',
    size: 'EXTRA_LARGE',
    description: 'Extra large room/cabana for 25 to 30 guests.',
    inventory_count: 1,
    capacity_min: 25,
    capacity_max: 30,
    price_min: 6000,
    price_max: 6000,
    day_rate_min: 6000,
    day_rate_max: 6000,
    night_surcharge_min: 200,
    night_surcharge_max: 500,
    active: 1,
    bookable: 1,
    rental_type: 'DAILY',
    image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Life Vest',
    category: 'BEACH_EQUIPMENT',
    size: null,
    description: 'Life vest rental for beach and water activities.',
    inventory_count: 20,
    price_min: 100,
    price_max: 500,
    hourly_rate: 100,
    daily_rate: 500,
    rental_type: 'HOURLY_OR_DAILY',
    active: 1,
    bookable: 1,
    restricted_during_peak_hours: 1,
    image_url: 'https://images.unsplash.com/photo-1562155847-c05f7386b174?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Boat',
    category: 'BEACH_EQUIPMENT',
    size: null,
    description: 'Boat rental for coastal recreation.',
    inventory_count: 5,
    price_min: 100,
    price_max: 500,
    hourly_rate: 100,
    daily_rate: 500,
    rental_type: 'HOURLY_OR_DAILY',
    active: 1,
    bookable: 1,
    restricted_during_peak_hours: 1,
    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Stand Paddle Boat',
    category: 'BEACH_EQUIPMENT',
    size: null,
    description: 'Stand paddle boat rental for beach activities.',
    inventory_count: 10,
    price_min: 100,
    price_max: 500,
    hourly_rate: 100,
    daily_rate: 500,
    rental_type: 'HOURLY_OR_DAILY',
    active: 1,
    bookable: 1,
    restricted_during_peak_hours: 1,
    image_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=80',
  },
];

const FIELDS = [
  'name', 'category', 'size', 'description', 'image_url', 'inventory_count',
  'capacity_min', 'capacity_max', 'price_min', 'price_max',
  'day_rate_min', 'day_rate_max', 'night_surcharge_min', 'night_surcharge_max',
  'hourly_rate', 'daily_rate', 'rental_type', 'active', 'bookable',
  'unavailable_reason', 'restricted_during_peak_hours',
];

function valuesFor(facility) {
  return FIELDS.map((field) => {
    if (field === 'restricted_during_peak_hours') return facility[field] ?? 0;
    if (field === 'active') return facility[field] ?? 1;
    if (field === 'bookable') return facility[field] ?? 1;
    return facility[field] ?? null;
  });
}

async function upsertFacility(conn, facility) {
  const [rows] = await conn.query(
    'SELECT id FROM facilities WHERE name = ? AND category = ? LIMIT 1',
    [facility.name, facility.category]
  );

  if (rows.length) {
    const assignments = FIELDS.filter((field) => field !== 'name' && field !== 'category')
      .map((field) => `${field} = ?`)
      .join(', ');
    const updateValues = FIELDS.filter((field) => field !== 'name' && field !== 'category')
      .map((field) => {
        if (field === 'restricted_during_peak_hours') return facility[field] ?? 0;
        if (field === 'active') return facility[field] ?? 1;
        if (field === 'bookable') return facility[field] ?? 1;
        return facility[field] ?? null;
      });
    await conn.query(
      `UPDATE facilities SET ${assignments}, deleted_at = NULL WHERE id = ?`,
      [...updateValues, rows[0].id]
    );
    return { id: rows[0].id, created: false };
  }

  const placeholders = FIELDS.map(() => '?').join(', ');
  const [result] = await conn.query(
    `INSERT INTO facilities (${FIELDS.join(', ')}) VALUES (${placeholders})`,
    valuesFor(facility)
  );
  return { id: result.insertId, created: true };
}

async function seed() {
  const conn = await mysql.createConnection(getConnectionOptions());
  console.log('Connected to database for seeding');

  await createOrUpdateAdminAccount(conn, { skipWhenMissing: true });

  let created = 0;
  let updated = 0;

  for (const facility of FACILITIES) {
    const result = await upsertFacility(conn, facility);
    if (result.created) created++;
    else updated++;
    console.log(`  ${result.created ? 'Created' : 'Updated'} facility: ${facility.name}`);
  }

  await conn.end();
  console.log(`Seeding complete. Created ${created}, updated ${updated}.`);
}

seed().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
