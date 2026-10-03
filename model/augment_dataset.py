"""
Builds model/auto-layout/training_images_aug: the original 342 Pascal VOC pairs
plus N augmented variants of each, targeting the weak spots stress_tflite.py found
(dim light; sketch small in frame) and the ways phone photos differ from the
single-session 450x600 training set:

  - zoom-out: photo pasted at 40-100% scale on a desk-like background, on a
    portrait / landscape / square canvas (boxes remapped exactly)
  - small rotation (+-6 deg): boxes become the enclosing box of the rotated corners
  - brightness 0.4-1.4, contrast 0.5-1.2, per-channel color cast
  - blur, sensor noise, JPEG compression

Never touches test_images (eval stays clean). Deterministic (seeded).
Usage: python augment_dataset.py [--per-image 4]
"""
import glob
import io
import math
import os
import random
import shutil
import sys
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "auto-layout", "training_images")
DST = os.path.join(HERE, "auto-layout", "training_images_aug")
MIN_VISIBLE = 0.6  # drop a box if less than this fraction survives clipping


def read(xml_path):
    r = ET.parse(xml_path).getroot()
    objs = []
    for o in r.findall("object"):
        b = o.find("bndbox")
        objs.append([o.find("name").text] + [float(b.find(k).text) for k in ("xmin", "ymin", "xmax", "ymax")])
    return objs


def write(path_xml, filename, size, objs):
    w, h = size
    a = ET.Element("annotation")
    ET.SubElement(a, "folder").text = "images-voc-aug"
    ET.SubElement(a, "filename").text = filename
    s = ET.SubElement(a, "size")
    for k, v in (("width", w), ("height", h), ("depth", 3)):
        ET.SubElement(s, k).text = str(v)
    ET.SubElement(a, "segmented").text = "0"
    for n, x0, y0, x1, y1 in objs:
        o = ET.SubElement(a, "object")
        ET.SubElement(o, "name").text = n
        ET.SubElement(o, "pose").text = "Unspecified"
        ET.SubElement(o, "truncated").text = "0"
        ET.SubElement(o, "difficult").text = "0"
        b = ET.SubElement(o, "bndbox")
        for k, v in (("xmin", x0), ("ymin", y0), ("xmax", x1), ("ymax", y1)):
            ET.SubElement(b, k).text = str(int(round(v)))
    ET.ElementTree(a).write(path_xml)


