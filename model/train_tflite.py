"""
Retrains the sketch-element detector as a TFLite-native model (build plan Phase 1),
replacing the old Faster R-CNN (model/auto-layout/experiments/*) which has no
supported TFLite export path.

Uses TFLite Model Maker's object_detector (EfficientDet-Lite0) instead of hand-rolling
the TF2 Object Detection API's pipeline.config + export_tflite_graph_tf2.py flow -
Model Maker wraps that exact path with a much smaller dependency surface and exports
directly to a ready-to-ship .tflite with baked-in label metadata.

Dataset: model/auto-layout/training_images (342 Pascal VOC jpg+xml pairs, train) and
model/auto-layout/test_images (10 pairs, eval) - these are the same train/eval split
the original eval_labels.csv/train_labels.csv already encoded, just read straight from
the XMLs instead of the CSV.

Label ids kept 1-5 (text/text_input/button/image/switch) matching
model/auto-layout/label_map.pbtxt and auto-layout/lib/detect.js's CLASSES array,
so the mobile app's class-index decoding doesn't need to change.

Run inside the al_train conda env: python train_tflite.py
Output: auto-layout/assets/model/detector.tflite
"""
import os
import ssl

import certifi

# This Python/Windows combo's ssl module hits a known bug enumerating the
# Windows certificate store (ASN1 NOT_ENOUGH_DATA), which breaks the plain
# urllib.request download tensorflow_hub uses to fetch the pretrained
# backbone. Force certifi's CA bundle instead of the OS store.
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

import tensorflow as tf

# tflite-model-maker 0.3.4's object_detector_spec.py calls the old
# tf.keras.mixed_precision.experimental.{Policy,set_policy} aliases, which
# this TF/Keras version (2.9) no longer exposes - shim a namespace back in
# rather than patching the installed package. Both exist under new names.
if not hasattr(tf.keras.mixed_precision, "experimental"):
    class _MixedPrecisionExperimentalShim:
        Policy = staticmethod(tf.keras.mixed_precision.Policy)
        set_policy = staticmethod(tf.keras.mixed_precision.set_global_policy)

    tf.keras.mixed_precision.experimental = _MixedPrecisionExperimentalShim()

from tflite_model_maker import model_spec
from tflite_model_maker import object_detector

HERE = os.path.dirname(os.path.abspath(__file__))
TRAIN_DIR = os.path.join(HERE, "auto-layout", "training_images")
EVAL_DIR = os.path.join(HERE, "auto-layout", "test_images")
OUT_DIR = os.path.join(HERE, "..", "auto-layout", "assets", "model")

LABEL_MAP = {1: "text", 2: "text_input", 3: "button", 4: "image", 5: "switch"}


def main():
    print(f"train dir: {TRAIN_DIR}")
    print(f"eval dir:  {EVAL_DIR}")

    train_data = object_detector.DataLoader.from_pascal_voc(TRAIN_DIR, TRAIN_DIR, label_map=LABEL_MAP)
    val_data = object_detector.DataLoader.from_pascal_voc(EVAL_DIR, EVAL_DIR, label_map=LABEL_MAP)
    print(f"train examples: {len(train_data)}, eval examples: {len(val_data)}")

    spec = model_spec.get("efficientdet_lite0")
    model = object_detector.create(
        train_data,
        model_spec=spec,
        batch_size=4,
        train_whole_model=True,
        epochs=20,
        validation_data=val_data,   
    )

    print("--- eval (Keras model) ---")
    print(model.evaluate(val_data))

    os.makedirs(OUT_DIR, exist_ok=True)
    model.export(export_dir=OUT_DIR, tflite_filename="detector.tflite")
    print(f"wrote {os.path.join(OUT_DIR, 'detector.tflite')}")

    print("--- eval (exported .tflite) ---")
    print(model.evaluate_tflite(os.path.join(OUT_DIR, "detector.tflite"), val_data))


if __name__ == "__main__":
    main()
