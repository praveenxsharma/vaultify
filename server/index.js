// server/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

// Basic health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Register (store hashed auth_verifier + salts + empty vault)
app.post('/api/register', async (req, res) => {
  try {
    const { email, auth_verifier, auth_salt, kdf_params } = req.body;
    if (!email || !auth_verifier || !auth_salt) return res.status(400).json({ error: 'missing fields' });

    // Hash the verifier server-side for extra hardening
    const hashed = await bcrypt.hash(auth_verifier, 12);

    await pool.query(
      `INSERT INTO users (email, auth_verifier, auth_salt, kdf_params)
       VALUES ($1,$2,$3,$4)`,
      [email, hashed, Buffer.from(auth_salt, 'base64'), kdf_params || {}]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
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
    console.error(err);
    res.status(500).json({ error: 'server error' });
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
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Save/update vault (again - in prod use secure sessions/JWT auth)
app.post('/api/vault/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { vault_blob, vault_iv, kdf_params } = req.body;
    await pool.query(
      `UPDATE users SET vault_blob=$1, vault_iv=$2, kdf_params=$3, updated_at=now() WHERE id=$4`,
      [vault_blob, vault_iv, kdf_params || {}, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => console.log(`server listening on ${PORT}`));

