import fitz
import numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"

pdf_path = next(p for p in PUBLIC_DIR.iterdir() if p.suffix.lower() == ".pdf")
doc = fitz.open(pdf_path)
page = doc[0]

ZOOM = 6
pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=False)
img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

arr = np.array(img)
not_white = np.any(arr < 245, axis=2)
labeled, num = ndimage.label(not_white)
sizes = ndimage.sum(not_white, labeled, range(1, num + 1))
order = np.argsort(sizes)[::-1]

boxes = []
for idx in order:
    label_id = idx + 1
    if sizes[idx] < 50000 * (ZOOM / 4) ** 2:  # 小さい文字ラベルや罫線を除外
        continue
    ys, xs = np.where(labeled == label_id)
    boxes.append((xs.min(), ys.min(), xs.max(), ys.max(), sizes[idx]))
    if len(boxes) == 2:
        break

# x0が小さい方(左=縦Ver)、大きい方(右=横Ver)
boxes.sort(key=lambda b: b[0])
names = ["logo-vertical", "logo-horizontal"]

PAD = 4
for name, (x0, y0, x1, y1, size) in zip(names, boxes):
    crop = img.crop((max(0, x0 - PAD), max(0, y0 - PAD), x1 + PAD, y1 + PAD))
    out_path = PUBLIC_DIR / f"{name}.png"
    crop.save(out_path)
    print(name, crop.size, "->", out_path)
