"""
黄チャートの口頭試問データを、参考書の紙面画像と照らし合わせて点検・修正する（無人で長時間動かす前提）。

1. 既存の例題: data/yellow-chart/questions.json（scripts/yellow-chart-normalize.mjs で作成）の各例題について、
   紙面（例題のページと次のページ）を画像で Claude に見せ、問題文・答えの誤りや崩れた数式を直させる。
2. 抜けている例題: 前後の例題のページの間から、該当番号の例題を探して一問一答にさせる。

結果は data/yellow-chart/verify-results.jsonl に1例題1行で追記する。途中で止めても、再実行すれば続きから再開する。
参考書の本文を含むため、data/ 以下は git に入れない。

使い方:
  python scripts/yellow-chart-verify.py            # 全部
  python scripts/yellow-chart-verify.py --limit 5  # 試しに5例題だけ
"""
from __future__ import annotations

import argparse
import base64
import collections
import concurrent.futures
import json
import os
import re
import sys
import threading
import time
import unicodedata
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "yellow-chart"
QUESTIONS = WORK / "questions.json"
RESULTS = WORK / "verify-results.jsonl"
MODEL = os.environ.get("YELLOW_CHART_MODEL", "claude-sonnet-5-5")
PDFS = {
    "黄チャート式 解法と演習 数学1+A": "黄チャート式 解法と演習 数学1+A .pdf",
    "黄チャート式 解法と演習 数学2+B": "黄チャート式 解法と演習 数学2+B .pdf",
    "黄チャート式 解法と演習 数学3+C": "黄チャート式 解法と演習 数学3+C.pdf",
}
MISSING = {
    ("黄チャート式 解法と演習 数学1+A", "数学I"): [22, 24, 30, 31, 33, 100, 101, 102, 103, 104, 105, 139, 140, 141],
    ("黄チャート式 解法と演習 数学1+A", "数学A"): [31, 32, 33, 34, 62, 63, 64, 65],
    ("黄チャート式 解法と演習 数学2+B", "数学II"): [138, 139, 140, 141, 165, 166, 167, 168],
    ("黄チャート式 解法と演習 数学2+B", "数学B"): [49, 56],
    ("黄チャート式 解法と演習 数学3+C", "数学III"): [150],
    ("黄チャート式 解法と演習 数学3+C", "数学C"): [43, 44, 69, 70, 71, 72, 73, 74, 75, 76],
}

NOTATION = """数式の書き方（画面表示と音声読み上げのため、必ずこの形で書く）:
- 分数は a/b、分子や分母が式なら (x+1)/(x−1)。指数は x²、x³、xⁿ のような上付き文字、上付きにできないものは x^(n+1)。
- 根号は √2、√(x+1)。添字は aₙ、a₁、上付き・下付きにできないものは a_(n+1)。
- 積分は ∫[0→1] (x²+1) dx、総和は Σ[k=1→n] k²、極限は lim[n→∞] (1+1/n)ⁿ、ベクトルは →a や →AB、組合せは ₙCᵣ（または nCr）。
- 補集合は「A の補集合」「(A∪B) の補集合」のように言葉で書く（上線の記号は、どこまで掛かっているかが分かりにくいので使わない）。
  紙面の上線が1文字だけに掛かっているのか、式全体に掛かっているのかを、よく見て区別する。
- 1行の文字だけで書く。LaTeX や画像は使わない。"""

