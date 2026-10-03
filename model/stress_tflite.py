"""
Robustness check for detector.tflite: perturbs the labeled test images the way
real phone photos differ from the (single-session, 450x600) training set, and
reports F1 at IoU 0.5 / score 0.3 (the app's SCORE_THRESHOLD), letterboxed
top-left like the app now does. Reuses eval_tflite.py's loading and matching.

Usage: python stress_tflite.py [images_dir]
"""
import glob
import io
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

import eval_tflite as E

THR = 0.3


def embed(img, gt, scale, canvas_wh=None, bg=(176, 150, 120)):
    """Place the photo (scaled) centered on a desk-colored canvas; remap GT boxes."""
    w, h = img.size
    cw, ch = canvas_wh or (w, h)
    nw, nh = int(w * scale), int(h * scale)
    canvas = Image.new("RGB", (cw, ch), bg)
    ox, oy = (cw - nw) // 2, (ch - nh) // 2
    canvas.paste(img.resize((nw, nh), Image.BILINEAR), (ox, oy))
    m = [(n, (ox + x0 * nw) / cw, (oy + y0 * nh) / ch, (ox + x1 * nw) / cw, (oy + y1 * nh) / ch) for n, x0, y0, x1, y1 in gt]
    return canvas, m


def jpeg(img, q):
    b = io.BytesIO()
    img.save(b, "JPEG", quality=q)
    return Image.open(io.BytesIO(b.getvalue())).convert("RGB")


def noise(img, sigma=18):
    a = np.asarray(img).astype(np.float32)
    a += np.random.default_rng(0).normal(0, sigma, a.shape)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


SCENARIOS = {
    "baseline": lambda im, gt: (im, gt),
    "dim (x0.5)": lambda im, gt: (ImageEnhance.Brightness(im).enhance(0.5), gt),
    "bright (x1.6)": lambda im, gt: (ImageEnhance.Brightness(im).enhance(1.6), gt),
    "low contrast (x0.5)": lambda im, gt: (ImageEnhance.Contrast(im).enhance(0.5), gt),
    "blur r=2": lambda im, gt: (im.filter(ImageFilter.GaussianBlur(2)), gt),
    "jpeg q=15": lambda im, gt: (jpeg(im, 15), gt),
    "noise s=18": lambda im, gt: (noise(im), gt),
    "grayscale warm cast": lambda im, gt: (Image.merge("RGB", [ImageEnhance.Brightness(c).enhance(f) for c, f in zip(im.split(), (1.15, 1.0, 0.8))]), gt),
    "sketch 70% of frame": lambda im, gt: embed(im, gt, 0.7),
    "sketch 50% of frame": lambda im, gt: embed(im, gt, 0.5),
    "landscape frame 4:3": lambda im, gt: embed(im, gt, 1.0, canvas_wh=(int(im.size[1] * 4 / 3), im.size[1])),
}


def main():
    img_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(E.HERE, "auto-layout", "test_images")
    interp = E.Interpreter(model_path=E.MODEL)
    interp.allocate_tensors()
    inp, outs = interp.get_input_details()[0], interp.get_output_details()
    files = [f for f in sorted(glob.glob(os.path.join(img_dir, "*.jpg"))) if os.path.exists(f[:-4] + ".xml")]
    print(f"{len(files)} images, score>={THR}, IoU>=0.5, letterboxed top-left\n")
    print(f"{'scenario':24s}   P    R    F1   found-any-class")
    for name, fn in SCENARIOS.items():
        tp = fp = fn_ = found = total = 0
        for f in files:
            gt = E.load_gt(f[:-4] + ".xml")
            im, gt2 = fn(Image.open(f).convert("RGB"), gt)
            arr, back = E.prep(im, "pad_tl")
            boxes, classes, scores = E.run(interp, inp, outs, arr)
            preds = []
            for b, c, s in zip(boxes, classes, scores):
                if s < THR:
                    continue
                ymin, xmin, ymax, xmax = back(b)
                preds.append((E.LABELS[int(c)], xmin, ymin, xmax, ymax, s))
            preds.sort(key=lambda p: -p[5])
            used = set()
            for p in preds:
                best, bi = 0, None
                for gi, g in enumerate(gt2):
                    if gi in used or g[0] != p[0]:
                        continue
                    v = E.iou(p[1:5], g[1:5])
                    if v > best:
                        best, bi = v, gi
                if best >= 0.5:
                    tp += 1
                    used.add(bi)
                else:
                    fp += 1
            fn_ += len(gt2) - len(used)
            total += len(gt2)
            found += sum(any(E.iou(p[1:5], g[1:5]) >= 0.5 for p in preds) for g in gt2)
        pr = tp / (tp + fp) if tp + fp else 0
        rc = tp / (tp + fn_) if tp + fn_ else 0
        f1 = 2 * pr * rc / (pr + rc) if pr + rc else 0
        print(f"{name:24s} {pr:.2f} {rc:.2f} {f1:.2f}   {found}/{total}")


if __name__ == "__main__":
    main()
