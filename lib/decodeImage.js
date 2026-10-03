import { decode as decodeJpeg } from 'jpeg-js';
import { toByteArray } from 'base64-js';

// Decodes a base64 JPEG (from ImageManipulator's { base64: true } output) into
// a flat RGB Uint8Array for the TFLite model. Pure JS (jpeg-js), no native
// image-decode module needed - this was the pixelsFromBase64Jpeg() stub in
// landing.js, now a real implementation.
//
// Assumes an INT8-quantized model input (uint8, 0-255, no normalization),
// which is TFLite Model Maker's default object-detector export - confirm
// against model/verify_tflite.py's printed input dtype once Phase 1's model
// exports. If it turns out float32-normalized instead, divide `rgb` by 255.
//
// canvasSize: when given, the decoded image is placed at the TOP-LEFT of a
// zero-filled canvasSize x canvasSize square (letterbox padding) instead of
// being returned as-is. That is how Model Maker feeds the detector during
// training/eval: model/eval_tflite.py measured recall 1.00 padded vs 0.93
// stretched (IoU 0.5, score 0.5) on the held-out test images.
export function pixelsFromBase64Jpeg(base64, expectedWidth, expectedHeight, canvasSize) {
  const jpegBytes = toByteArray(base64);
  const { data, width, height } = decodeJpeg(jpegBytes, { useTArray: true });

  if (width !== expectedWidth || height !== expectedHeight) {
    console.warn(`decoded JPEG is ${width}x${height}, expected ${expectedWidth}x${expectedHeight}`);
  }

  const outW = canvasSize || width;
  const outH = canvasSize || height;
  // jpeg-js always decodes to RGBA - drop the alpha channel for the RGB input the model expects.
  const rgb = new Uint8Array(outW * outH * 3);
  for (let y = 0; y < Math.min(height, outH); y++) {
    for (let x = 0; x < Math.min(width, outW); x++) {
      const i = (y * width + x) * 4;
      const j = (y * outW + x) * 3;
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
  }
  return rgb;
}
