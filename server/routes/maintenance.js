import express from 'express';
import multer from 'multer';
import Maintenance from '../models/Maintenance.js';
import DocFile from '../models/File.js';
import { txMaint } from '../utils/transform.js';
import { parseMaintenanceReceipt } from '../utils/parseMaintenanceReceipt.js';
import { verifyJWT } from '../middleware/auth.js';
import { broadcast } from '../socket.js';
import { AppError, requireObjectId, requireNonEmptyString, requireOneOf } from '../utils/validators.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

function parsePayload(req) {
  if (!req.is('multipart/form-data')) return req.body || {};
  const parsed = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    if (value === 'true') parsed[key] = true;
    else if (value === 'false') parsed[key] = false;
    else if (key === 'cost' || key === 'unitsCovered') parsed[key] = Number(value) || 0;
    else if (key === 'blockIds') parsed[key] = String(value).split(',').map((v) => v.trim()).filter(Boolean);
    else parsed[key] = value;
  }
  return parsed;
}

// POST /api/maintenance/parse-receipt — OCR/parse one uploaded receipt file
router.post('/maintenance/parse-receipt', verifyJWT, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file provided.');
    const parsed = await parseMaintenanceReceipt(req.file.buffer, req.file.mimetype);
    res.json(parsed);
  } catch (err) { next(err); }
});

// GET /api/maintenance — open read
router.get('/maintenance', async (req, res, next) => {
  try {
    const entries = await Maintenance.find().sort({ createdAt: -1 });
    res.json(entries.map(txMaint));
  } catch (err) { next(err); }
});

// POST /api/maintenance
router.post('/maintenance', verifyJWT, upload.array('attachments', 5), async (req, res, next) => {
  try {
    const payload = parsePayload(req);
    const targetScope = payload.targetScope === 'block' ? 'block' : 'unit';
    const blockIds = Array.isArray(payload.blockIds) && payload.blockIds.length > 0
      ? payload.blockIds
      : (payload.blockId ? [payload.blockId] : []);
    const blockId = blockIds[0] || payload.blockId || '';
    const commonAreaName = (payload.commonAreaName || '').trim();

    if (!blockId) throw new AppError('Please select a block.');
    requireNonEmptyString(payload.description, 'Description');
    if (targetScope === 'unit' && !payload.unitId) {
      throw new AppError('Unit is required for unit-level requests.');
    }
    if (targetScope === 'block' && !commonAreaName) {
      throw new AppError('Common area name is required for block-level requests.');
    }

    const attachments = [];
    for (const file of (req.files || [])) {
      const fileDoc = await DocFile.create({
        data: file.buffer,
        mimeType: file.mimetype,
        name: file.originalname,
      });
      attachments.push({
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileId: fileDoc._id,
        uploadedAt: new Date(),
      });
    }

    const entry = await Maintenance.create({
      ...payload,
      blockId,
      blockIds,
      targetScope,
      unitId: targetScope === 'unit' ? payload.unitId : undefined,
      commonAreaName: targetScope === 'block' ? commonAreaName : undefined,
      issueDate: payload.issueDate || payload.reportedDate,
      reportedDate: payload.issueDate || payload.reportedDate,
      unitsCovered: Number(payload.unitsCovered) || 0,
      attachments,
    });
    res.status(201).json(txMaint(entry));
    broadcast('maintenance:changed', null);
  } catch (err) { next(err); }
});

// PUT /api/maintenance/:id
router.put('/maintenance/:id', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.id, 'Maintenance ID');
    const updates = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updates, 'cost')) {
      updates.cost = Number(updates.cost) || 0;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'blockIds')) {
      updates.blockIds = Array.isArray(updates.blockIds)
        ? updates.blockIds
        : String(updates.blockIds || '').split(',').map((v) => v.trim()).filter(Boolean);
      updates.blockId = updates.blockIds[0] || updates.blockId;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'unitsCovered')) {
      updates.unitsCovered = Number(updates.unitsCovered) || 0;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'issueDate')) {
      updates.reportedDate = updates.issueDate;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'contractorContact')) {
      updates.contractorContact = String(updates.contractorContact || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'location')) {
      updates.location = String(updates.location || '').trim();
    }
    if (updates.description != null) {
      updates.description = requireNonEmptyString(updates.description, 'Description');
    }
    if (updates.status != null) {
      requireOneOf(updates.status, ['Pending', 'In Progress', 'Completed', 'Cancelled'], 'Status');
    }
    if (updates.targetScope === 'block') {
      const commonAreaName = (updates.commonAreaName || '').trim();
      if (!commonAreaName) {
        throw new AppError('Common area name is required for block-level requests.');
      }
      updates.commonAreaName = commonAreaName;
      updates.unitId = undefined;
    }
    if (updates.targetScope === 'unit') {
      if (!updates.unitId) {
        throw new AppError('Unit is required for unit-level requests.');
      }
      updates.commonAreaName = undefined;
      updates.blockIds = updates.blockIds || (updates.blockId ? [updates.blockId] : []);
    }
    const entry = await Maintenance.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!entry) throw new AppError('Entry not found', 404);
    res.json(txMaint(entry));
    broadcast('maintenance:changed', null);
  } catch (err) { next(err); }
});

// GET /api/maintenance/:id/attachments/:aid/file — serve stored receipt/doc bytes.
// Open read (same access model as maintenance list).
router.get('/maintenance/:id/attachments/:aid/file', async (req, res, next) => {
  try {
    requireObjectId(req.params.id, 'Maintenance ID');
    requireObjectId(req.params.aid, 'Attachment ID');

    const entry = await Maintenance.findById(req.params.id);
    if (!entry) throw new AppError('Entry not found', 404);

    const attachment = entry.attachments.id(req.params.aid);
    if (!attachment) throw new AppError('Attachment not found', 404);

    const file = await DocFile.findById(attachment.fileId);
    if (!file?.data) throw new AppError('File not found', 404);

    const dl = req.query.dl === '1';
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${dl ? 'attachment' : 'inline'}; filename="${encodeURIComponent(attachment.name || file.name || 'file')}"`);
    res.setHeader('Content-Length', file.data.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(file.data);
  } catch (err) { next(err); }
});

// DELETE /api/maintenance/:id/attachments/:aid — remove one receipt/document
router.delete('/maintenance/:id/attachments/:aid', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.id, 'Maintenance ID');
    requireObjectId(req.params.aid, 'Attachment ID');

    const entry = await Maintenance.findById(req.params.id);
    if (!entry) throw new AppError('Entry not found', 404);

    const attachment = entry.attachments.id(req.params.aid);
    if (!attachment) throw new AppError('Attachment not found', 404);

    const fileId = attachment.fileId;
    entry.attachments.pull(req.params.aid);
    await entry.save();
    if (fileId) await DocFile.findByIdAndDelete(fileId).catch(() => {});

    res.json(txMaint(entry));
    broadcast('maintenance:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/maintenance/:id — delete one maintenance entry and linked files
router.delete('/maintenance/:id', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.id, 'Maintenance ID');

    const entry = await Maintenance.findById(req.params.id);
    if (!entry) throw new AppError('Entry not found', 404);

    const fileIds = (entry.attachments || []).map((a) => a.fileId).filter(Boolean);
    await Maintenance.findByIdAndDelete(req.params.id);
    if (fileIds.length > 0) {
      await DocFile.deleteMany({ _id: { $in: fileIds } }).catch(() => {});
    }

    res.json({ ok: true, id: req.params.id });
    broadcast('maintenance:changed', null);
  } catch (err) { next(err); }
});

export default router;