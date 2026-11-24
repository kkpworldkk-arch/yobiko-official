"""数学1・A基礎問題精講: 紙面ページ（印刷ページ番号）を2ページ横並びの画像にして出す。
使い方: python scripts/m1a-render.py <出力先> <開始> <終了>
印刷ページ n は PDF の index n+5。"""
import sys, pymupdf
from PIL import Image
out, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
d = pymupdf.open('sankosho/数学1･A基礎問題精講 .pdf')
def pg(n):
    pix = d[n + 5].get_pixmap(dpi=105)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
n = a
while n <= b:
    ims = [pg(n)] + ([pg(n + 1)] if n + 1 <= b else [])
    W = sum(i.width for i in ims); H = ims[0].height
    M = Image.new('RGB', (W, H), 'white'); x = 0
    for i in ims: M.paste(i, (x, 0)); x += i.width
    M.save(f'{out}/s{n:03d}.png'); n += 2
