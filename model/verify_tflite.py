"""
Phase 1 verification step from the build plan: sanity-check the exported .tflite
against held-out test_images before it ships to the mobile app. Run inside the
al_train conda env: python verify_tflite.py
"""
import os
import glob

import numpy as np
from PIL import Image
import tensorflow as tf

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "..", "auto-layout", "assets", "model", "detector.tflite")
TEST_DIR = os.path.join(HERE, "auto-layout", "test_images")
LABELS = {0: "text", 1: "text_input", 2: "button", 3: "image", 4: "switch"}
SCORE_THRESHOLD = 0.5


def main():
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    print("input:", input_details[0]["shape"], input_details[0]["dtype"])
    for o in output_details:
        print("output:", o["name"], o["shape"], o["dtype"])

    _, in_h, in_w, _ = input_details[0]["shape"]

    for path in sorted(glob.glob(os.path.join(TEST_DIR, "*.jpg")))[:5]:
        img = Image.open(path).convert("RGB").resize((in_w, in_h))
        input_data = np.expand_dims(np.array(img), axis=0)
        if input_details[0]["dtype"] == np.float32:
            input_data = input_data.astype(np.float32) / 255.0
        else:
            input_data = input_data.astype(input_details[0]["dtype"])

        interpreter.set_tensor(input_details[0]["index"], input_data)
        interpreter.invoke()

        # Model Maker's converter does NOT follow the classic SSD
        # TFLite_Detection_PostProcess [boxes,classes,scores,count] output order
        # (confirmed empirically - this model's order is [scores,boxes,count,classes]).
        # Identify each output by shape/value signature instead of a hardcoded
        # index, so this keeps working across retrains even if the order shifts.
        tensors = [interpreter.get_tensor(o["index"]) for o in output_details]
        boxes = next(t[0] for t in tensors if t.ndim == 3 and t.shape[-1] == 4)
        count = int(next(t for t in tensors if t.size == 1).flatten()[0])
        rank1 = [t[0] for t in tensors if t.ndim == 2 and t.shape[-1] != 4]
        # classes are integer-valued (0..num_classes-1); scores are near-continuous floats.
        a_is_classes = np.allclose(rank1[0], np.round(rank1[0]), atol=1e-3)
        classes, scores = rank1 if a_is_classes else rank1[::-1]

        print(f"\n{os.path.basename(path)} ({count} raw detections)")
        for i in range(len(scores)):
            if scores[i] >= SCORE_THRESHOLD:
                label = LABELS.get(int(classes[i]), f"class#{int(classes[i])}")
                print(f"  {label:12s} score={scores[i]:.2f} box(ymin,xmin,ymax,xmax)={boxes[i]}")


if __name__ == "__main__":
    main()
