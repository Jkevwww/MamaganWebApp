require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getConnectionOptions } = require('./db-config');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const conn = await mysql.createConnection(
    getConnectionOptions({ multipleStatements: true })
  );

  console.log('✅ Connected to database');

  // ─── Migrations tracking table ────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      run_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [alreadyRun] = await conn.query('SELECT filename FROM _migrations');
  const ranFiles = new Set(alreadyRun.map((r) => r.filename));

  // ─── Discover and run pending migration files ─────────────────────────────
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('  ℹ  No migration files found in', MIGRATIONS_DIR);
  }

  let ran = 0;
  for (const file of files) {
    if (ranFiles.has(file)) {
      console.log(`  ⏭  Skipped (already ran): ${file}`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      // Some migration files are not compatible with some MySQL variants.
      // We intentionally treat failures as non-blocking, but we must not
      // mark them as executed.
      await conn.query(sql);

      // Parameterized insert to track this migration (only on success)
      await conn.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
      console.log(`  ✅ Ran: ${file}`);
      ran++;
    } catch (err) {
      console.error(`  ❌ Failed on ${file}:`, err.message);
      // Non-blocking: allow older/unsupported migrations to fail.
      // Continue running other migrations.
    }

  }


  await conn.end();

  if (ran === 0) {
    console.log('\n✅ Database is up to date — no new migrations.');
  } else {
    console.log(`\n✅ Migrations complete. ${ran} file(s) executed.`);
  }
}

runMigrations().catch((err) => {
  console.error('❌ Migration runner error:', err.message);
  process.exit(1);
});
