import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Settings from '../models/Settings.js';
import { verifyJWT, verifyAdminOrPinReset } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { AppError, requirePin, requireNonEmptyString } from '../utils/validators.js';

const router = express.Router();

const MAX_ATTEMPTS = 3;

// PIN login lockout escalates: first offense 15 min, any repeat offense
// (without a successful login resetting things in between) is a full day.
// Index is capped at the last entry, so it never grows past 24h.
const LOGIN_LOCK_DURATIONS = [15 * 60 * 1000, 24 * 60 * 60 * 1000];

// Security-answer (PIN recovery) lockout stays flat — this is the escape
// hatch, and locking it for a day too would leave a legitimate owner with
// no way back in until tomorrow.
const ANSWER_LOCK_MS = 15 * 60 * 1000;

const RESET_TOKEN_EXPIRES = '10m'; // window to actually set the new PIN after answering

function formatDuration(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function lockoutError(setting) {
  const msLeft = Math.max(60000, setting.lockedUntil - new Date());
  return new AppError(`Too many incorrect attempts. Try again in ${formatDuration(msLeft)}.`, 429);
}

// Registers one failed PIN-login attempt. On hitting MAX_ATTEMPTS, locks
// using the escalating duration and bumps lockLevel for next time.
async function registerLoginFailure(setting) {
  setting.failedAttempts = (setting.failedAttempts || 0) + 1;
  if (setting.failedAttempts >= MAX_ATTEMPTS) {
    const level = Math.min(setting.lockLevel || 0, LOGIN_LOCK_DURATIONS.length - 1);
    const duration = LOGIN_LOCK_DURATIONS[level];
    setting.lockedUntil    = new Date(Date.now() + duration);
    setting.lockLevel      = Math.min((setting.lockLevel || 0) + 1, LOGIN_LOCK_DURATIONS.length - 1);
    setting.failedAttempts = 0;
    await setting.save();
    throw new AppError(`Too many incorrect attempts. Try again in ${formatDuration(duration)}.`, 429);
  }
  await setting.save();
  const remaining = MAX_ATTEMPTS - setting.failedAttempts;
  throw new AppError(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left before lockout.`, 401);
}

// Registers one failed security-answer attempt. Always a flat 15-minute lock.
async function registerAnswerFailure(setting) {
  setting.failedAttempts = (setting.failedAttempts || 0) + 1;
  if (setting.failedAttempts >= MAX_ATTEMPTS) {
    setting.lockedUntil    = new Date(Date.now() + ANSWER_LOCK_MS);
    setting.failedAttempts = 0;
    await setting.save();
    throw new AppError(`Too many incorrect attempts. Try again in ${formatDuration(ANSWER_LOCK_MS)}.`, 429);
  }
  await setting.save();
  const remaining = MAX_ATTEMPTS - setting.failedAttempts;
  throw new AppError(`Incorrect answer. ${remaining} attempt${remaining === 1 ? '' : 's'} left before lockout.`, 401);
}

// ── PIN login ────────────────────────────────────────────────────────────────
// POST /api/auth/login — verify PIN, return JWT.
// 3 wrong PINs → 15 min lock. A second lockout (without a successful login
// in between) → 24 hours.
router.post('/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const pin = requirePin(req.body.pin);

    const setting = await Settings.findOne({ key: 'pin' });
    if (!setting) throw new AppError('PIN not configured on this server.', 500);

    if (setting.lockedUntil && setting.lockedUntil > new Date()) {
      throw lockoutError(setting);
    }

    const match = await bcrypt.compare(pin, setting.value);
    if (!match) {
      await registerLoginFailure(setting);
    }

    // Success — clear failed attempts AND the escalation level. A correct
    // login is proof of legitimate ownership, so we don't keep punishing
    // them for an unrelated lockout that happened hours/days ago.
    setting.failedAttempts = 0;
    setting.lockedUntil    = null;
    setting.lockLevel      = 0;
    await setting.save();

    if (!process.env.JWT_SECRET) throw new AppError('Server is misconfigured (missing JWT secret).', 500);

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

// ── Security question ──────────────────────────────────────────────────────

// GET /api/auth/security-question — public, returns question TEXT ONLY (no answer)
router.get('/auth/security-question', async (req, res, next) => {
  try {
    const setting = await Settings.findOne({ key: 'security' });
    if (!setting || !setting.question) {
      throw new AppError('No security question has been set up yet.', 404);
    }
    res.json({ question: setting.question });
  } catch (err) { next(err); }
});

// POST /api/auth/security-question — set/update the question + answer.
// Requires an already-authenticated admin session.
router.post('/auth/security-question', verifyJWT, async (req, res, next) => {
  try {
    const question = requireNonEmptyString(req.body.question, 'Question');
    const answer   = requireNonEmptyString(req.body.answer, 'Answer');

    const hashed = await bcrypt.hash(answer.toLowerCase(), 12);
    await Settings.findOneAndUpdate(
      { key: 'security' },
      { value: hashed, question, failedAttempts: 0, lockedUntil: null },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/security-answer — verify answer, issue a short-lived
// PIN-reset token (NOT a normal admin token). Flat 15-min lockout after
// 3 wrong answers — deliberately NOT escalating, this is the recovery path.
router.post('/auth/security-answer', loginLimiter, async (req, res, next) => {
  try {
    const answer = requireNonEmptyString(req.body.answer, 'Answer');

    const setting = await Settings.findOne({ key: 'security' });
    if (!setting) throw new AppError('No security question has been set up yet.', 404);

    if (setting.lockedUntil && setting.lockedUntil > new Date()) {
      throw lockoutError(setting);
    }

    const match = await bcrypt.compare(answer.toLowerCase(), setting.value);
    if (!match) {
      await registerAnswerFailure(setting);
    }

    setting.failedAttempts = 0;
    setting.lockedUntil    = null;
    await setting.save();

    if (!process.env.JWT_SECRET) throw new AppError('Server is misconfigured (missing JWT secret).', 500);

    const resetToken = jwt.sign({ role: 'pin-reset' }, process.env.JWT_SECRET, {
      expiresIn: RESET_TOKEN_EXPIRES,
    });
    res.json({ resetToken });
  } catch (err) { next(err); }
});

// ── Change PIN ───────────────────────────────────────────────────────────────
// PUT /api/auth/pin — requires EITHER a live admin session OR a valid
// pin-reset token from /auth/security-answer. Also clears any escalation
// level on the PIN itself, since it's now a brand new PIN.
router.put('/auth/pin', verifyAdminOrPinReset, async (req, res, next) => {
  try {
    const pin = requirePin(req.body.pin);
    const hashed = await bcrypt.hash(pin, 12);
    await Settings.findOneAndUpdate(
      { key: 'pin' },
      { value: hashed, failedAttempts: 0, lockedUntil: null, lockLevel: 0 },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;