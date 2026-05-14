/**
 * Shared MySQL connection options for CLI scripts (migrate, seed).
 * Uses MYSQL_* environment variables and supports Aiven SSL CA.
 *
 * NOTE: The application pool lives in src/config/db.js.
 *       This file is only for one-shot CLI connections.
 */
require('dotenv').config();

function getConnectionOptions(extra = {}) {
  return {
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    // Aiven requires a CA certificate passed as a PEM string.
    // Store the cert in MYSQL_SSL_CA with literal \n for newlines;
    // we convert them back here before passing to mysql2.
    ssl: process.env.MYSQL_SSL_CA
      ? { ca: process.env.MYSQL_SSL_CA.replace(/\\n/g, '\n') }
      : undefined,
    ...extra,
  };
}

module.exports = { getConnectionOptions };
