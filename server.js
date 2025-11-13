// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser'; // optional, kept for compatibility
import {
  getMatches,
  createMatch,
  getUserMatches,
  acceptMatch,
  rejectMatch,
  createFeedback
} from './controllers/matchController.js';

const app = express();

// ---- middleware ----
app.use(cors());
app.use(express.json()); // parse application/json
app.use(express.urlencoded({ extended: true })); // parse form data
// (you can remove bodyParser if not needed)
// app.use(bodyParser.json());

// ---- supabase client (server-side) ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in env');
  process.exit(1);
}
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Middleware: verify Supabase access token from Authorization: Bearer <token>
 * - uses supabaseAdmin.auth.getUser(token)
 * - on success: attaches req.user
 */
async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }
    const token = parts[1];

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user; // { id, email, ... }
    next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(500).json({ error: 'Auth error' });
  }
}

// ---- routes ----
// public read endpoint for candidate suggestions
app.get('/match', getMatches);

// routes that should be authenticated (mutations / user-specific)
app.post('/matches', requireAuth, createMatch);
app.get('/matches', requireAuth, getUserMatches);
app.patch('/matches/:id/accept', requireAuth, acceptMatch);
app.patch('/matches/:id/reject', requireAuth, rejectMatch);
app.post('/feedbacks', requireAuth, createFeedback);

// health
app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
