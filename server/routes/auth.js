import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Settings from '../models/Settings.js';
import { verifyJWT } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// POST /api/auth/login — verify PIN, return JWT
router.post('/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN format' });
    }
    const setting = await Settings.findOne({ key: 'pin' });
    if (!setting) return res.status(500).json({ error: 'PIN not configured' });
    const match = await bcrypt.compare(pin, setting.value);
    if (!match) return res.status(401).json({ error: 'Incorrect PIN' });
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });
    res.json({ token });
  } catch (err) { next(err); }
});

// GET /api/auth/verify — check if JWT is still valid
router.get('/auth/verify', verifyJWT, (req, res) => {
  res.json({ ok: true });
});

// PUT /api/auth/pin — change PIN (no auth required — Settings page acts as reset)
router.put('/auth/pin', async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4–8 digits' });
    }
    const hashed = await bcrypt.hash(pin, 12);
    await Settings.findOneAndUpdate(
      { key: 'pin' },
      { value: hashed },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
