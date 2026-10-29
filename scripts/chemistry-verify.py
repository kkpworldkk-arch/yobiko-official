"""
化学230選の口頭試問データ（data/manual-import/chemistry-230.txt）が、参考書の問題・解答と合っているかを点検する。
無人で長時間動かす前提。途中で止めても、再実行すれば続きから再開する。

1. ページ地図: 参考書 PDF の各ページに載っている「第◯問」の番号を、安いモデルで読み取る
   （問題・解答の見出しは画像になっていて文字検索できないため）。
2. 照合: 問題ごとに、問題ページと解答ページの画像と、テンプレートの小問を Claude に見せ、
   問題文・答えが紙面と合っているかを判定させ、誤りがあれば直した案を出させる。

結果: data/chem-verify/pagemap.json, data/chem-verify/results.jsonl
参考書の本文を含むため、data/ 以下は git に入れない。

使い方:
  python scripts/chemistry-verify.py            # 全部
  python scripts/chemistry-verify.py --limit 3  # 照合を3問だけ試す
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures
import glob
import json
import os
import re
import sys
import threading
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "chem-verify"
TEMPLATE = ROOT / "data" / "manual-import" / "chemistry-230.txt"
PAGEMAP = WORK / "pagemap.json"
RESULTS = WORK / "results.jsonl"
MAP_MODEL = os.environ.get("CHEM_MAP_MODEL", "claude-sonnet-5-5")
VERIFY_MODEL = os.environ.get("CHEM_VERIFY_MODEL", "claude-sonnet-5-5")
ANSWER_START = 158  # これより後ろの PDF ページ（0始まり）が解答解説編

MAP_SCHEMA = {
    "type": "object",
    "properties": {"numbers": {"type": "array", "items": {"type": "integer"}}},
    "required": ["numbers"],
    "additionalProperties": False,
}
VERIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "found": {"type": "boolean"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "status": {"type": "string", "enum": ["ok", "fix_question", "fix_answer", "fix_both", "not_in_book", "unverifiable"]},
                    "prompt": {"type": "string"},
                    "answer": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["key", "status", "prompt", "answer", "note"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["found", "items"],
    "additionalProperties": False,
}

VERIFY_PROMPT = """あなたは化学の問題集「化学頻出スタンダード問題230選」をもとに作った口頭試問（一問一答）データを点検する担当です。
添付は、この問題集の「第{n}問」が載っている問題ページと、その解答・解説ページの画像です。
下の「口頭試問データ」は、第{n}問を小問ごとに一問一答にしたものです。音声で出題するため、選択肢を文中に入れたり、
記述式に言い換えたりしているのは正しい加工です（言い換え自体は誤りとしない）。

1件ずつ紙面と照らし合わせ、次を判定してください。
- 問題文（prompt）が、紙面の第{n}問の内容と合っているか（数値・条件・物質名・問われていることの取り違えや抜けがないか）。
- 答え（answer）が、解答ページの正解と合っているか（数値・単位・物質名・選んだ記号の中身）。
判定:
- 合っていれば "ok"（prompt と answer は現在のものをそのまま入れる）。
- 問題文だけ直す必要があれば "fix_question"、答えだけなら "fix_answer"、両方なら "fix_both"。
  直した prompt / answer を入れる。直し方は最小限にし、元の言い回し・形式（1行の文字、化学式は H2O のように書く）を保つ。
- 紙面の第{n}問に、その小問に当たる内容が無ければ "not_in_book"。
- 画像が読めない・第{n}問が見当たらないなど、確かめられなければ "unverifiable"（推測で直さない）。
note には、判定の根拠を短く書く。画像に第{n}問が無ければ found を false にする。

