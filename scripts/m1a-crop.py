"""数学1・A基礎問題精講: PDFの1ページから図を切り出す。
使い方: python scripts/m1a-crop.py <PDFのindex> <x0> <y0> <x1> <y1> <出力名(拡張子なし)>
座標はページの幅・高さに対する割合（0〜1）。出力: data/oral-exam-figures/m1a/<出力名>.png"""
import sys, pymupdf, os
idx, x0, y0, x1, y1 = int(sys.argv[1]), *map(float, sys.argv[2:6])
d = pymupdf.open('sankosho/数学1･A基礎問題精講 .pdf')
pg = d[idx]; r = pg.rect
clip = pymupdf.Rect(r.x0 + r.width * x0, r.y0 + r.height * y0, r.x0 + r.width * x1, r.y0 + r.height * y1)
os.makedirs('data/oral-exam-figures/m1a', exist_ok=True)
out = f'data/oral-exam-figures/m1a/{sys.argv[6]}.png'
pg.get_pixmap(dpi=170, clip=clip).save(out); print(out)
