import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRouter        from './routes/auth.js';
import blocksRouter      from './routes/blocks.js';
import maintenanceRouter from './routes/maintenance.js';
import documentsRouter   from './routes/documents.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', authRouter);
app.use('/api', blocksRouter);
app.use('/api', maintenanceRouter);
app.use('/api', documentsRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => {
  console.error('❌ DB connection failed:', err.message);
  process.exit(1);
});