口頭試問データ:
{items}
"""


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            key, _, value = line.strip().partition("=")
            if key and value and key not in os.environ and not key.startswith("#"):
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


def call_claude(model: str, text: str, images: list[str], schema: dict, effort: str | None) -> dict:
    content = [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img}} for img in images]
    content.append({"type": "text", "text": text})
    output_config: dict = {"format": {"type": "json_schema", "schema": schema}}
    if effort:
        output_config["effort"] = effort
    body = {"model": model, "max_tokens": 16000, "output_config": output_config, "messages": [{"role": "user", "content": content}]}
    for attempt in range(6):
        request = Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(body).encode(),
            headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"},
        )
        try:
            with urlopen(request, timeout=600) as response:
                data = json.loads(response.read())
            return json.loads(next(b["text"] for b in data["content"] if b["type"] == "text"))
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


def parse_template() -> dict[int, list[dict]]:
    text = "\n".join(l for l in TEMPLATE.read_text(encoding="utf-8").splitlines() if not l.startswith("#"))
    problems: dict[int, list[dict]] = {}
    for raw in re.split(r"^---\s*$", text, flags=re.M):
        fields: dict[str, str] = {}
        key = None
        for line in raw.splitlines():
            m = re.match(r"^([A-Z]+):\s?(.*)$", line)
            if m:
                key = m.group(1)
                fields[key] = m.group(2)
            elif key and line.strip():
                fields[key] += "\n" + line
        if "N" in fields:
            n = int(fields["N"].strip())
            problems.setdefault(n, []).append(
                {"key": f"{n}|{fields.get('S', '').strip()}", "sub": fields.get("S", "").strip(), "prompt": fields.get("Q", "").strip(), "answer": fields.get("A", "").strip()}
            )
    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    load_env()
    sys.stdout.reconfigure(encoding="utf-8")
    WORK.mkdir(parents=True, exist_ok=True)

    pdf = pymupdf.open([p for p in glob.glob(str(ROOT / "sankosho" / "*.pdf")) if "230" in p][0])
    lock = threading.Lock()

    def image(index: int, dpi: int) -> str:
        with lock:
            return base64.b64encode(pdf[index].get_pixmap(dpi=dpi).tobytes("png")).decode()

    # 1. ページ地図
    pagemap: dict[str, list[int]] = json.loads(PAGEMAP.read_text(encoding="utf-8")) if PAGEMAP.exists() else {}
    todo = [i for i in range(pdf.page_count) if str(i) not in pagemap]
    if todo:
        print(f"ページ地図: {len(todo)}ページを読み取り", flush=True)

        def read_page(i: int) -> tuple[int, list[int]]:
            kind = "解答・解説" if i >= ANSWER_START else "問題"
            out = call_claude(
                MAP_MODEL,
                f"この化学問題集のページに、{kind}の見出しとして「第◯問」（例：第12問）が載っていれば、その番号をすべて返してください。"
                "本文中で他の問題を参照しているだけの番号は含めないでください。見出しが無ければ空の配列。",
                [image(i, 110)], MAP_SCHEMA, "low",
            )
            return i, [n for n in out["numbers"] if 1 <= n <= 230]

        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for future in concurrent.futures.as_completed([pool.submit(read_page, i) for i in todo]):
                try:
                    i, numbers = future.result()
                    pagemap[str(i)] = numbers
                except Exception as error:
                    print(f"ページ読み取り失敗: {error}", flush=True)
                with lock:
                    PAGEMAP.write_text(json.dumps(pagemap), encoding="utf-8")

    q_pages: dict[int, list[int]] = {}
    a_pages: dict[int, list[int]] = {}
    for i, numbers in sorted(((int(k), v) for k, v in pagemap.items())):
        for n in numbers:
            (a_pages if i >= ANSWER_START else q_pages).setdefault(n, []).append(i)

    # 2. 照合
    done = set()
    if RESULTS.exists():
        done = {json.loads(l)["n"] for l in RESULTS.read_text(encoding="utf-8").splitlines() if l.strip()}
    problems = parse_template()
    todo_n = [n for n in sorted(problems) if n not in done]
    if args.limit:
        todo_n = todo_n[: args.limit]
    print(f"照合: {len(todo_n)}問（済み {len(done)}問）", flush=True)

    def verify(n: int) -> dict:
        qp = q_pages.get(n, [])
        ap = a_pages.get(n, [])
        if not qp or not ap:
            return {"n": n, "error": f"pages_unknown q={qp} a={ap}", "items": []}
        # 問題が次のページにまたがることがあるので、見出しのページと次のページを見せる
        pages = sorted(set([qp[0], qp[0] + 1] + [ap[0], ap[0] + 1]))
        pages = [p for p in pages if p < pdf.page_count]
        items = json.dumps(problems[n], ensure_ascii=False, indent=1)
        out = call_claude(VERIFY_MODEL, VERIFY_PROMPT.format(n=n, items=items), [image(p, 110) for p in pages], VERIFY_SCHEMA, "low")
        return {"n": n, "pages": pages, **out}

    finished = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(verify, n): n for n in todo_n}
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
                with lock:
                    with RESULTS.open("a", encoding="utf-8") as f:
                        f.write(json.dumps(result, ensure_ascii=False) + "\n")
                finished += 1
                if finished % 20 == 0:
                    print(f"{finished}/{len(todo_n)} 完了", flush=True)
            except Exception as error:
                print(f"照合失敗 第{futures[future]}問: {error}", flush=True)
    print("終了", flush=True)


if __name__ == "__main__":
    main()
