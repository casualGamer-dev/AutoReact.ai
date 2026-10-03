const express = require('express');
const Sketch = require('../models/Sketch');
const { requireAuth } = require('../middleware/auth');
const { presignUpload, deleteObject, keyFromUrl } = require('../lib/r2');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function ownedSketch(req) {
  return { from: req.user.email };
}

// Idempotent when clientId is given: the mobile sync queue may retry this
// call (e.g. it fired offline and got queued, then the app also retried it
// on the next reconnect) - upserting on (from, clientId) means a retry finds
// the existing doc instead of creating a duplicate.
router.post('/', asyncHandler(async (req, res) => {
  const { name, clientId } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  if (clientId) {
    const sketch = await Sketch.findOneAndUpdate(
      { from: req.user.email, clientId },
      { $setOnInsert: { name, from: req.user.email, clientId } },
      { new: true, upsert: true }
    );
    return res.status(201).json(sketch);
  }

  const sketch = await Sketch.create({ name, from: req.user.email });
  res.status(201).json(sketch);
}));

router.get('/', asyncHandler(async (req, res) => {
  const sketches = await Sketch.find(ownedSketch(req)).sort({ createdAt: -1 });
  res.json(sketches);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const sketch = await Sketch.findOne({ _id: req.params.id, ...ownedSketch(req) });
  if (!sketch) return res.status(404).json({ error: 'not found' });
  res.json(sketch);
}));

// Client asks for a short-lived R2 upload URL, PUTs the file directly to R2,
// then calls PATCH below with the returned publicUrl - server never proxies the bytes.
router.post('/:id/upload-url', asyncHandler(async (req, res) => {
  const { contentType, field } = req.body; // field: 'image_url' | 'predicted_url'
  if (!['image_url', 'predicted_url'].includes(field)) {
    return res.status(400).json({ error: 'field must be image_url or predicted_url' });
  }
  const sketch = await Sketch.findOne({ _id: req.params.id, ...ownedSketch(req) });
  if (!sketch) return res.status(404).json({ error: 'not found' });

  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const key = `${req.user.email}/${sketch._id}-${field}.${ext}`;
  const { uploadUrl, publicUrl } = await presignUpload(key, contentType);
  res.json({ uploadUrl, publicUrl });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const allowed = ['image_url', 'predicted_url', 'code_url', 'code', 'predictions', 'num_predictions', 'width', 'height'];
  const updates = {};
  for (const field of allowed) if (field in req.body) updates[field] = req.body[field];

  const sketch = await Sketch.findOneAndUpdate({ _id: req.params.id, ...ownedSketch(req) }, updates, { new: true });
  if (!sketch) return res.status(404).json({ error: 'not found' });
  res.json(sketch);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const sketch = await Sketch.findOneAndDelete({ _id: req.params.id, ...ownedSketch(req) });
  if (!sketch) return res.status(404).json({ error: 'not found' });

  await Promise.all(
    [sketch.image_url, sketch.predicted_url, sketch.code_url]
      .map(keyFromUrl)
      .filter(Boolean)
      .map((key) => deleteObject(key).catch(() => {})) // best-effort; doc is already gone
  );
  res.status(204).end();
}));

// Bulk delete, backs the "remove all sketches" menu.
router.delete('/', asyncHandler(async (req, res) => {
  const sketches = await Sketch.find(ownedSketch(req));
  await Promise.all(
    sketches.flatMap((s) => [s.image_url, s.predicted_url, s.code_url])
      .map(keyFromUrl)
      .filter(Boolean)
      .map((key) => deleteObject(key).catch(() => {}))
  );
  await Sketch.deleteMany(ownedSketch(req));
  res.status(204).end();
}));

module.exports = router;
