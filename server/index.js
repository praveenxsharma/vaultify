// server/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { Pool } = require('pg');
const { Buffer } = require('buffer');

const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL || '';
const isProd = process.env.NODE_ENV === 'production';

// Use SSL in production for managed DBs (Render / Heroku / Supabase, etc.)
// rejectUnauthorized:false allows TLS without providing CA in the container.
// For stricter security, provide the CA and set rejectUnauthorized: true.
const pool = new Pool({
  connectionString,
  ssl: isProd ? { rejectUnauthorized: false } : false,
});

const app = express();

// CORS: allow specific origin in production via ALLOWED_ORIGIN, otherwise allow all (dev)
const allowedOrigin = process.env.ALLOWED_ORIGIN || true;
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use(bodyParser.json());

// Basic health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Register (store hashed auth_verifier + salts + empty vault)
app.post('/api/register', async (req, res) => {
  try {
    const { email, auth_verifier, auth_salt, kdf_params } = req.body;
    if (!email || !auth_verifier || !auth_salt) {
      return res.status(400).json({ error: 'missing fields' });
    }

    // Hash the verifier server-side for extra hardening
    const hashed = await bcrypt.hash(auth_verifier, 12);

    const insertQuery = `
      INSERT INTO users (email, auth_verifier, auth_salt, kdf_params)
      VALUES ($1, $2, $3, $4::jsonb)
    `;
    const values = [
      email,
      hashed,
      Buffer.from(auth_salt, 'base64'),
      JSON.stringify(kdf_params || {})
    ];

    await pool.query(insertQuery, values);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/register error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Login (compare provided verifier to stored hashed verifier)
app.post('/api/login', async (req, res) => {
  try {
    const { email, auth_verifier } = req.body;
    if (!email || !auth_verifier) return res.status(400).json({ error: 'missing' });

    const r = await pool.query('SELECT id, auth_verifier FROM users WHERE email=$1', [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'invalid' });

    const user = r.rows[0];
    const ok = await bcrypt.compare(auth_verifier, user.auth_verifier);
    if (!ok) return res.status(401).json({ error: 'invalid' });

    // For now, return a simple success. Replace with JWT/session later.
    res.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error('POST /api/login error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Robust auth_salt endpoint
app.get('/api/auth_salt', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'missing email' });

    const r = await pool.query('SELECT auth_salt, kdf_params FROM users WHERE email=$1', [email]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'user not found' });

    const row = r.rows[0];

    if (!row.auth_salt) {
      return res.status(404).json({ error: 'auth_salt not found for user' });
    }

    const saltB64 = Buffer.from(row.auth_salt).toString('base64');
    return res.json({ auth_salt: saltB64, kdf_params: row.kdf_params || {} });
  } catch (err) {
    console.error('GET /api/auth_salt error:', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Get vault for a user (requires a real auth middleware; simple param for scaffold)
app.get('/api/vault/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const r = await pool.query('SELECT vault_blob, vault_iv, kdf_params FROM users WHERE id=$1', [userId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('GET /api/vault/:userId error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Save/update vault (again - in prod use secure sessions/JWT auth)
app.post('/api/vault/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { vault_blob, vault_iv, kdf_params } = req.body;

    if (!userId) return res.status(400).json({ error: 'missing userId param' });
    if (!vault_blob || !vault_iv) return res.status(400).json({ error: 'missing vault_blob or vault_iv' });

    const q = `
      UPDATE users
      SET vault_blob = $1,
          vault_iv = $2,
          kdf_params = $3::jsonb,
          updated_at = now()
      WHERE id = $4
      RETURNING id;
    `;
    const values = [vault_blob, vault_iv, JSON.stringify(kdf_params || {}), userId];

    const result = await pool.query(q, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'user not found' });

    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/vault/:userId error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

app.listen(PORT, () => console.log(`server listening on ${PORT}`));

