import express from 'express';
import mongoose from 'mongoose';
import Block from '../models/Block.js';
import Trash from '../models/Trash.js';
import { txBlock } from '../utils/transform.js';
import { verifyJWT } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { broadcast } from '../socket.js';

const router = express.Router();
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

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
      name:    req.body.name,
      type:    req.body.type    || 'block',
      address: req.body.address || '',
      units:   [],
    });
    res.status(201).json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// PUT /api/blocks/:bid
router.put('/blocks/:bid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findById(req.params.bid);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    if (req.body.name    !== undefined) block.name    = req.body.name;
    if (req.body.type    !== undefined) block.type    = req.body.type;
    if (req.body.address !== undefined) block.address = req.body.address;
    await block.save();
    res.json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/blocks/:bid — soft-delete to trash
router.delete('/blocks/:bid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findById(req.params.bid);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    // Move to trash (Cloudinary files kept until permanently deleted)
    await Trash.create({
      type: 'block',
      label: block.name,
      context: block.address || '',
      data: block.toObject(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS),
    });
    await block.deleteOne();
    res.json({ ok: true });
    broadcast('blocks:changed', null);
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
    res.status(201).json(txBlock(block)); // POST unit
    broadcast('blocks:changed', null);
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
    res.json(txBlock(block)); // PUT unit
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/units/:uid — soft-delete to trash
router.delete('/units/:uid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) return res.status(404).json({ error: 'Unit not found' });
    const unit = block.units.id(req.params.uid);
    // Move to trash
    await Trash.create({
      type: 'unit',
      label: unit.name,
      context: block.name,
      data: unit.toObject(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS),
      parentBlockId: String(block._id),
    });
    block.units.pull(req.params.uid);
    await block.save();
    res.json({ ok: true });
    broadcast('blocks:changed', null);
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
    // Auto-end any currently active tenant before adding the new one
    const today = new Date().toISOString().slice(0, 10);
    for (const t of unit.tenants) {
      if (t.leaseStatus === 'active') {
        t.leaseStatus = 'ended';
        if (!t.cancelDate) t.cancelDate = today;
        if (!t.leaseEnd)   t.leaseEnd   = today;
      }
    }
    unit.tenants.push({ ...tenantData, leaseStatus: 'active', documents: [] });
    await block.save();
    res.status(201).json(txBlock(block)); // POST tenant
    broadcast('blocks:changed', null);
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
    res.json(txBlock(block)); // PUT tenant
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/tenants/:tid — soft-delete to trash
router.delete('/tenants/:tid', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) return res.status(404).json({ error: 'Tenant not found' });
    let unit = null, tenant = null;
    for (const u of block.units) {
      const t = u.tenants.id(req.params.tid);
      if (t) { unit = u; tenant = t; break; }
    }
    // Move to trash
    await Trash.create({
      type: 'tenant',
      label: tenant.name,
      context: `${block.name} / ${unit.name}`,
      data: tenant.toObject(),
      expiresAt: new Date(Date.now() + THIRTY_DAYS),
      parentBlockId: String(block._id),
      parentUnitId:  String(unit._id),
    });
    unit.tenants.pull(req.params.tid);
    await block.save();
    res.json({ ok: true }); // DELETE tenant
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// POST /api/tenants/:tid/renew — archive current lease period, apply new one
router.post('/tenants/:tid/renew', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) return res.status(404).json({ error: 'Tenant not found' });
    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }
    // Archive the current lease period into history
    if (!tenant.leaseHistory) tenant.leaseHistory = [];
    tenant.leaseHistory.push({
      leaseStart:    tenant.leaseStart,
      leaseEnd:      tenant.leaseEnd,
      depositPaid:   tenant.depositPaid,
      depositAmount: tenant.depositAmount,
      renewedAt:     new Date().toISOString().slice(0, 10),
    });
    // Apply the new lease period
    tenant.leaseStart   = req.body.leaseStart;
    tenant.leaseEnd     = req.body.leaseEnd     || null;
    tenant.depositPaid  = req.body.depositPaid  ?? tenant.depositPaid;
    tenant.depositAmount = req.body.depositAmount != null ? Number(req.body.depositAmount) : tenant.depositAmount;
    tenant.leaseStatus  = 'active';
    await block.save();
    res.json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

export default router;
