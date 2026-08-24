import mongoose from 'mongoose';

// Key-value store for app settings.
// Two documents use this collection:
//   { key: 'pin',      value: <bcrypt hash of PIN> }
//   { key: 'security', value: <bcrypt hash of answer>, question: <text> }
// failedAttempts / lockedUntil are tracked per-document so PIN attempts
// and security-answer attempts are locked out independently.
// lockLevel escalates lockout duration on the 'pin' document only: the
// first lockout is short (15 min), a repeat lockout without a successful
// login in between is a full day. See LOGIN_LOCK_DURATIONS in
// routes/auth.js. The 'security' document ignores lockLevel and always
// uses a flat 15-minute lockout, so PIN recovery never gets locked out
// for a whole day too.
const SettingsSchema = new mongoose.Schema({
  key:            { type: String, unique: true, required: true },
  value:          { type: String, required: true },
  question:       { type: String, default: '' },   // only used for key:'security'
  failedAttempts: { type: Number, default: 0 },
  lockedUntil:    { type: Date,   default: null },
  lockLevel:      { type: Number, default: 0 },     // escalation counter (pin doc only)
});

export default mongoose.model('Settings', SettingsSchema);