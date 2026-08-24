import mongoose from 'mongoose';

// ── AppError ─────────────────────────────────────────────────────────────────
// Throw this from anywhere in a route handler for a *known, expected* problem
// (bad input, missing field, wrong format). The global error handler in
// index.js turns it into a clean { error: message } response at the given
// status code — no stack trace leaks, no generic 500.
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

// ── Validators ───────────────────────────────────────────────────────────────
// Each `requireX` throws an AppError with a clear message if the value is
// invalid, and otherwise returns the (possibly normalised) value — so you can
// use them either as guards or as parse-and-validate in one line.

export function isValidObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

export function requireObjectId(id, label = 'ID') {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label} format.`);
  }
  return id;
}

export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4,8}$/.test(pin);
}

export function requirePin(pin, label = 'PIN') {
  if (!isValidPin(pin)) {
    throw new AppError(`${label} must be 4–8 digits (numbers only).`);
  }
  return pin;
}

export function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${label} is required.`);
  }
  return value.trim();
}

export function requirePositiveNumber(value, label) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new AppError(`${label} must be a positive number.`);
  }
  return n;
}

export function requireDateString(value, label) {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw new AppError(`${label} must be a valid date.`);
  }
  return value;
}

export function requireOneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new AppError(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

export function requireObjectIdArray(ids, label = 'IDs') {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError(`${label} must be a non-empty array.`);
  }
  for (const id of ids) {
    if (!isValidObjectId(id)) {
      throw new AppError(`Invalid ${label} entry: "${id}".`);
    }
  }
  return ids;
}