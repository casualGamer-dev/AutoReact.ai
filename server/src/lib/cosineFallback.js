// ponytail: global in-Mongo scan, fine at pattern-library scale (tens of rows).
// Fallback for findClosestPattern if Actian isn't configured/working - same
// call shape as lib/actian.js's findClosestPattern so callers don't branch.
const Pattern = require('../models/Pattern');
const { embedText } = require('./gemini');

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function findClosestPattern(layoutDescription) {
  const queryVector = await embedText(layoutDescription);
  const patterns = await Pattern.find({ vector: { $exists: true } }).lean();
  if (patterns.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const p of patterns) {
    const score = cosineSimilarity(queryVector, p.vector);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best?.style || null;
}

module.exports = { findClosestPattern };
