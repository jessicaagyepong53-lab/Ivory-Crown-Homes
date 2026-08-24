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
import { parseLease } from '../utils/parseLease.js';
import { AppError, requireObjectId } from '../utils/validators.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/tenants/:tid/documents — upload file to Cloudinary, save metadata
router.post('/tenants/:tid/documents', verifyJWT, upload.single('file'), async (req, res, next) => {
  try {
    requireObjectId(req.params.tid, 'Tenant ID');
    if (!req.file) throw new AppError('No file provided.');

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
    if (!block) throw new AppError('Tenant not found', 404);

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

    // ── Auto-extract lease details from PDF if this is a lease/tenancy agreement
    let extracted = {};
    const isPdf    = req.file.mimetype === 'application/pdf';
    const isLease  = /lease|tenancy|rental.?agreement/i.test(req.file.originalname) ||
                     /lease agreement/i.test(req.body.category || '');
    if (isPdf && isLease) {
      try {
        extracted = await parseLease(req.file.buffer);
        if (Object.keys(extracted).length > 0) {
          // Re-fetch tenant (after block.save above) and apply only missing/zero fields
          const freshBlock = await Block.findById(block._id);
          let freshTenant = null;
          for (const unit of freshBlock.units) {
            freshTenant = unit.tenants.id(req.params.tid);
            if (freshTenant) {
              // Only fill in fields that are currently blank/zero
              for (const [k, v] of Object.entries(extracted)) {
                if (freshTenant[k] == null || freshTenant[k] === '' || freshTenant[k] === 0 || freshTenant[k] === false) {
                  freshTenant[k] = v;
                }
              }
              // Keep unit monthlyRent in sync
              if (extracted.monthlyRent > 0 && !unit.monthlyRent) unit.monthlyRent = extracted.monthlyRent;
              break;
            }
          }
          await freshBlock.save();
          broadcast('blocks:changed', null);
        }
      } catch (e) {
        console.warn('[parseLease] extraction failed:', e.message);
      }
    }

    // Return just the new document object + any extracted fields for frontend toast
    const newDoc = tenant.documents[tenant.documents.length - 1];
    res.status(201).json({ ...txDoc(newDoc), _extracted: extracted });
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// DELETE /api/documents/:did — remove from Cloudinary + DB
router.delete('/documents/:did', verifyJWT, async (req, res, next) => {
  try {
    requireObjectId(req.params.did, 'Document ID');

    const block = await Block.findOne({
      'units.tenants.documents._id': new mongoose.Types.ObjectId(req.params.did),
    });
    if (!block) throw new AppError('Document not found', 404);

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
    requireObjectId(req.params.did, 'Document ID');

    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : req.query.token;
    if (!token) throw new AppError('Unauthorized', 401);
    try { jwt.verify(token, process.env.JWT_SECRET); }
    catch { throw new AppError('Invalid or expired token', 401); }

    const block = await Block.findOne({
      'units.tenants.documents._id': new mongoose.Types.ObjectId(req.params.did),
    });
    if (!block) throw new AppError('Document not found', 404);

    let doc = null;
    outer: for (const unit of block.units) {
      for (const tenant of unit.tenants) {
        const d = tenant.documents.id(req.params.did);
        if (d) { doc = d; break outer; }
      }
    }
    if (!doc) throw new AppError('Document not found', 404);

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
    throw new AppError('File not found — please delete this document and re-upload it.', 404);
  } catch (err) { next(err); }
});

export default router;