import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import jwt from 'jsonwebtoken';
import Block from '../models/Block.js';
import DocFile from '../models/File.js';
import { txBlock, txDoc } from '../utils/transform.js';
import { verifyJWT } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { broadcast } from '../socket.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/tenants/:tid/documents — upload file to Cloudinary, save metadata
router.post('/tenants/:tid/documents', verifyJWT, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Upload buffer to Cloudinary via stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'estatepro', resource_type: 'auto' },
        (err, result) => err ? reject(err) : resolve(result)
      );
      Readable.from(req.file.buffer).pipe(stream);
    });

    const block = await Block.findOne({
      'units.tenants._id': new mongoose.Types.ObjectId(req.params.tid),
    });
    if (!block) return res.status(404).json({ error: 'Tenant not found' });

    let tenant = null;
    for (const unit of block.units) {
      tenant = unit.tenants.id(req.params.tid);
      if (tenant) break;
    }

    // Store file bytes in MongoDB — no external auth issues
    const fileDoc = await DocFile.create({
      data:     req.file.buffer,
      mimeType: req.file.mimetype,
      name:     req.file.originalname,
    });

    tenant.documents.push({
      name:         req.file.originalname,
      mimeType:     req.file.mimetype,
      size:         req.file.size,
      category:     req.body.category || 'Other',
      note:         req.body.note || '',
      leasePeriod:  (() => {
        const sy = tenant.leaseStart ? new Date(tenant.leaseStart).getFullYear() : null;
        const ey = tenant.leaseEnd   ? new Date(tenant.leaseEnd).getFullYear()   : null;
        if (!sy) return null;
        return ey && ey !== sy ? `${sy}\u2013${ey}` : `${sy}`;
      })(),
      cloudinaryId:   result.public_id,
      cloudinaryType: result.resource_type,
      url:            result.secure_url,
      fileId:         fileDoc._id,
      uploadedAt:     new Date(),
    });

    await block.save();

    // Return just the new document object
    const newDoc = tenant.documents[tenant.documents.length - 1];
    res.status(201).json(txDoc(newDoc));
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/documents/:did — remove from Cloudinary + DB
router.delete('/documents/:did', verifyJWT, async (req, res, next) => {
  try {
    const block = await Block.findOne({
      'units.tenants.documents._id': new mongoose.Types.ObjectId(req.params.did),
    });
    if (!block) return res.status(404).json({ error: 'Document not found' });

    let removed = null;
    outer: for (const unit of block.units) {
      for (const tenant of unit.tenants) {
        const doc = tenant.documents.id(req.params.did);
        if (doc) {
          removed = doc;
          tenant.documents.pull(req.params.did);
          break outer;
        }
      }
    }

    if (removed?.cloudinaryId) {
      await cloudinary.uploader.destroy(removed.cloudinaryId, { resource_type: 'raw' })
        .catch(() => {});
    }
    if (removed?.fileId) {
      await DocFile.findByIdAndDelete(removed.fileId).catch(() => {});
    }

    await block.save();
    res.json({ ok: true });
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// GET /api/documents/:did/file — serve file bytes directly from MongoDB.
// Accepts JWT via Authorization header OR ?token= query param (for iframes).
router.get('/documents/:did/file', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : req.query.token;
    if (!token) return res.status(401).send('Unauthorized');
    try { jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).send('Invalid token'); }

    const block = await Block.findOne({
      'units.tenants.documents._id': new mongoose.Types.ObjectId(req.params.did),
    });
    if (!block) return res.status(404).send('Document not found');

    let doc = null;
    outer: for (const unit of block.units) {
      for (const tenant of unit.tenants) {
        const d = tenant.documents.id(req.params.did);
        if (d) { doc = d; break outer; }
      }
    }
    if (!doc) return res.status(404).send('Document not found');

    // ── New files: serve bytes directly from MongoDB ──────────────────────────
    if (doc.fileId) {
      const file = await DocFile.findById(doc.fileId);
      if (file?.data) {
        const dl = req.query.dl === '1';
        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${dl ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.name || 'file')}"`);
        res.setHeader('Content-Length', file.data.length);
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.end(file.data);
      }
    }

    // ── Old files (no fileId): tell user to delete & re-upload ───────────────
    return res.status(404).send('File not found — please delete this document and re-upload it.');
  } catch (err) { next(err); }
});

export default router;
