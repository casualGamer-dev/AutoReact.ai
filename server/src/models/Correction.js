const mongoose = require('mongoose');

// Logs tap-to-correct fixes from ReviewDetections (auto-layout/pages/reviewDetections.js).
// Not consumed anywhere yet - this is the raw material for a future retrain
// (export to Pascal VOC / CSV alongside the existing labeled set once there's
// enough volume to be worth it), kept separate from Sketch so corrections
// survive even if a sketch gets deleted later.
const correctionSchema = new mongoose.Schema({
  sketchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sketch', required: true },
  owner: { type: String, required: true, index: true }, // email
  originalObject: { type: String, required: true },
  correctedObject: { type: String, required: true },
  x0: Number,
  y0: Number,
  x1: Number,
  y1: Number,
}, { timestamps: true });

module.exports = mongoose.model('Correction', correctionSchema);
