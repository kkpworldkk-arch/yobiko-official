"""
黄チャート3冊の全ページについて、「基本例題 12」「重要例題 30」などの例題の見出しが載っているかを読み取り、
例題 → ページの地図を作る（見出しは画像になっていて文字検索では正しく見つからないため）。

1冊に2科目（例：数学I と数学A）が入っていて、例題番号は科目ごとに1から始まる。
ページ順に見て、番号が大きく戻ったところで後半の科目に切り替わったとみなす。

結果: data/yellow-chart/pagemap.json
  { "<本の名前>": { "<ページ番号(0始まり)>": [{"kind": "基本", "number": 12}, ...] } }
  と、例題ごとのページ data/yellow-chart/example-pages.json
  { "<本>|<科目>|<番号>": <ページ番号> }
途中で止めても、再実行で続きから。

使い方:
  python scripts/yellow-chart-pagemap.py
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures
import importlib.util
import json
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ycverify", ROOT / "scripts" / "yellow-chart-verify.py")
yv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(yv)

PAGEMAP = yv.WORK / "pagemap.json"
EXAMPLE_PAGES = yv.WORK / "example-pages.json"
PARTS = {
    "黄チャート式 解法と演習 数学1+A": ("数学I", "数学A"),
    "黄チャート式 解法と演習 数学2+B": ("数学II", "数学B"),
    "黄チャート式 解法と演習 数学3+C": ("数学III", "数学C"),
}
SCHEMA = {
    "type": "object",
    "properties": {
        "examples": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"kind": {"type": "string", "enum": ["基本", "重要", "補充"]}, "number": {"type": "integer"}},
                "required": ["kind", "number"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["examples"],
    "additionalProperties": False,
}
PROMPT = """これは数学の参考書「黄チャート式 解法と演習」の1ページです。
このページに、例題の見出し（色の付いた帯の「基本例題 12」「重要例題 30」「補充例題 5」など。例題の問題文がこの見出しの直後に続く）が
載っていれば、その種類と番号をすべて返してください。
- 章の扉の一覧・目次・「〜を参照」「例題12で学んだ」などの本文中の参照、PRACTICE・EXERCISES の番号は含めない。
- 見出しが無ければ空の配列。"""


def assign_parts(book: str, pages: dict[str, list[dict]]) -> dict[str, int]:
    first, second = PARTS[book]
    result: dict[str, int] = {}
    part = first
    last_number = 0
    for page in sorted(pages, key=int):
        for ex in sorted(pages[page], key=lambda e: e["number"]):
            n = ex["number"]
            # 前半の科目で大きい番号まで進んだあと、小さい番号に戻ったら後半の科目
            if part == first and last_number >= 20 and n <= 3:
                part = second
            last_number = max(last_number, n) if part == first else n
            key = f"{book}|{part}|{n}"
            result.setdefault(key, int(page))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    yv.load_env()
    sys.stdout.reconfigure(encoding="utf-8")
    pagemap: dict[str, dict[str, list[dict]]] = json.loads(PAGEMAP.read_text(encoding="utf-8")) if PAGEMAP.exists() else {}
    lock = threading.Lock()

    for book in yv.PDFS:
        doc = yv.Book(book).doc
        done = pagemap.setdefault(book, {})
        todo = [i for i in range(doc.page_count) if str(i) not in done]
        print(f"{book}: {len(todo)}ページを読み取り", flush=True)

        def read(i: int) -> tuple[int, list[dict]]:
            with lock:
                img = base64.b64encode(doc[i].get_pixmap(dpi=90).tobytes("png")).decode()
            return i, yv.call_claude(PROMPT, [img], SCHEMA, "low")["examples"]

        finished = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for future in concurrent.futures.as_completed([pool.submit(read, i) for i in todo]):
                try:
                    i, examples = future.result()
                    with lock:
                        done[str(i)] = examples
                        finished += 1
                        if finished % 50 == 0:
                            PAGEMAP.write_text(json.dumps(pagemap, ensure_ascii=False), encoding="utf-8")
                            print(f"  {finished}/{len(todo)}", flush=True)
                except Exception as error:
                    print(f"  読み取り失敗: {error}", flush=True)
        PAGEMAP.write_text(json.dumps(pagemap, ensure_ascii=False), encoding="utf-8")

    example_pages: dict[str, int] = {}
    for book, pages in pagemap.items():
        example_pages.update(assign_parts(book, pages))
    EXAMPLE_PAGES.write_text(json.dumps(example_pages, ensure_ascii=False, indent=0), encoding="utf-8")
    for book in yv.PDFS:
        for part in PARTS[book]:
            nums = sorted(int(k.split("|")[2]) for k in example_pages if k.startswith(f"{book}|{part}|"))
            print(f"{part}: 例題 {len(nums)}個（最大 {nums[-1] if nums else 0}）", flush=True)
    print("終了", flush=True)


if __name__ == "__main__":
    main()
