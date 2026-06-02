import express from 'express';
import mongoose from 'mongoose';
import Block from '../models/Block.js';
import { txBlock } from '../utils/transform.js';
import { verifyJWT } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// ── Blocks ──────────────────────────────────────────────────────────────────

// GET /api/blocks — all blocks (open read)
router.get('/blocks', async (req, res, next) => {
  try {
    const blocks = await Block.find();
    res.json(blocks.map(txBlock));
  } catch (err) { next(err); }
});

// POST /api/blocks
router.post('/blocks', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.create({
      name: req.body.name,
      type: req.body.type || 'block',
      units: [],
    });
    res.status(201).json(txBlock(block));
  } catch (err) { next(err); }
});

// PUT /api/blocks/:bid
router.put('/blocks/:bid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findById(req.params.bid);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    if (req.body.name !== undefined) block.name = req.body.name;
    if (req.body.type !== undefined) block.type = req.body.type;
    await block.save();
    res.json(txBlock(block));
  } catch (err) { next(err); }
});

// DELETE /api/blocks/:bid — cascade deletes Cloudinary files
router.delete('/blocks/:bid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findById(req.params.bid);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    const cloudIds = block.units
      .flatMap(u => u.tenants.flatMap(t => t.documents.map(d => d.cloudinaryId)))
      .filter(Boolean);
    if (cloudIds.length) {
      await cloudinary.api.delete_resources(cloudIds);
    }
    await block.deleteOne();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Units ────────────────────────────────────────────────────────────────────

// POST /api/blocks/:bid/units
router.post('/blocks/:bid/units', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findById(req.params.bid);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    block.units.push({
      name: req.body.name,
      type: req.body.type,
      monthlyRent: req.body.monthlyRent || 0,
      tenants: [],
    });
    await block.save();
    res.status(201).json(txBlock(block));
  } catch (err) { next(err); }
});

// PUT /api/units/:uid
router.put('/units/:uid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) return res.status(404).json({ error: 'Unit not found' });
    const unit = block.units.id(req.params.uid);
    if (req.body.name !== undefined)        unit.name = req.body.name;
    if (req.body.type !== undefined)        unit.type = req.body.type;
    if (req.body.monthlyRent !== undefined) unit.monthlyRent = req.body.monthlyRent;
    await block.save();
    res.json(txBlock(block));
  } catch (err) { next(err); }
});

// DELETE /api/units/:uid
router.delete('/units/:uid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) return res.status(404).json({ error: 'Unit not found' });
    block.units.pull(req.params.uid);
    await block.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Tenants ──────────────────────────────────────────────────────────────────

// POST /api/units/:uid/tenants
router.post('/units/:uid/tenants', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) return res.status(404).json({ error: 'Unit not found' });
    const unit = block.units.id(req.params.uid);
    const { tid, ...tenantData } = req.body; // strip client-generated tid
    unit.tenants.push({ ...tenantData, leaseStatus: 'active', documents: [] });
    await block.save();
    res.status(201).json(txBlock(block));
  } catch (err) { next(err); }
});

// PUT /api/tenants/:tid
router.put('/tenants/:tid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) return res.status(404).json({ error: 'Tenant not found' });
    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }
    const { tid, documents, _id, ...updates } = req.body;
    Object.assign(tenant, updates);
    await block.save();
    res.json(txBlock(block));
  } catch (err) { next(err); }
});

// DELETE /api/tenants/:tid
router.delete('/tenants/:tid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) return res.status(404).json({ error: 'Tenant not found' });
    for (const unit of block.units) {
      if (unit.tenants.id(req.params.tid)) {
        unit.tenants.pull(req.params.tid);
        break;
      }
    }
    await block.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
