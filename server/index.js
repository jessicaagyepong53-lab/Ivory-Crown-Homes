import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRouter        from './routes/auth.js';
import blocksRouter      from './routes/blocks.js';
import maintenanceRouter from './routes/maintenance.js';
import documentsRouter   from './routes/documents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST      = path.join(__dirname, '..', 'dist');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', authRouter);
app.use('/api', blocksRouter);
app.use('/api', maintenanceRouter);
app.use('/api', documentsRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

// ── Serve React frontend ──────────────────────────────────────────────────────
import { existsSync } from 'fs';
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}\n   ➜  Local:   http://localhost:${PORT}/`));
}).catch(err => {
  console.error('❌ DB connection failed:', err.message);
  process.exit(1);
});
