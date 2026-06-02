import express from 'express';
import Maintenance from '../models/Maintenance.js';
import { txMaint } from '../utils/transform.js';
import { verifyJWT } from '../middleware/auth.js';

const router = express.Router();

// GET /api/maintenance — open read
router.get('/maintenance', async (req, res, next) => {
  try {
    const entries = await Maintenance.find().sort({ createdAt: -1 });
    res.json(entries.map(txMaint));
  } catch (err) { next(err); }
});

// POST /api/maintenance
router.post('/maintenance', verifyJWT, async (req, res, next) => {
  try {
    const entry = await Maintenance.create(req.body);
    res.status(201).json(txMaint(entry));
  } catch (err) { next(err); }
});

// PUT /api/maintenance/:id
router.put('/maintenance/:id', verifyJWT, async (req, res, next) => {
  try {
    const entry = await Maintenance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(txMaint(entry));
  } catch (err) { next(err); }
});

export default router;
