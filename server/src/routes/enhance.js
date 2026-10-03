const express = require('express');
const mongoose = require('mongoose');
const Sketch = require('../models/Sketch');
const { requireAuth } = require('../middleware/auth');
const { sortIntoRows } = require('../../../auto-layout/lib/layoutSort');
const { generateCode } = require('../../../auto-layout/lib/codeGen');
const gemini = require('../lib/gemini');
const actian = require('../lib/actian');
const cosineFallback = require('../lib/cosineFallback');

const router = express.Router();
router.use(requireAuth);

async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not fetch image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { imageBase64: buf.toString('base64'), mimeType };
}

function describeLayout(predictions) {
  const counts = predictions.reduce((acc, p) => {
    acc[p.object] = (acc[p.object] || 0) + 1;
    return acc;
  }, {});
  return `A mobile UI screen with ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`;
}

// Structured signal for actian.js's hybrid fusion filter - the distinct
// ELEMENT_TYPES actually detected in this sketch (see lib/elementTypes.js),
// alongside describeLayout's free-text description used for the semantic half.
function tagsFromPredictions(predictions) {
  return [...new Set(predictions.map((p) => p.object))];
}

// Fire-and-forget from the client's perspective (short client-side timeout) -
// this endpoint itself still runs to completion and persists the result, so a
// slow response the client gave up on isn't wasted work.
// Whole handler wrapped in try/catch - an unhandled rejection in an async
// Express 4 route handler isn't caught by the app-level error middleware
// (that only sees errors passed via next()), it crashes the whole process.
// This route in particular gets called with client-generated local sketch
// ids (see auto-layout/lib/localStore.js) that aren't synced yet - a bad
// ObjectId used to take the entire server down for every user, not just
// return an error to the one caller that sent it.
router.post('/', async (req, res) => {
  try {
    const { sketchId, instruction } = req.body;
    if (!mongoose.isValidObjectId(sketchId)) {
      return res.status(400).json({ error: 'invalid sketchId - has this sketch synced to the server yet?' });
    }

    const sketch = await Sketch.findOne({ _id: sketchId, from: req.user.email });
    if (!sketch) return res.status(404).json({ error: 'not found' });
    // Idempotent only for the plain (no style instruction) case - a new instruction
    // means the user wants a re-styled result, so always re-run for that.
    if (sketch.enhanced_code && !instruction) {
      return res.json({
        enhanced_code: sketch.enhanced_code,
        theme: sketch.enhanced_theme,
        labels: sketch.enhanced_labels,
      });
    }

    const predictions = sketch.predictions.map((p, i) => ({ ...p.toObject(), _idx: i }));

    const { imageBase64, mimeType } = await fetchAsBase64(sketch.image_url);
    const [suggestion, style] = await Promise.all([
      gemini.suggestContent({ imageBase64, mimeType, predictions, instruction }).catch(() => ({})),
      actian.findClosestPattern(describeLayout(predictions), tagsFromPredictions(predictions)).catch(() =>
        cosineFallback.findClosestPattern(describeLayout(predictions)).catch(() => null)
      ),
    ]);

    const labels = {};
    for (const l of suggestion.labels || []) labels[l.index] = l.text;

    // style (the RAG pattern lookup) is based only on element counts
    // (describeLayout), not the user's instruction - it's a good default
    // when there's no instruction, but must not override what Gemini/OpenRouter
    // produced *from* the instruction, or typing "dark mode" would silently
    // do nothing whenever a pattern match happens to exist.
    const theme = (instruction && suggestion.theme) || style || suggestion.theme;
    const rows = sortIntoRows(predictions);
    const enhanced_code = generateCode(rows, { theme, labels, name: sketch.name });

    sketch.enhanced_code = enhanced_code;
    sketch.enhanced_theme = theme;
    sketch.enhanced_labels = labels;
    sketch.enhanced_at = new Date();
    await sketch.save();

    res.json({ enhanced_code, theme, labels });
  } catch (err) {
    res.status(502).json({ error: 'enhance failed', detail: err.message });
  }
});

module.exports = router;