def desk(rng, size):
    w, h = size
    base = np.array(rng.choice([(176, 150, 120), (120, 120, 125), (205, 200, 190), (90, 70, 55), (60, 62, 68), (225, 222, 215)]), np.float32)
    base += np.array([rng.uniform(-18, 18) for _ in range(3)], np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    grad = 1 + 0.15 * ((xx / w - 0.5) * rng.uniform(-1, 1) + (yy / h - 0.5) * rng.uniform(-1, 1))
    a = np.clip(base[None, None, :] * grad[..., None] + np.random.default_rng(rng.randrange(1 << 30)).normal(0, 6, (h, w, 3)), 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def zoom_out(img, objs, rng):
    w, h = img.size
    canvas = rng.choice([(w, h), (w, h), (h, w), (max(w, h), max(w, h))])  # portrait, portrait, landscape, square
    scale = rng.uniform(0.4, 1.0)
    k = scale * min(canvas[0] / w, canvas[1] / h)
    nw, nh = max(1, int(w * k)), max(1, int(h * k))
    ox = rng.randint(0, max(0, canvas[0] - nw))
    oy = rng.randint(0, max(0, canvas[1] - nh))
    bg = desk(rng, canvas)
    bg.paste(img.resize((nw, nh), Image.BILINEAR), (ox, oy))
    return bg, [[n, ox + x0 * k, oy + y0 * k, ox + x1 * k, oy + y1 * k] for n, x0, y0, x1, y1 in objs]


def rotate(img, objs, rng, max_deg=6):
    deg = rng.uniform(-max_deg, max_deg)
    w, h = img.size
    out = img.rotate(deg, resample=Image.BILINEAR, expand=True, fillcolor=tuple(int(c) for c in np.asarray(img)[0, 0]))
    nw, nh = out.size
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    cx, cy, ncx, ncy = w / 2, h / 2, nw / 2, nh / 2
    res = []
    for n, x0, y0, x1, y1 in objs:
        pts = []
        for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
            dx, dy = x - cx, y - cy
            # PIL rotates counter-clockwise by deg in image (y-down) coordinates
            pts.append((ncx + dx * c + dy * s, ncy - dx * s + dy * c))
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        res.append([n, min(xs), min(ys), max(xs), max(ys)])
    return out, res


def photometric(img, rng):
    img = ImageEnhance.Brightness(img).enhance(rng.choice([rng.uniform(0.4, 0.8), rng.uniform(0.8, 1.4)]))
    img = ImageEnhance.Contrast(img).enhance(rng.uniform(0.5, 1.2))
    r, g, b = img.split()
    f = [rng.uniform(0.85, 1.15) for _ in range(3)]
    img = Image.merge("RGB", [ImageEnhance.Brightness(c).enhance(x) for c, x in zip((r, g, b), f)])
    if rng.random() < 0.4:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.5, 1.5)))
    if rng.random() < 0.4:
        a = np.asarray(img).astype(np.float32) + np.random.default_rng(rng.randrange(1 << 30)).normal(0, rng.uniform(4, 16), (img.size[1], img.size[0], 3))
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return img


def clip(objs, size):
    w, h = size
    out = []
    for n, x0, y0, x1, y1 in objs:
        area = max(0.0, x1 - x0) * max(0.0, y1 - y0)
        cx0, cy0, cx1, cy1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        carea = max(0.0, cx1 - cx0) * max(0.0, cy1 - cy0)
        if area > 0 and carea / area >= MIN_VISIBLE and cx1 - cx0 >= 4 and cy1 - cy0 >= 4:
            out.append([n, cx0, cy0, cx1, cy1])
    return out


def main():
    per = int(sys.argv[sys.argv.index("--per-image") + 1]) if "--per-image" in sys.argv else 4
    if os.path.isdir(DST):
        shutil.rmtree(DST)
    os.makedirs(DST)
    rng = random.Random(1234)
    n_img = n_obj = dropped = 0
    for jpg in sorted(glob.glob(os.path.join(SRC, "*.jpg"))):
        stem = os.path.basename(jpg)[:-4]
        xml = os.path.join(SRC, stem + ".xml")
        if not os.path.exists(xml):
            continue
        shutil.copy(jpg, DST)
        shutil.copy(xml, DST)
        img0, objs0 = Image.open(jpg).convert("RGB"), read(xml)
        for k in range(per):
            img, objs = img0, [o[:] for o in objs0]
            if rng.random() < 0.75:
                img, objs = zoom_out(img, objs, rng)
            if rng.random() < 0.5:
                img, objs = rotate(img, objs, rng)
            img = photometric(img, rng)
            if rng.random() < 0.6:
                b = io.BytesIO()
                img.save(b, "JPEG", quality=rng.randint(25, 90))
                img = Image.open(io.BytesIO(b.getvalue())).convert("RGB")
            kept = clip(objs, img.size)
            dropped += len(objs) - len(kept)
            if not kept:
                continue
            name = f"{stem}_aug{k}"
            img.save(os.path.join(DST, name + ".jpg"), quality=92)
            write(os.path.join(DST, name + ".xml"), name + ".jpg", img.size, kept)
            n_img += 1
            n_obj += len(kept)
    print(f"wrote {n_img} augmented images ({n_obj} boxes, {dropped} boxes dropped as mostly clipped) + 342 originals -> {DST}")


if __name__ == "__main__":
    main()
