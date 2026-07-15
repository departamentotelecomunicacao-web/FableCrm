require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || '';
// Bancos gerenciados (Neon, Render, Supabase…) exigem SSL; local não usa.
const needsSSL = /sslmode=require|neon\.tech|render\.com|supabase\.co/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
