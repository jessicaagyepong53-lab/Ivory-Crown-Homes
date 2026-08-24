import express from 'express';
import mongoose from 'mongoose';
import Block from '../models/Block.js';
import Trash from '../models/Trash.js';
import { txBlock } from '../utils/transform.js';
import { verifyJWT } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { broadcast } from '../socket.js';
import { AppError, requireObjectId, requireNonEmptyString, requirePositiveNumber, requireDateString, requireOneOf } from '../utils/validators.js';

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
    const name = requireNonEmptyString(req.body.name, 'Block name');
    const type = req.body.type ? requireOneOf(req.body.type, ['block', 'standalone'], 'Type') : 'block';
    const block = await Block.create({
      name,
      type,
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
    requireObjectId(req.params.bid, 'Block ID');
    const block = await Block.findById(req.params.bid);
    if (!block) throw new AppError('Block not found', 404);
    if (req.body.name    !== undefined) block.name    = requireNonEmptyString(req.body.name, 'Block name');
    if (req.body.type    !== undefined) block.type    = requireOneOf(req.body.type, ['block', 'standalone'], 'Type');
    if (req.body.address !== undefined) block.address = req.body.address;
    await block.save();
    res.json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/blocks/:bid — soft-delete to trash
router.delete('/blocks/:bid', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.bid, 'Block ID');
    const block = await Block.findById(req.params.bid);
    if (!block) throw new AppError('Block not found', 404);
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
    requireObjectId(req.params.bid, 'Block ID');
    const name = requireNonEmptyString(req.body.name, 'Unit name');
    const block = await Block.findById(req.params.bid);
    if (!block) throw new AppError('Block not found', 404);
    block.units.push({
      name,
      type: req.body.type,
      monthlyRent: Number(req.body.monthlyRent) || 0,
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
    requireObjectId(req.params.uid, 'Unit ID');
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) throw new AppError('Unit not found', 404);
    const unit = block.units.id(req.params.uid);
    if (req.body.name        !== undefined) unit.name        = requireNonEmptyString(req.body.name, 'Unit name');
    if (req.body.type        !== undefined) unit.type        = req.body.type;
    if (req.body.monthlyRent !== undefined) unit.monthlyRent = requirePositiveNumber(req.body.monthlyRent, 'Monthly rent');
    await block.save();
    res.json(txBlock(block)); // PUT unit
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/units/:uid — soft-delete to trash
router.delete('/units/:uid', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.uid, 'Unit ID');
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) throw new AppError('Unit not found', 404);
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
    requireObjectId(req.params.uid, 'Unit ID');
    requireNonEmptyString(req.body.name, 'Tenant name');
    const block = await Block.findOne({ 'units._id': new mongoose.Types.ObjectId(req.params.uid) });
    if (!block) throw new AppError('Unit not found', 404);
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
    requireObjectId(req.params.tid, 'Tenant ID');
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) throw new AppError('Tenant not found', 404);
    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }
    const { tid, documents, _id, ...updates } = req.body;
    // Coerce number fields sent as strings
    for (const f of ['monthlyRent', 'advanceMonths', 'advanceAmount', 'depositAmount', 'balanceOwed', 'refundAmount']) {
      if (updates[f] != null) updates[f] = requirePositiveNumber(updates[f], f);
    }
    Object.assign(tenant, updates);
    // Keep unit.monthlyRent in sync
    if (updates.monthlyRent > 0) {
      for (const unit of block.units) {
        if (unit.tenants.id(req.params.tid)) { unit.monthlyRent = updates.monthlyRent; break; }
      }
    }
    await block.save();
    res.json(txBlock(block)); // PUT tenant
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/tenants/:tid — soft-delete to trash
router.delete('/tenants/:tid', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.tid, 'Tenant ID');
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) throw new AppError('Tenant not found', 404);
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

// POST /api/tenants/:tid/payments — record a payment
router.post('/tenants/:tid/payments', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.tid, 'Tenant ID');
    const amount = requirePositiveNumber(req.body.amount, 'Amount');
    if (amount <= 0) throw new AppError('Amount must be greater than zero.');
    const date = requireDateString(req.body.date, 'Date');

    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) throw new AppError('Tenant not found', 404);
    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }
    tenant.payments.push({ amount, date, note: req.body.note || '' });
    // Auto-reduce balanceOwed by the payment amount (floor at 0)
    tenant.balanceOwed = Math.max(0, (Number(tenant.balanceOwed) || 0) - amount);
    // Keep lastPaymentDate / lastPaymentAmount in sync with most recent entry
    const sorted = [...tenant.payments].sort((a, b) => (a.date > b.date ? -1 : 1));
    tenant.lastPaymentAmount = sorted[0].amount;
    tenant.lastPaymentDate   = sorted[0].date;
    await block.save();
    res.status(201).json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/tenants/:tid/payments/:pid — remove a payment
