const mongoose = require('mongoose');

// Field names kept 1:1 with the old Firestore 'sketches' collection so the
// mobile app's existing doc shape (predictions[], predicted_url, code_url, ...)
// needed no reshaping on the client.
const predictionSchema = new mongoose.Schema({
  object: String,
  accuracy: Number,
  x0: Number,
  y0: Number,
  x1: Number,
  y1: Number,
  width: Number,
  height: Number,
}, { _id: false });

const sketchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  from: { type: String, required: true, index: true }, // owner email
  // Client-generated id (see auto-layout/lib/localStore.js), set once at local
  // creation time so a sketch can be used offline before it ever reaches the
  // server. Lets the sync queue retry POST / safely - same clientId always
  // resolves to the same doc instead of creating a duplicate.
  clientId: { type: String, index: true, sparse: true },
  image_url: { type: String, default: '' },
  predicted_url: { type: String, default: '' },
  code_url: { type: String, default: '' },
  code: { type: String, default: '' }, // generated source, stored inline (small, avoids an extra R2 round trip)
  predictions: { type: [predictionSchema], default: [] },
  num_predictions: { type: Number, default: 0 },
  width: Number,
  height: Number,
  enhanced_code: { type: String, default: '' },
  // theme/labels are the same data enhance.js fed into codeGen.generateCode()
  // to produce enhanced_code - kept separately so the client can also apply
  // them to the live component preview (displayLayout.js), not just the
  // generated source-code string.
  enhanced_theme: mongoose.Schema.Types.Mixed,
  enhanced_labels: mongoose.Schema.Types.Mixed,
  enhanced_at: Date,
}, { timestamps: true });

// sparse: docs without a clientId (created some other way) don't collide on
// null; docs that do have one can't be double-created by a retried sync.
sketchSchema.index({ from: 1, clientId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Sketch', sketchSchema);
