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
      cloudinaryId:   result.public_id,
      cloudinaryType: result.resource_type, // 'image' | 'raw' | 'video'
      url:            result.secure_url,
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

    // resource_type: stored on upload, or inferred from URL path segment
    const resourceType = doc.cloudinaryType
      || (doc.url.includes('/video/') ? 'video' : doc.url.includes('/raw/') ? 'raw' : 'image');

    // cloudinary.url() with sign_url:true generates a signature-embedded CDN URL.
    // This is the correct method for type=upload assets with access restrictions.
    // private_download_url is for type=private — wrong endpoint, always 404 here.
    const signedUrl = cloudinary.url(doc.cloudinaryId, {
      secure: true,
      sign_url: true,
      type: 'upload',
      resource_type: resourceType,
    });

    console.log(`[doc-proxy] fetching resource_type=${resourceType} signed=${signedUrl}`);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      console.error(`[doc-proxy] failed status=${upstream.status} body=${body.slice(0, 300)}`);
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

// GET /api/documents/:did/debug — returns raw diagnostic info as JSON (JWT required)
router.get('/documents/:did/debug', verifyJWT, async (req, res, next) => {
  try {
    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey     = process.env.CLOUDINARY_API_KEY;
    const apiSecret  = process.env.CLOUDINARY_API_SECRET;

    const block = await Block.findOne({
      'units.tenants.documents._id': new mongoose.Types.ObjectId(req.params.did),
    });
    if (!block) return res.json({ error: 'Document not found in DB' });

    let doc = null;
    outer: for (const unit of block.units) {
      for (const tenant of unit.tenants) {
        const d = tenant.documents.id(req.params.did);
        if (d) { doc = d; break outer; }
      }
    }
    if (!doc) return res.json({ error: 'Doc not found' });

    const urlPath = new URL(doc.url).pathname;
    const lastSeg = urlPath.split('/').pop();
    const dotIdx  = lastSeg.lastIndexOf('.');
    const format  = dotIdx > 0 ? lastSeg.slice(dotIdx + 1) : '';

    const results = {};
    // Try direct fetch first (no auth)
    const directR = await fetch(doc.url);
    results.directFetch = { status: directR.status, body: (await directR.text()).slice(0, 200) };

    // Try each resource type with private_download_url
    for (const rt of ['image', 'raw', 'video']) {
      const su = cloudinary.utils.private_download_url(doc.cloudinaryId, format, { resource_type: rt, attachment: false });
      const r  = await fetch(su);
      const b  = await r.text().catch(() => '');
      results[`private_dl_${rt}`] = { url: su, status: r.status, body: b.slice(0, 300) };
    }

    // Try Admin API resource lookup
    for (const rt of ['image', 'raw', 'video']) {
      try {
        const info = await cloudinary.api.resource(doc.cloudinaryId, { resource_type: rt });
        results[`admin_api_${rt}`] = { found: true, secure_url: info.secure_url, resource_type: info.resource_type };
      } catch (e) {
        results[`admin_api_${rt}`] = { found: false, error: e.message };
      }
    }

    res.json({
      env: { cloudName, apiKey: apiKey ? 'SET' : 'MISSING', apiSecret: apiSecret ? 'SET' : 'MISSING' },
      doc: { cloudinaryId: doc.cloudinaryId, cloudinaryType: doc.cloudinaryType, url: doc.url, format },
      results,
    });
  } catch (err) { next(err); }
});

export default router;