VERIFY_PROMPT = """あなたは高校数学の参考書「黄チャート式 解法と演習」の例題を、生徒向けの口頭試問（一問一答）データとして点検する担当です。
添付は参考書の紙面画像（{part} の{kind}例題 {number}「{title}」が載っているページを含む数ページ）です。
下の「現在のデータ」は、この例題を小問ごとに分けた口頭試問データで、文字認識の誤りや崩れた数式を含んでいる可能性があります。

紙面と1件ずつ照らし合わせて、次の方針で点検してください。
- 問題文（prompt）は、紙面の問題文と同じ内容になっているか。数式・数値・条件の抜けや誤りがあれば、紙面どおりに直す。
  小問に分けたデータでは、共通の指示文（「次の式を展開せよ。」など）＋その小問、という形を保つ。
- 答え（answer）は、紙面の例題の解答（最終的な答え）と一致しているか。違えば紙面どおりに直す。途中式は不要、最終結果だけ。
- 紙面で確認できない場合や、この例題のページが画像に無い場合は推測で直さず、status を "unverifiable" にする。
- 図を見ないと答えられない問題（「グラフをかけ」だけの問題など）は status を "needs_figure" にする。
- 直す必要がなければ status は "ok"、直したら "fixed"。"ok" のときも prompt・answer は現在のデータをそのまま入れる。

{notation}

現在のデータ:
{items}
"""

MISSING_PROMPT = """あなたは高校数学の参考書「黄チャート式 解法と演習」の例題を、生徒向けの口頭試問（一問一答）データにする担当です。
添付は参考書の紙面画像です。この中から {part} の「例題 {number}」（基本例題・重要例題・補充例題のいずれか）を探し、
口頭試問データにしてください。

- 例題に (1)(2)… の小問があれば、小問ごとに1件にする。各件の prompt は「共通の指示文＋その小問」にして、それだけで解けるようにする。
- answer は、紙面の例題の解答に書かれた最終的な答えだけを書く。紙面で確認できない答えは書かず、その件は出力しない。
- sub には小問の番号を "(1)" の形で書く（小問が無ければ空文字）。kind は「基本」「重要」「補充」のどれか、title は例題の見出し。
- 図を見ないと答えられない小問は出力しない。
- この例題が画像の中に見つからなければ found を false にする。

{notation}
"""

VERIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "status": {"type": "string", "enum": ["ok", "fixed", "unverifiable", "needs_figure"]},
                    "prompt": {"type": "string"},
                    "answer": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["id", "status", "prompt", "answer", "note"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

MISSING_SCHEMA = {
    "type": "object",
    "properties": {
        "found": {"type": "boolean"},
        "kind": {"type": "string"},
        "title": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"sub": {"type": "string"}, "prompt": {"type": "string"}, "answer": {"type": "string"}},
                "required": ["sub", "prompt", "answer"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["found", "kind", "title", "items"],
    "additionalProperties": False,
}


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            key, _, value = line.strip().partition("=")
            if key and value and key not in os.environ and not key.startswith("#"):
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


def norm(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


class Book:
    def __init__(self, title: str):
        self.doc = pymupdf.open(ROOT / "sankosho" / PDFS[title])
        self.texts = [norm(self.doc[i].get_text()) for i in range(self.doc.page_count)]
        self.lock = threading.Lock()

    def set_titles(self, titles: list[str]) -> None:
        # 目次・章の扉・例題一覧のページは、たくさんの例題の見出しを含む。そうしたページを候補から外すため、
        # ページごとに見出しがいくつ載っているかを数えておく。
        keys = [norm(t) for t in titles if len(norm(t)) >= 4]
        self.title_counts = [sum(1 for k in keys if k in text) for text in self.texts]

    def find_page(self, title: str, after: int = -1) -> int | None:
        key = norm(title)
        if len(key) < 3:
            return None
        # 例題は番号順に並んでいるので、前の例題より後ろのページだけを候補にする（目次やまとめのページを避ける）。
        candidates = [i for i, t in enumerate(self.texts) if i > after and key in t and self.title_counts[i] <= 3]
        if not candidates:
            return None
        # 例題のページでは見出しがページ上部に来るので、上部に出るページを優先する。
        top = [i for i in candidates if key in self.texts[i][:300]]
        return (top or candidates)[0]

    def image(self, index: int) -> str:
        with self.lock:
            pix = self.doc[index].get_pixmap(dpi=int(os.environ.get("YELLOW_CHART_DPI", "110")))
            return base64.b64encode(pix.tobytes("png")).decode()


def call_claude(text: str, images: list[str], schema: dict, effort: str | None = None) -> dict:
    content = [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img}} for img in images]
    content.append({"type": "text", "text": text})
    body = {
        "model": MODEL,
        "max_tokens": 16000,
        "output_config": {"effort": effort or os.environ.get("YELLOW_CHART_EFFORT", "low"), "format": {"type": "json_schema", "schema": schema}},
        "messages": [{"role": "user", "content": content}],
    }
    for attempt in range(6):
        request = Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(body).encode(),
            headers={
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=600) as response:
                data = json.loads(response.read())
            text_block = next(b["text"] for b in data["content"] if b["type"] == "text")
            return json.loads(text_block)
        except HTTPError as error:
            detail = error.read().decode(errors="replace")[:300]
            if error.code in (429, 500, 502, 503, 529) and attempt < 5:
                time.sleep(20 * (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {error.code}: {detail}") from error
        except (URLError, TimeoutError):
            if attempt < 5:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    raise RuntimeError("retries exhausted")


def example_title(category: str) -> tuple[str, str]:
    match = re.search(r"(基本|重要|補充|演習)例題\s+(.*)$", category)
    return (match.group(1), match.group(2).strip()) if match else ("", "")


def retry_tasks(groups, books) -> list:
    """1回目で紙面と照合できた例題のページを目印にして、照合できなかった例題を前後の目印の間のページから探し直す。"""
    results = [json.loads(l) for l in RESULTS.read_text(encoding="utf-8").splitlines() if l.strip()]
    anchors: dict[tuple, int] = {}
    failed: set[str] = set()
    for r in results:
        if r.get("error") or not r.get("items"):
            failed.add(r["key"])
            continue
        if r["mode"] == "verify":
            if any(i["status"] in ("ok", "fixed", "needs_figure") for i in r["items"]):
                anchors[(r["book"], r["part"], r["number"])] = r["pages"][0]
            else:
                failed.add(r["key"])
        elif r["mode"] == "missing" and not r.get("found"):
            failed.add(r["key"])
    # 失敗した行を結果ファイルから外し、やり直した結果で置き換える
    kept = [r for r in results if r["key"] not in failed]
    RESULTS.write_text("".join(json.dumps(r, ensure_ascii=False) + chr(10) for r in kept), encoding="utf-8")

    def window(book: str, part: str, number: int) -> list[int]:
        nums = sorted(n for (b, p, n) in anchors if b == book and p == part)
        before = [n for n in nums if n < number]
        after = [n for n in nums if n > number]
        if not before and not after:
            return []
        lo = anchors[(book, part, before[-1])] if before else anchors[(book, part, after[0])] - 4
        hi = anchors[(book, part, after[0])] + 1 if after else lo + 5
        if hi - lo > 7:
            # 目印の間が広すぎるときは、番号の位置から比例配分でページを見積もって前後を見る
            if before and after:
                estimate = lo + (hi - lo) * (number - before[-1]) / (after[0] - before[-1])
            else:
                estimate = lo + 2
            lo, hi = int(estimate) - 2, int(estimate) + 4
        return list(range(max(lo, 0), hi + 1))[:8]

    tasks = []
    for key in sorted(failed):
        mode, book, part, number = key.split("|")
        number = int(number) if number.isdigit() else None
        if number is None:
            continue
        pages = window(book, part, number)
        if mode == "verify":
            items = groups[(book, part, number)]
            kind, title = example_title(items[0]["category"])
            tasks.append(("verify", key, book, part, number, kind, title, items, pages))
        else:
            tasks.append(("missing", key, book, part, number, "", "", [], pages))
    return tasks


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--retry", action="store_true", help="照合できなかった例題を、確定したページの間から探し直す")
    args = parser.parse_args()
    load_env()
    sys.stdout.reconfigure(encoding="utf-8")

    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    done = set()
    if RESULTS.exists():
        for line in RESULTS.read_text(encoding="utf-8").splitlines():
            if line.strip():
                done.add(json.loads(line)["key"])

    groups: dict[tuple, list[dict]] = collections.OrderedDict()
    for q in questions:
        groups.setdefault((q["book"], q["part"], q["number"]), []).append(q)

    books = {title: Book(title) for title in PDFS}
    for title, book in books.items():
        book.set_titles([example_title(q["category"])[1] for q in questions if q["book"] == title])
    page_of: dict[tuple, int] = {}
    last_page: dict[tuple, int] = {}
    for (book, part, number), items in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2])):
        page = books[book].find_page(example_title(items[0]["category"])[1], after=last_page.get((book, part), 0))
        if page is not None:
            page_of[(book, part, number)] = page
            last_page[(book, part)] = page - 1

    def neighbor_pages(book: str, part: str, number: int) -> list[int]:
        # 見出しが文字検索で見つからない例題は、前後の例題のページの間を見せる（最大4ページ）。
        before = [page_of[(book, part, n)] for n in range(number - 1, 0, -1) if (book, part, n) in page_of][:1]
        after = [page_of[(book, part, n)] for n in range(number + 1, number + 15) if (book, part, n) in page_of][:1]
        if not before and not after:
            return []
        start = before[0] if before else after[0] - 3
        end = after[0] if after else start + 3
        if end < start or end - start > 7:
            return []
        return list(range(max(start, 0), end + 1))

    tasks = []
    for (book, part, number), items in groups.items():
        kind, title = example_title(items[0]["category"])
        page = page_of.get((book, part, number))
        pages = [page, page + 1] if page is not None else neighbor_pages(book, part, number)
        key = f"verify|{book}|{part}|{number}"
        if key not in done:
            tasks.append(("verify", key, book, part, number, kind, title, items, pages))
    for (book, part), numbers in MISSING.items():
        for number in numbers:
            key = f"missing|{book}|{part}|{number}"
            if key in done:
                continue
            tasks.append(("missing", key, book, part, number, "", "", [], neighbor_pages(book, part, number)))

    if args.retry:
        tasks = retry_tasks(groups, books)
    if args.limit:
        tasks = tasks[: args.limit]
    print(f"未処理 {len(tasks)} 件（済み {len(done)} 件）", flush=True)
    write_lock = threading.Lock()

    def run(task) -> str:
        mode, key, book, part, number, kind, title, items, pages = task
        b = books[book]
        pages = [i for i in pages if 0 <= i < b.doc.page_count][:8]
        if mode == "verify":
            if not pages:
                result = {"key": key, "mode": mode, "error": "page_not_found", "items": []}
            else:
                images = [b.image(i) for i in pages]
                listing = json.dumps(
                    [{"id": q["id"], "sub": q["sub"], "prompt": q["prompt"], "answer": q["answer"]} for q in items],
                    ensure_ascii=False, indent=1,
                )
                text = VERIFY_PROMPT.format(part=part, kind=kind, number=number, title=title, notation=NOTATION, items=listing)
                output = call_claude(text, images, VERIFY_SCHEMA)
                result = {"key": key, "mode": mode, "book": book, "part": part, "number": number, "pages": pages, **output}
        else:
            if not pages:
                result = {"key": key, "mode": mode, "error": "range_unknown", "items": []}
            else:
                text = MISSING_PROMPT.format(part=part, number=number, notation=NOTATION)
                output = call_claude(text, [b.image(i) for i in pages], MISSING_SCHEMA)
                result = {"key": key, "mode": mode, "book": book, "part": part, "number": number, "pages": pages, **output}
        with write_lock:
            with RESULTS.open("a", encoding="utf-8") as f:
                f.write(json.dumps(result, ensure_ascii=False) + "\n")
        return key

    finished = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(run, task): task for task in tasks}
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
                finished += 1
                if finished % 20 == 0:
                    print(f"{finished}/{len(tasks)} 完了", flush=True)
            except Exception as error:  # 1件の失敗で全体を止めない。再実行すれば未処理分だけやり直す
                print(f"失敗 {futures[future][1]}: {error}", flush=True)
    print("終了", flush=True)


if __name__ == "__main__":
    main()
