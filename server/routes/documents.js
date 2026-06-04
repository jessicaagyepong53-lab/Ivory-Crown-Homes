import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import crypto from 'crypto';
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

// GET /api/documents/:did/file — proxy file from Cloudinary using a signed URL.
// Accepts JWT via Authorization header OR ?token= query param (needed for iframes).
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

    // Detect resource_type from stored URL
    const resourceType = doc.url.includes('/video/') ? 'video'
                       : doc.url.includes('/image/') ? 'image'
                       : 'raw';

    // Build a Cloudinary API download URL manually using crypto.
    // This goes to api.cloudinary.com (not the CDN), so CDN access restrictions
    // don't apply. The HMAC signature proves we own the account.
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiKey || !apiSecret || !cloudName) {
      console.error('Missing Cloudinary env vars:', { apiKey: !!apiKey, apiSecret: !!apiSecret, cloudName: !!cloudName });
      return res.status(500).send('Server misconfiguration: Cloudinary credentials missing');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `public_id=${doc.cloudinaryId}&timestamp=${timestamp}`;
    const signature   = crypto.createHash('sha1')
                               .update(paramsToSign + apiSecret)
                               .digest('hex');

    const apiUrl = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download`);
    apiUrl.searchParams.set('public_id', doc.cloudinaryId);
    apiUrl.searchParams.set('api_key',   apiKey);
    apiUrl.searchParams.set('timestamp', timestamp);
    apiUrl.searchParams.set('signature', signature);

    const upstream = await fetch(apiUrl.toString());
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      console.error(`Cloudinary API download failed [${upstream.status}]: ${body.slice(0, 400)}`);
      return res.status(502).send(`Could not retrieve file (${upstream.status}): ${body.slice(0, 200)}`);
    }

    const dl = req.query.dl === '1';
    const safeName = encodeURIComponent(doc.name || 'file');
    res.setHeader('Content-Type', doc.mimeType || upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${dl ? 'attachment' : 'inline'}; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, max-age=120');

    // Buffer the response to avoid Readable.fromWeb compatibility issues
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) { next(err); }
});

export default router;
