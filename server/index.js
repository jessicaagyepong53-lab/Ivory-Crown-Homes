import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';
import authRouter        from './routes/auth.js';
import blocksRouter      from './routes/blocks.js';
import maintenanceRouter from './routes/maintenance.js';
import documentsRouter   from './routes/documents.js';
import trashRouter       from './routes/trash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST      = path.join(__dirname, '..', 'dist');

// ── Startup sanity checks ─────────────────────────────────────────────────────
// Fail fast and loud instead of booting into a broken state (e.g. every JWT
// operation silently throwing once a real request comes in).
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('   Set these in your .env file (see README.md) before starting the server.');
  process.exit(1);
}

const app    = express();
const server = http.createServer(app);
initSocket(server);
const PORT = process.env.PORT || 5000;

// ── Trust Render / Vercel proxy (required for express-rate-limit on deployment)
app.set('trust proxy', 1);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', authRouter);
app.use('/api', blocksRouter);
app.use('/api', maintenanceRouter);
app.use('/api', documentsRouter);
app.use('/api', trashRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

// ── Serve React frontend ──────────────────────────────────────────────────────
import { existsSync } from 'fs';
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ── Global error handler ─────────────────────────────────────────────────────
// Every route funnels unexpected errors here via next(err) or an uncaught
// throw. This translates common error shapes into clean, consistent
// { error: "message" } JSON with the right status code, instead of leaking
// stack traces or defaulting everything to a bare 500.
app.use((err, req, res, _next) => {
  // Our own deliberately-thrown validation errors (see utils/validators.js)
  if (err.name === 'AppError') {
    return res.status(err.status || 400).json({ error: err.message });
  }

  // Mongoose CastError — malformed ObjectId in a URL param or body field
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path || 'value'}: "${err.value}".` });
  }

  // Mongoose schema validation failure (e.g. a required field missing on .save())
  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(' ') });
  }

  // Duplicate key (unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ error: `That ${field} is already in use.` });
  }

  // Malformed JSON in the request body (express.json() parse failure)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }

  // Multer upload errors (file too large, too many files, wrong field name)
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }

  // Fallback — unexpected error, log full detail server-side only
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
connectDB(process.env.MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}\n   ➜  Local:   http://localhost:${PORT}/`));
}).catch(err => {
  console.error('❌ DB connection failed:', err.message);
  process.exit(1);
});