router.delete('/tenants/:tid/payments/:pid', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.tid, 'Tenant ID');
    requireObjectId(req.params.pid, 'Payment ID');
    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) throw new AppError('Tenant not found', 404);
    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }
    const removedPayment = tenant.payments.id(req.params.pid);
    if (!removedPayment) throw new AppError('Payment not found', 404);
    // Restore balanceOwed by the removed payment amount
    tenant.balanceOwed = (Number(tenant.balanceOwed) || 0) + Number(removedPayment.amount);
    tenant.payments.pull(req.params.pid);
    // Re-sync lastPaymentDate / lastPaymentAmount
    if (tenant.payments.length > 0) {
      const sorted = [...tenant.payments].sort((a, b) => (a.date > b.date ? -1 : 1));
      tenant.lastPaymentAmount = sorted[0].amount;
      tenant.lastPaymentDate   = sorted[0].date;
    } else {
      tenant.lastPaymentAmount = 0;
      tenant.lastPaymentDate   = null;
    }
    await block.save();
    res.json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// POST /api/tenants/:tid/renew — archive current lease period, apply new one
router.post('/tenants/:tid/renew', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.tid, 'Tenant ID');
    requireDateString(req.body.leaseStart, 'Lease start date');
    if (req.body.leaseEnd) requireDateString(req.body.leaseEnd, 'Lease end date');

    const block = await Block.findOne({ 'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid) });
    if (!block) throw new AppError('Tenant not found', 404);
    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }
    // Archive the full current lease period into history (including documents)
    if (!tenant.leaseHistory) tenant.leaseHistory = [];
    tenant.leaseHistory.push({
      leaseStart:         tenant.leaseStart,
      leaseEnd:           tenant.leaseEnd,
      depositPaid:        tenant.depositPaid,
      depositAmount:      tenant.depositAmount,
      monthlyRent:        tenant.monthlyRent,
      advanceMonths:      tenant.advanceMonths,
      advanceAmount:      tenant.advanceAmount,
      balanceOwed:        tenant.balanceOwed || 0,
      lastPaymentAmount:  tenant.lastPaymentAmount || 0,
      lastPaymentDate:    tenant.lastPaymentDate || null,
      renewedAt:          new Date().toISOString().slice(0, 10),
      documents:          tenant.documents ? tenant.documents.toObject() : [],
    });
    // Clear documents for the new lease period
    tenant.documents         = [];
    tenant.lastPaymentAmount = 0;
    tenant.lastPaymentDate   = null;
    // Apply the new lease period — reset financials for new term
    tenant.leaseStart     = req.body.leaseStart;
    tenant.leaseEnd       = req.body.leaseEnd       || null;
    tenant.depositPaid    = req.body.depositPaid    ?? false;
    tenant.depositAmount  = req.body.depositAmount  != null ? requirePositiveNumber(req.body.depositAmount, 'Deposit amount')  : 0;
    tenant.monthlyRent    = req.body.monthlyRent    != null ? requirePositiveNumber(req.body.monthlyRent, 'Monthly rent')    : tenant.monthlyRent;
    tenant.advanceMonths  = req.body.advanceMonths  != null ? requirePositiveNumber(req.body.advanceMonths, 'Advance months')  : 0;
    tenant.advanceAmount  = req.body.advanceMonths && tenant.monthlyRent
      ? Number(req.body.advanceMonths) * tenant.monthlyRent
      : (req.body.advanceAmount != null ? requirePositiveNumber(req.body.advanceAmount, 'Advance amount') : 0);
    tenant.balanceOwed         = req.body.balanceOwed    != null ? requirePositiveNumber(req.body.balanceOwed, 'Balance owed')    : 0;
    tenant.lastPaymentAmount   = req.body.lastPaymentAmount != null ? requirePositiveNumber(req.body.lastPaymentAmount, 'Last payment amount') : (tenant.lastPaymentAmount || 0);
    tenant.lastPaymentDate     = req.body.lastPaymentDate   ?? tenant.lastPaymentDate ?? null;
    tenant.leaseStatus    = 'active';
    // Sync unit monthlyRent
    if (req.body.monthlyRent > 0) {
      for (const unit of block.units) {
        if (unit.tenants.id(req.params.tid)) { unit.monthlyRent = tenant.monthlyRent; break; }
      }
    }
    await block.save();
    res.json(txBlock(block));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

export default router;