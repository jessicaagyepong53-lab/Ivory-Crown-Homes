import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'stream';
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

// GET /api/documents/:did/file        — serve file inline (view)
// GET /api/documents/:did/file?dl=1  — serve file as download
router.get('/documents/:did/file', async (req, res, next) => {
  try {
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
    if (!doc?.cloudinaryId || !doc?.url) return res.status(404).send('No file stored');

    // Parse resource_type, publicId, and format from the stored URL
    const urlMatch = doc.url.match(/cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v(\d+)\/)?(.+)$/);
    if (!urlMatch) return res.status(500).send('Cannot parse stored Cloudinary URL');

    const resourceType = urlMatch[1];
    const rawPath      = urlMatch[3];
    const fmtMatch     = rawPath.match(/^(.+?)\.([a-zA-Z0-9]+)$/);
    const publicId     = fmtMatch ? fmtMatch[1] : rawPath;

    // Build Admin API download URL — bypasses CDN delivery restrictions entirely.
    // Cloudinary Admin API authenticates via timestamp+HMAC signature, always works
    // regardless of account delivery security settings.
    const ts      = Math.round(Date.now() / 1000);
    const toSign  = { public_id: publicId, timestamp: ts, type: 'upload' };
    const sig     = cloudinary.utils.api_sign_request(toSign, process.env.CLOUDINARY_API_SECRET);
    const apiUrl  = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/download` +
      `?public_id=${encodeURIComponent(publicId)}&type=upload&timestamp=${ts}&signature=${sig}&api_key=${process.env.CLOUDINARY_API_KEY}`;

    const upstream = await fetch(apiUrl);
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      console.error('[proxy] Cloudinary API error', upstream.status, body.substring(0, 200));
      return res.status(502).send(`Storage returned ${upstream.status}`);
    }

    const buffer = await upstream.arrayBuffer();
    const safeName = (doc.name || 'file').replace(/["/\\]/g, '');
    const disposition = req.query.dl === '1'
      ? `attachment; filename="${safeName}"`
      : `inline; filename="${safeName}"`;

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

export default router;
