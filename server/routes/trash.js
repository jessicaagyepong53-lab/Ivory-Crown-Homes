import express from 'express';
import mongoose from 'mongoose';
import Trash from '../models/Trash.js';
import Block from '../models/Block.js';
import cloudinary from '../config/cloudinary.js';
import { verifyJWT } from '../middleware/auth.js';
import { broadcast } from '../socket.js';

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function purgeCloudinary(type, data) {
  let ids = [];
  if (type === 'block') {
    ids = (data.units || [])
      .flatMap(u => (u.tenants || []).flatMap(t => (t.documents || []).map(d => d.cloudinaryId)))
      .filter(Boolean);
  } else if (type === 'unit') {
    ids = (data.tenants || [])
      .flatMap(t => (t.documents || []).map(d => d.cloudinaryId))
      .filter(Boolean);
  } else if (type === 'tenant') {
    ids = (data.documents || []).map(d => d.cloudinaryId).filter(Boolean);
  }
  if (ids.length) {
    try { await cloudinary.api.delete_resources(ids); } catch { /* ignore */ }
  }
}

async function restoreOne(item) {
  if (item.type === 'block') {
    // Raw insert to preserve every nested _id
    await Block.collection.insertOne(item.data);
  } else if (item.type === 'unit') {
    const block = await Block.findById(item.parentBlockId);
    if (!block) throw Object.assign(new Error('Parent block no longer exists'), { status: 404 });
    await Block.updateOne({ _id: block._id }, { $push: { units: item.data } });
  } else if (item.type === 'tenant') {
    const block = await Block.findById(item.parentBlockId);
    if (!block) throw Object.assign(new Error('Parent block no longer exists'), { status: 404 });
    const unit = block.units.id(item.parentUnitId);
    if (!unit) throw Object.assign(new Error('Parent unit no longer exists'), { status: 404 });
    await Block.updateOne(
      { _id: block._id, 'units._id': new mongoose.Types.ObjectId(item.parentUnitId) },
      { $push: { 'units.$.tenants': item.data } }
    );
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/trash — auto-purges expired items first
router.get('/trash', verifyJWT, async (req, res, next) => {
  try {
    const now = new Date();
    const expired = await Trash.find({ expiresAt: { $lt: now } });
    for (const item of expired) await purgeCloudinary(item.type, item.data);
    if (expired.length) await Trash.deleteMany({ expiresAt: { $lt: now } });
    const items = await Trash.find().sort({ deletedAt: -1 });
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/trash/restore — bulk restore (must come BEFORE /:id routes)
router.post('/trash/restore', verifyJWT, async (req, res, next) => {
  try {
    const { ids } = req.body;
    const items = await Trash.find({ _id: { $in: ids } });
    for (const item of items) {
      await restoreOne(item);
      await item.deleteOne();
    }
    broadcast('blocks:changed', null);
    res.json({ ok: true, restored: items.length });
  } catch (err) { next(err); }
});

// POST /api/trash/:id/restore — single restore
router.post('/trash/:id/restore', verifyJWT, async (req, res, next) => {
  try {
    const item = await Trash.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Trash item not found' });
    await restoreOne(item);
    await item.deleteOne();
    broadcast('blocks:changed', null);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/trash/bulk — bulk permanent delete (must come BEFORE /:id)
router.delete('/trash/bulk', verifyJWT, async (req, res, next) => {
  try {
    const { ids } = req.body;
    const items = await Trash.find({ _id: { $in: ids } });
    for (const item of items) await purgeCloudinary(item.type, item.data);
    await Trash.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deleted: items.length });
  } catch (err) { next(err); }
});

// DELETE /api/trash/:id — single permanent delete
router.delete('/trash/:id', verifyJWT, async (req, res, next) => {
  try {
    const item = await Trash.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Trash item not found' });
    await purgeCloudinary(item.type, item.data);
    await item.deleteOne();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
