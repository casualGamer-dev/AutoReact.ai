"""
GPU training run for the sketch-element detector (EfficientDet-Lite0), inside the
autolayout-train container (see Dockerfile.train). Same recipe as train_tflite.py but:
  - trains on training_images_aug (originals + augmented variants; see augment_dataset.py)
  - writes a CANDIDATE to candidates/, never over the shipped detector.tflite -
    compare with eval_tflite.py / stress_tflite.py and adopt only if it is better.

Env: TRAIN_DIR (default auto-layout/training_images_aug), EVAL_DIR, EPOCHS, BATCH, OUT.
"""
import os

import tensorflow as tf

print("GPUs visible to TF:", tf.config.list_physical_devices("GPU"))
for g in tf.config.list_physical_devices("GPU"):
    tf.config.experimental.set_memory_growth(g, True)  # 4 GB card: don't grab it all up front

# tflite-model-maker 0.3.4 calls the removed experimental mixed-precision aliases (see train_tflite.py)
if not hasattr(tf.keras.mixed_precision, "experimental"):
    class _Shim:
        Policy = staticmethod(tf.keras.mixed_precision.Policy)
        set_policy = staticmethod(tf.keras.mixed_precision.set_global_policy)

    tf.keras.mixed_precision.experimental = _Shim()

from tflite_model_maker import model_spec, object_detector

HERE = os.path.dirname(os.path.abspath(__file__))
TRAIN_DIR = os.environ.get("TRAIN_DIR", os.path.join(HERE, "auto-layout", "training_images_aug"))
EVAL_DIR = os.environ.get("EVAL_DIR", os.path.join(HERE, "auto-layout", "test_images"))
OUT = os.environ.get("OUT", os.path.join(HERE, "candidates", "detector_aug.tflite"))
EPOCHS = int(os.environ.get("EPOCHS", "40"))
BATCH = int(os.environ.get("BATCH", "8"))
LABEL_MAP = {1: "text", 2: "text_input", 3: "button", 4: "image", 5: "switch"}  # ids as in label_map.pbtxt


def main():
    train = object_detector.DataLoader.from_pascal_voc(TRAIN_DIR, TRAIN_DIR, label_map=LABEL_MAP)
    val = object_detector.DataLoader.from_pascal_voc(EVAL_DIR, EVAL_DIR, label_map=LABEL_MAP)
    print(f"train {len(train)}  eval {len(val)}  epochs {EPOCHS}  batch {BATCH}")

    model = object_detector.create(
        train,
        model_spec=model_spec.get("efficientdet_lite0"),
        batch_size=BATCH,
        train_whole_model=True,
        epochs=EPOCHS,
        validation_data=val,
    )
    print("--- eval (Keras) ---")
    print(model.evaluate(val))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    model.export(export_dir=os.path.dirname(OUT), tflite_filename=os.path.basename(OUT))
    print("wrote", OUT)
    print("--- eval (exported tflite) ---")
    print(model.evaluate_tflite(OUT, val))


if __name__ == "__main__":
    main()
