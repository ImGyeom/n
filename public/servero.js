import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
const app = express();
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCPbMnoaHE4JfvuX9GPC6TjysaCDIrpiso",
  authDomain: "roproxy-ae1ab.firebaseapp.com",
  projectId: "roproxy-ae1ab",
  storageBucket: "roproxy-ae1ab.firebasestorage.app",
  messagingSenderId: "880617669294",
  appId: "1:880617669294:web:d0bb63d40bda57938ee33f",
  measurementId: "G-9TJE9ZTR7Z"
};

// Initialize Firebase
const azpp = initializeApp(firebaseConfig);
const analytics = getAnalytics(azpp);

// Dapatkan __dirname untuk ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gunakan folder statis "public"
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// Konfigurasi Multer untuk upload file (misalnya profile picture)
const upload = multer({ dest: 'public/uploads/' });

// Ambil konfigurasi dari .env
const { DB_HOST, DB_USER, DB_PASS, DB_NAME, JWT_SECRET, BASE_URL, PORT } = process.env;
const port = PORT || 3000;

// Konfigurasi database
const dbConfig = { host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME };

// Inisialisasi Database (membuat DB & tabel jika belum ada)
async function initDB() {
  // Buat database jika belum ada
  const conn1 = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS });
  await conn1.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  conn1.end();

  const conn2 = await mysql.createConnection(dbConfig);
  // Tabel users
  await conn2.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      profile_pic VARCHAR(255),
      last_login TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Tabel webhooks (dengan kolom note)
  await conn2.execute(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id VARCHAR(36) PRIMARY KEY,
      url TEXT NOT NULL,
      creator_id INT NOT NULL,
      note TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      request_count INT DEFAULT 0,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `);
  // Buat default admin jika belum ada
  const [admin] = await conn2.execute('SELECT * FROM users WHERE username = "admin"');
  if (admin.length === 0) {
    const hashedPass = await bcrypt.hash('admin123', 10);
    await conn2.execute('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPass]);
    console.log('Default admin user created');
  }
  conn2.end();
}
initDB();

// Middleware autentikasi (JWT)
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Fungsi validasi payload (menggunakan kode yang Anda berikan)
const validatePayload = (payload) => {
  const expectedKeys = [
    "content",
    "embeds",
    "username",
    "avatar_url",
    "attachments"
  ];

  // Pastikan semua kunci utama ada
  for (const key of expectedKeys) {
    if (!(key in payload)) {
      return false;
    }
  }

  // Validasi embeds
  if (!Array.isArray(payload.embeds) || payload.embeds.length !== 1) {
    return false;
  }

  const embed = payload.embeds[0];
  const embedKeys = ["description", "color", "fields", "author", "footer", "thumbnail"];
  for (const key of embedKeys) {
    if (!(key in embed)) {
      return false;
    }
  }

  // Validasi fields dalam embed
  if (!Array.isArray(embed.fields) || embed.fields.length === 0) {
    return false;
  }

  const fieldKeys = ["name", "value", "inline"];
  for (const field of embed.fields) {
    for (const key of fieldKeys) {
      if (!(key in field)) {
        return false;
      }
    }
  }

  // Jika semua validasi lolos
  return true;
};

// (1) Login Endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
    conn.end();
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    // Update last_login
    const conn2 = await mysql.createConnection(dbConfig);
    await conn2.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    conn2.end();
    res.json({
      token,
      profile: {
        id: user.id,
        username: user.username,
        profile_pic: user.profile_pic,
        last_login: user.last_login
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// (2) Generate Secure Link
app.post('/webhooks', authenticate, async (req, res) => {
  const { url } = req.body;
  const userId = req.user.id;
  if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).json({ error: 'Invalid Discord webhook URL' });
  }
  try {
    const id = crypto.randomUUID();
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('INSERT INTO webhooks (id, url, creator_id) VALUES (?, ?, ?)', [id, url, userId]);
    conn.end();
    const secured_url = `${BASE_URL}/api/${id}`;
    res.json({
      success: true,
      id,
      secured_url,
      original_url: url,
      message: 'Secure link created'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// (3) Stats Endpoint
app.get('/stats', authenticate, async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [webhooks] = await conn.execute(`
      SELECT
        w.id,
        CONCAT('${BASE_URL}/api/', w.id) AS secured_url,
        w.url AS original_url,
        w.note AS note,
        (SELECT username FROM users WHERE id = w.creator_id) AS creator,
        w.created_at,
        w.request_count
      FROM webhooks w
      ORDER BY w.created_at DESC
    `);
    conn.end();
    res.json({
      success: true,
      webhooks: webhooks.map(wh => ({
        ...wh,
        created_at: new Date(wh.created_at).toLocaleString()
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// (3B) Chart Data Endpoint
app.get('/chart-data', authenticate, async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(`
      SELECT
        DATE_FORMAT(created_at, '%b %Y') as label,
        SUM(request_count) as total
      FROM webhooks
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY MIN(created_at)
    `);
    conn.end();
    const labels = rows.map(r => r.label);
    const data = rows.map(r => r.total);
    res.json({ success: true, labels, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

// (4) Upload Profile Endpoint
app.post('/upload', authenticate, upload.single('profile'), async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('UPDATE users SET profile_pic = ? WHERE id = ?', [req.file.filename, req.user.id]);
    conn.end();
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// (5) Proxy Endpoint dengan validasi payload menggunakan validatePayload
app.post('/api/:id', async (req, res) => {
  if (!req.headers['content-type'] || req.headers['content-type'].toLowerCase() !== 'application/json') {
    return res.status(400).json({ error: 'Invalid Content-Type header' });
  }
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Nice Try, But You cant 🫨🤏' });
  }
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [webhooks] = await conn.execute('SELECT url FROM webhooks WHERE id = ?', [req.params.id]);
    if (!webhooks.length) {
      conn.end();
      return res.status(404).json({ error: 'Webhook not found' });
    }
    // Increment request_count
    await conn.execute('UPDATE webhooks SET request_count = request_count + 1 WHERE id = ?', [req.params.id]);
    conn.end();
    // Forward request ke Discord
    const response = await fetch(webhooks[0].url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    res.status(response.status).send(await response.text());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// (6) Delete Webhook: Hapus dari Discord dan DB
app.delete('/webhooks', authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Webhook URL is required' });
  try {
    const conn = await mysql.createConnection(dbConfig);
    // Cari data di DB via URL
    const [rows] = await conn.execute('SELECT * FROM webhooks WHERE url = ?', [url]);
    if (!rows.length) {
      conn.end();
      return res.status(404).json({ error: 'Webhook not found in DB' });
    }
    // Hapus di Discord
    const delResp = await fetch(url, { method: 'DELETE' });
    if (!delResp.ok && delResp.status !== 204) {
      console.log(`Discord delete might have failed. Status: ${delResp.status}`);
    }
    // Hapus di DB
    await conn.execute('DELETE FROM webhooks WHERE url = ?', [url]);
    conn.end();
    return res.json({ success: true, message: 'Webhook deleted in DB & from Discord' });
  } catch (err) {
    console.error('Delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete from DB/Discord' });
  }
});

// (7) Edit Webhook (PATCH /webhooks/:oldId)
// Update original URL, secure link (id), dan note.
app.patch('/webhooks/:oldId', authenticate, async (req, res) => {
  const { oldId } = req.params;
  const { newUrl, newId, newNote } = req.body;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM webhooks WHERE id = ?', [oldId]);
    if (!rows.length) {
      conn.end();
      return res.status(404).json({ error: 'Webhook not found' });
    }
    let query = 'UPDATE webhooks SET ';
    const params = [];
    const setClauses = [];
    if (newUrl) {
      setClauses.push('url = ?');
      params.push(newUrl);
    }
    if (newId) {
      setClauses.push('id = ?');
      params.push(newId);
    }
    if (typeof newNote !== 'undefined') {
      setClauses.push('note = ?');
      params.push(newNote);
    }
    if (!setClauses.length) {
      conn.end();
      return res.status(400).json({ error: 'No fields to update' });
    }
    query += setClauses.join(', ');
    query += ' WHERE id = ?';
    params.push(oldId);
    const [result] = await conn.execute(query, params);
    conn.end();
    if (result.affectedRows > 0) {
      return res.json({ success: true, message: 'Webhook updated successfully' });
    } else {
      return res.status(404).json({ error: 'Failed to update (not found or conflict)' });
    }
  } catch (err) {
    console.error('Edit webhook error:', err.message);
    res.status(500).json({ error: 'Failed to edit webhook' });
  }
});

// Serve halaman statis
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`DB: ${DB_NAME} | HOST: ${DB_HOST} | USER: ${DB_USER}`);
});
