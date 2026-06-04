import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import jwt from 'jsonwebtoken';
import Block from '../models/Block.js';
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
      cloudinaryId: result.public_id,
      url:          result.secure_url,
      uploadedAt:   new Date(),
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
        .catch(() => {}); // non-fatal if already gone
    }

    await block.save();
    res.json({ ok: true });
    broadcast('blocks:changed', null);
  } catch (err) { next(err); }
});

// GET /api/documents/:did/file — sign a Cloudinary URL server-side and stream
// the file back to the client. Accepts JWT via Authorization header OR ?token=
// query param (needed for iframe src which can't send custom headers).
router.get('/documents/:did/file', async (req, res, next) => {
  try {
    // Verify JWT — accept from header or query param (for iframe)
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
    if (!doc?.url || !doc?.cloudinaryId) return res.status(404).send('No file stored');

    // Detect resource_type and format from the stored URL/id
    const resourceType = doc.url.includes('/video/') ? 'video'
                       : doc.url.includes('/image/') ? 'image'
                       : 'raw';

    // Extract format from cloudinaryId (e.g. "estatepro/abc.pdf" → "pdf")
    const idParts = doc.cloudinaryId.split('.');
    const format = idParts.length > 1 ? idParts[idParts.length - 1] : '';

    // private_download_url produces an API-signed URL that bypasses ALL Cloudinary
    // access restrictions — the signature proves we are the account owner.
    const signedUrl = cloudinary.utils.private_download_url(
      doc.cloudinaryId,
      format,
      { resource_type: resourceType, expires_at: Math.floor(Date.now() / 1000) + 300 }
    );

    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      console.error('Cloudinary fetch failed:', upstream.status, signedUrl);
      return res.status(502).send('Could not retrieve file from storage');
    }

    const dl = req.query.dl === '1';
    const safeName = encodeURIComponent(doc.name || 'file');
    res.setHeader('Content-Type', doc.mimeType || upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${dl ? 'attachment' : 'inline'}; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, max-age=120');

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) { next(err); }
});

export default router;
