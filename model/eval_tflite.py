"""
Offline eval of auto-layout/assets/model/detector.tflite on labeled images,
without TensorFlow (uses ai-edge-litert: pip install ai-edge-litert pillow numpy).

Compares how the photo is fed to the model, since the mobile app's choice has to
match how Model Maker trained it:
  squash   - resize to 320x320, aspect ignored
  pad_tl   - scale to fit, pad bottom/right with zeros (letterbox, top-left anchored;
             what the app does today, see decodeImage.js)
  pad_c    - scale to fit, pad evenly on both sides (centered letterbox)

Metrics at IoU >= 0.5, class-aware greedy matching: precision / recall / F1,
plus class-agnostic recall (did it find the element at all).

Usage: python eval_tflite.py [images_dir] [--thr 0.3,0.5]
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "..", "auto-layout", "assets", "model", "detector.tflite")
LABELS = ["text", "text_input", "button", "image", "switch"]  # output class idx order
S = 320


def load_gt(xml_path):
    r = ET.parse(xml_path).getroot()
    w, h = int(r.find("size/width").text), int(r.find("size/height").text)
    out = []
    for o in r.findall("object"):
        b = o.find("bndbox")
        x0, y0, x1, y1 = [float(b.find(k).text) for k in ("xmin", "ymin", "xmax", "ymax")]
        out.append((o.find("name").text, x0 / w, y0 / h, x1 / w, y1 / h))
    return out


def prep(img, mode):
    """returns (uint8 [S,S,3], map_fn from model-normalized box -> image-normalized box)"""
    w, h = img.size
    if mode == "squash":
        return np.asarray(img.resize((S, S), Image.BILINEAR)), lambda b: b
    k = S / max(w, h)
    nw, nh = round(w * k), round(h * k)
    canvas = np.zeros((S, S, 3), np.uint8)
    ox, oy = ((S - nw) // 2, (S - nh) // 2) if mode == "pad_c" else (0, 0)
    canvas[oy : oy + nh, ox : ox + nw] = np.asarray(img.resize((nw, nh), Image.BILINEAR))

    def back(b):  # b = (ymin,xmin,ymax,xmax) normalized to the 320 canvas
        ymin, xmin, ymax, xmax = b
        return ((ymin * S - oy) / nh, (xmin * S - ox) / nw, (ymax * S - oy) / nh, (xmax * S - ox) / nw)

    return canvas, back


def iou(a, b):
    ix0, iy0, ix1, iy1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0


def run(interp, inp, outs, arr):
    interp.set_tensor(inp["index"], arr[None].astype(inp["dtype"]))
    interp.invoke()
    t = [interp.get_tensor(o["index"]) for o in outs]
    boxes = next(x[0] for x in t if x.ndim == 3 and x.shape[-1] == 4)
    count = int(next(x for x in t if x.size == 1).flatten()[0])
    r1 = [x[0] for x in t if x.ndim == 2 and x.shape[-1] != 4]
    cls_first = np.allclose(r1[0], np.round(r1[0]), atol=1e-3)
    classes, scores = r1 if cls_first else r1[::-1]
    return boxes[:count], classes[:count], scores[:count]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    img_dir = args[0] if args else os.path.join(HERE, "auto-layout", "test_images")
    thrs = [0.3, 0.5]
    if "--thr" in sys.argv:
        thrs = [float(x) for x in sys.argv[sys.argv.index("--thr") + 1].split(",")]

    interp = Interpreter(model_path=MODEL)
    interp.allocate_tensors()
    inp, outs = interp.get_input_details()[0], interp.get_output_details()
    print("input", inp["shape"], inp["dtype"].__name__)

    files = [f for f in sorted(glob.glob(os.path.join(img_dir, "*.jpg"))) if os.path.exists(f[:-4] + ".xml")]
    print(f"{len(files)} images from {img_dir}\n")
    for mode in ("squash", "pad_tl", "pad_c"):
        for thr in thrs:
            tp = fp = fn = found = total = 0
            for f in files:
                gt = load_gt(f[:-4] + ".xml")
                arr, back = prep(Image.open(f).convert("RGB"), mode)
                boxes, classes, scores = run(interp, inp, outs, arr)
                preds = []
                for b, c, s in zip(boxes, classes, scores):
                    if s < thr:
                        continue
                    ymin, xmin, ymax, xmax = back(b)
                    preds.append((LABELS[int(c)], xmin, ymin, xmax, ymax, s))
                preds.sort(key=lambda p: -p[5])
                used = set()
                for p in preds:
                    best, bi = 0, None
                    for gi, g in enumerate(gt):
                        if gi in used or g[0] != p[0]:
                            continue
                        v = iou(p[1:5], g[1:5])
                        if v > best:
                            best, bi = v, gi
                    if best >= 0.5:
                        tp += 1
                        used.add(bi)
                    else:
                        fp += 1
                fn += len(gt) - len(used)
                total += len(gt)
                found += sum(any(iou(p[1:5], g[1:5]) >= 0.5 for p in preds) for g in gt)
            pr = tp / (tp + fp) if tp + fp else 0
            rc = tp / (tp + fn) if tp + fn else 0
            f1 = 2 * pr * rc / (pr + rc) if pr + rc else 0
            print(f"{mode:7s} thr={thr:.1f}  P={pr:.2f} R={rc:.2f} F1={f1:.2f}  found-any-class={found}/{total}  (tp={tp} fp={fp} fn={fn})")
        print()


if __name__ == "__main__":
    main()
