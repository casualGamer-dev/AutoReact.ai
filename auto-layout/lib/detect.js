// On-device detection, replacing the Google Cloud AI Platform `ml.projects.predict`
// call in FUNCTIONS/functions/index.js. Class mapping/box math ported from that
// file's lines 299-335, verified against model/auto-layout/label_map.pbtxt (ids
// 1-5: text, text_input, button, image, switch).
//
// Trained via TFLite Model Maker (model/train_tflite.py, EfficientDet-Lite0).
// detector.tflite now exists (Phase 1 done) - output tensor order was checked
// against the real exported model (not assumed): Model Maker's converter does
// NOT use the classic SSD TFLite_Detection_PostProcess [boxes,classes,scores,count]
// order. Actual order (verified via interpreter.get_output_details() +
// inspecting raw values in model/verify_tflite.py) is [scores, boxes, count, classes].
// react-native-fast-tflite's runSync() returns outputs in the model's native
// tensor-index order, same as get_output_details(), so this should carry over -
// but re-confirm with a console.log on first real device run, since that's the
// one link in this chain nobody's tested outside plain Python yet.
import { loadTensorflowModel } from 'react-native-fast-tflite';
import { ELEMENT_TYPES } from './elementTypes';

export const INPUT_SIZE = 320;
// 0.5 (matching model/verify_tflite.py) is the "principled" value once the
// real pipeline bug (landing.js's pre-crop) was fixed, but the model itself
// is only trained on 342 images / 20 epochs (overall AP=0.73, not the
// coarser AP50=1.0 figure) - it's genuinely not confident on busier sketches.
// Lowered further so more real elements surface as *something* to correct
// via reviewDetections.js's tap-to-cycle screen, rather than being silently
// dropped. Trade-off: more low-quality/duplicate boxes too - this is a
// stopgap for a model that needs more training data, not a real fix.
export const SCORE_THRESHOLD = 0.3;

// index = TFLite_Detection_PostProcess class id + 1 (that op emits 0-indexed
// classes; index 0 here is unused padding to line up with label_map.pbtxt's 1-based ids).
const CLASSES = ['', ...ELEMENT_TYPES];

let modelPromise = null;
function loadModel() {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(require('../assets/model/detector.tflite')).catch((err) => {
      modelPromise = null;
      throw new Error(
        `on-device model failed to load (has assets/model/detector.tflite been dropped in from the Phase 1 export?): ${err.message}`
      );
    });
  }
  return modelPromise;
}

// pixelData: Uint8Array RGB, length INPUT_SIZE*INPUT_SIZE*3 (see lib/decodeImage.js).
// originalWidth/Height: source photo dimensions, used to scale normalized box
// coords back to real pixel positions (matches index.js).
// contentWidth/Height: size of the photo inside the INPUT_SIZE canvas when it was
// letterboxed (top-left, zero padded - see decodeImage.js). Model boxes are
// normalized to the whole canvas, so they are rescaled to the photo itself.
// Defaults (whole canvas) keep the old stretched-input behaviour.
export async function detect(
  pixelData,
  originalWidth,
  originalHeight,
  contentWidth = INPUT_SIZE,
  contentHeight = INPUT_SIZE
) {
  const model = await loadModel();

  // TEMP diagnostic: pin down exactly what's undefined before it crosses the
  // native bridge as a vague "value is undefined, expected an object" error.
  console.log('[detect] pixelData:', pixelData?.constructor?.name, pixelData?.length);
  if (!(pixelData instanceof Uint8Array) || pixelData.length !== INPUT_SIZE * INPUT_SIZE * 3) {
    throw new Error(
      `detect: bad pixelData - got ${pixelData?.constructor?.name} length ${pixelData?.length}, expected Uint8Array length ${INPUT_SIZE * INPUT_SIZE * 3}`
    );
  }

  console.log('[detect] model.inputs:', JSON.stringify(model.inputs));
  console.log('[detect] model.outputs:', JSON.stringify(model.outputs));
  console.log('[detect] model.delegate:', model.delegate);

  let outputs;
  try {
    outputs = model.runSync([pixelData]);
  } catch (err) {
    console.log('[detect] runSync threw:', err?.message, JSON.stringify(err));
    throw err;
  }
  console.log('[detect] runSync returned:', outputs?.constructor?.name, outputs?.length);

  const [scores, boxes, numDetections, classes] = outputs;
  const n = Math.round(numDetections[0]);

  // TEMP diagnostic (see RUNBOOK.md's "first real device run" note) - remove
  // once output order/thresholding is confirmed sane on real hardware.
  console.log('[detect] output shapes:', outputs.map((o) => o.length));
  console.log('[detect] numDetections:', n);
  console.log('[detect] raw scores:', Array.from(scores).slice(0, 10));
  console.log('[detect] raw classes:', Array.from(classes).slice(0, 10));
  console.log('[detect] raw boxes[0..8]:', Array.from(boxes).slice(0, 8));

  const predictions = [];
  for (let i = 0; i < n; i++) {
    if (scores[i] < SCORE_THRESHOLD) continue;

    const fx = INPUT_SIZE / contentWidth;
    const fy = INPUT_SIZE / contentHeight;
    const ymin = Math.max(0, boxes[i * 4] * fy);
    const xmin = Math.max(0, boxes[i * 4 + 1] * fx);
    const ymax = Math.min(1, boxes[i * 4 + 2] * fy);
    const xmax = Math.min(1, boxes[i * 4 + 3] * fx);

    const x0 = xmin * originalWidth;
    const y0 = ymin * originalHeight;
    const x1 = xmax * originalWidth;
    const y1 = ymax * originalHeight;

    predictions.push({
      object: CLASSES[Math.round(classes[i]) + 1] || 'Unknown',
      accuracy: scores[i],
      x0,
      y0,
      x1,
      y1,
      width: x1 - x0,
      height: y1 - y0,
    });
  }
  return predictions;
}
