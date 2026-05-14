require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { getConnectionOptions } = require('./db-config');

// ─── Mamagan Resort — seed facilities ────────────────────────────────────────
const FACILITIES = [
  {
    name: 'Beachfront Event Pavilion',
    description:
      'Open-air pavilion with panoramic ocean views. Ideal for weddings, receptions, and corporate events. Accommodates up to 300 guests with full lighting and sound setup.',
    capacity: 300,
    price_per_hour: 2500.00,
    image_url: 'https://placehold.co/600x400?text=Beachfront+Pavilion',
  },
  {
    name: 'Infinity Swimming Pool',
    description:
      'Resort-style infinity pool overlooking the sea. Includes poolside lounge chairs, cabanas, and an attendant on duty. Available for private hire.',
    capacity: 60,
    price_per_hour: 800.00,
    image_url: 'https://placehold.co/600x400?text=Infinity+Pool',
  },
  {
    name: 'Nipa Cottage (Kubo)',
    description:
      'Traditional Filipino nipa hut perfect for small family gatherings, day trips, and picnics. Includes table, chairs, and fan. Located steps from the shoreline.',
    capacity: 10,
    price_per_hour: 250.00,
    image_url: 'https://placehold.co/600x400?text=Nipa+Cottage',
  },
  {
    name: 'Multi-Purpose Sports Court',
    description:
      'Outdoor hard-surface court with night lighting. Suitable for basketball, volleyball, and badminton. Equipment rental available upon request.',
    capacity: 30,
    price_per_hour: 300.00,
    image_url: 'https://placehold.co/600x400?text=Sports+Court',
  },
  {
    name: 'Lakbay Conference Room',
    description:
      'Air-conditioned indoor conference room with projector, whiteboard, and high-speed Wi-Fi. Ideal for business meetings, seminars, and team workshops.',
    capacity: 50,
    price_per_hour: 600.00,
    image_url: 'https://placehold.co/600x400?text=Conference+Room',
  },
  {
    name: 'Water Activities Area',
    description:
      'Dedicated zone for water sports including kayaking, snorkeling, and banana boat rides. Trained staff and safety equipment provided. Subject to weather conditions.',
    capacity: 20,
    price_per_hour: 500.00,
    image_url: 'https://placehold.co/600x400?text=Water+Activities',
  },
];

async function seed() {
  const conn = await mysql.createConnection(getConnectionOptions());
  console.log('✅ Connected to database for seeding\n');

  // ─── Admin user ─────────────────────────────────────────────────────────────
  await seedAdmin(conn);

  // ─── Facilities ──────────────────────────────────────────────────────────────
  await seedFacilities(conn);

  await conn.end();
  console.log('\n✅ Seeding complete.');
}

async function seedAdmin(conn) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('  ⚠  ADMIN_EMAIL or ADMIN_PASSWORD not set in .env — skipping admin seed.');
    return;
  }

  const [existing] = await conn.query(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existing.length > 0) {
    console.log('  ⏭  Admin user already exists, skipping:', email);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await conn.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    ['Administrator', email, hashed, 'admin']
  );
  console.log('  ✅ Admin user created:', email);
}

async function seedFacilities(conn) {
  // Guard: check that the facilities table exists before trying to seed it
  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'facilities'`,
    [process.env.MYSQL_DATABASE]
  );

  if (tables.length === 0) {
    console.warn('  ⚠  facilities table does not exist — run db:migrate first.');
    return;
  }

  let added = 0;
  for (const f of FACILITIES) {
    const [exists] = await conn.query(
      'SELECT id FROM facilities WHERE name = ?',
      [f.name]
    );

    if (exists.length > 0) {
      console.log('  ⏭  Facility exists, skipping:', f.name);
      continue;
    }

    await conn.query(
      `INSERT INTO facilities (name, description, capacity, price_per_hour, image_url)
       VALUES (?, ?, ?, ?, ?)`,
      [f.name, f.description, f.capacity, f.price_per_hour, f.image_url]
    );
    console.log('  ✅ Facility added:', f.name);
    added++;
  }

  if (added === 0) {
    console.log('  ℹ  All facilities already seeded.');
  }
}

seed().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
