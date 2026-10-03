const express = require('express');
const Correction = require('../models/Correction');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.post('/', asyncHandler(async (req, res) => {
  const { sketchId, corrections } = req.body;
  if (!sketchId || !Array.isArray(corrections) || corrections.length === 0) {
    return res.status(400).json({ error: 'sketchId and a non-empty corrections array required' });
  }

  const docs = corrections.map((c) => ({ ...c, sketchId, owner: req.user.email }));
  await Correction.insertMany(docs);
  res.status(201).json({ inserted: docs.length });
}));

module.exports = router;
