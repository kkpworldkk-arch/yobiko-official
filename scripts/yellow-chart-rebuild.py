"""
黄チャートの口頭試問データを、参考書の例題ごとに作り直す（data/yellow-chart/verify-results.jsonl の照合結果が前提）。

方針:
- 紙面と合っている既存の小問はそのまま残し、誤りは直し、紙面の小問 (1)(2)… はすべて入れる。
- 数学を口頭試問で出すため、生徒が迷わない形にする（最終的な答えがはっきり決まる問いにする。
  「グラフをかけ」「証明せよ」は答えられる形に言い換える。数式には読み上げ用の文を付ける）。
- 抜けていた例題も、見つかったページから作る。

結果: data/yellow-chart/rebuilt.jsonl（1例題1行）。途中で止めても再実行で続きから。
反映は scripts/apply-yellow-chart.mjs --build-rebuilt → final.json。

使い方:
  python scripts/yellow-chart-rebuild.py --only "数学I|37,数学I|41"   # 試し
  python scripts/yellow-chart-rebuild.py                               # 全部
"""
from __future__ import annotations

import argparse
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

REBUILT = yv.WORK / "rebuilt.jsonl"

SCHEMA = {
    "type": "object",
    "properties": {
        "found": {"type": "boolean"},
        "kind": {"type": "string"},
        "title": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sub": {"type": "string"},
                    "origin": {"type": "string", "enum": ["kept", "fixed", "new"]},
                    "prompt": {"type": "string"},
                    "speech": {"type": "string"},
                    "answer": {"type": "string"},
                    "numeric_answer": {"type": "string"},
                    "keywords": {"type": "array", "items": {"type": "string"}},
                    "accepted": {"type": "array", "items": {"type": "string"}},
                    "misconceptions": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["sub", "origin", "prompt", "speech", "answer", "numeric_answer", "keywords", "accepted", "misconceptions"],
                "additionalProperties": False,
            },
        },
        "skipped": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["found", "kind", "title", "items", "skipped"],
    "additionalProperties": False,
}

PROMPT = """あなたは高校数学の参考書「黄チャート式 解法と演習」の例題を、生徒向けの口頭試問データにする担当です。
口頭試問では、アプリが問題文を音声で読み上げて画面にも表示し、生徒は紙で解いてから、最終的な答えを声・手書き・キーボードで答えます。
AI が模範解答と照らして採点します。

添付は {part} の「例題 {number}」（{kind}例題「{title}」）が載っている紙面の画像です（前後のページを含むことがあります）。
画像の中から、この例題の問題と解答を見つけて、口頭試問データを作ってください。
{current_section}
作り方（生徒が迷わないことを最優先にする）:
1. 例題の小問 (1)(2)…、(ア)(イ)… をすべて洗い出し、各小問を1件にする（sub は "(1)" や "(1)(ア)" の形、小問が無ければ空文字）。
   紙面の小問は1つも漏らさない。例題の本文の問題だけを使い、PRACTICE・EXERCISES・練習問題は使わない。
2. 各件の問題文（prompt）は、それだけで解けるようにする。共通の条件・指示文は各件に書き込む。
   前の小問の結果を使う場合は、その結果を条件として書き込む。
3. 答えが1つに決まる問いにする。最終的な答え（値・式・範囲・集合・座標など）を答えさせる。
   - 「グラフをかけ」は、紙面の解答から言える特徴（頂点、軸、漸近線、x軸との交点、定義域・値域など）を答えさせる問いに言い換える。
   - 「証明せよ」「示せ」は、「〜を証明するときの方針と、要点となる式・事実を答えよ」のように言い換え、answer に紙面の証明の要点を、
     keywords に必ず触れるべき要点を入れる。
   - 「〜を求めよ。また〜も求めよ」のように答えが複数あるときは、問題文で何を答えるかを明示する（例：「最大値と、そのときの x の値を答えよ」）。
   - どう言い換えても図が無いと答えられない小問だけ出題せず、skipped に「(2)：図形の読み取りが必要」のように理由を書く。
4. answer は紙面の解答の最終結果に基づく（途中式は不要。証明の言い換えでは要点）。紙面で確かめられない答えは書かない。
   numeric_answer には、答えが1つの数値・式なら同じものを書く（それ以外は空文字）。
   accepted には同値な別表記（例：1/2 と 0.5、因数分解した形と展開した形のうち問題が許すもの、x=1, 2 と x=2, 1 の順不同）を入れる。
   misconceptions には典型的な誤答（符号ミス、範囲の等号の有無など）を入れる。無ければ空。
5. speech は、問題文を音声で読み上げるための文。数式を日本語の読み方で書く
   （例：「x²+3x+2」→「エックスの二乗プラス三エックスプラス二」、「√(x+1)」→「ルート、エックスプラス一」、
   「a/b」→「b分のa」、「∫[0→1]」→「ゼロから一までの積分」、「→AB」→「ベクトルエービー」、「≦」→「以下」）。
   数式を含まない問題文でも、そのまま同じ文を入れる。
6. 書き終えたら、各件を検算する。問題文の条件だけから answer が導けるかを自分で解いて確かめ、
   矛盾する場合は紙面を読み直して、問題文か答えのどちらを読み違えたかを直す。今あるデータの答えも鵜呑みにしない。
7. 今あるデータのうち、紙面と合っているものは問題文・答えを変えずに使う（origin: "kept"、ただし 2・3 の形に整える必要があれば "fixed"）。
   直したものは "fixed"、新しく作ったものは "new"。

{notation}

この例題が画像の中に見つからなければ found を false にする（items は空）。kind は「基本」「重要」「補充」のどれか、title は例題の見出し。
"""

CURRENT_SECTION = """
今あるデータ（文字認識の誤りを含む可能性があります）:
{items}
"""


CHECK_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sub": {"type": "string"},
                    "consistent": {"type": "boolean"},
                    "my_answer": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["sub", "consistent", "my_answer", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

CHECK_PROMPT = """次は高校数学の口頭試問データです。各件について、問題文（prompt）に書かれた条件だけを使って自分で解き、
模範解答（answer）と一致するかを判定してください。
- 一致すれば consistent: true。表記の違い（順序、同値な式、分数と小数）は一致とみなす。
- 問題文の条件からは模範解答が導けない、条件が足りない・矛盾している、問われていることと答えがずれている場合は false にし、
  reason に具体的に書く（例：「条件 (Aの補集合)∩B={{4,5,7}} なら B は 4,5,7 を含むはずだが、答えの B に含まれない」）。
- 証明の方針を答える問いは、answer の要点が数学的に正しく、問いに答えていれば true。
my_answer には自分で解いた答えを書く。

{items}
"""

RETRY_NOTE = """
【前回の案の検算で見つかった矛盾】
前回あなたが作った案を、紙面を見ずに解き直したところ、次の件で問題文と答えが合いませんでした。
紙面の該当箇所（問題文の記号・上線・添字・数値と、解答の最終結果）を1文字ずつ読み直し、どちらを読み違えたかを特定して直してください。
{issues}
前回の案:
{previous}
"""


def check_items(items: list[dict]) -> list[dict]:
    listing = json.dumps([{"sub": i["sub"], "prompt": i["prompt"], "answer": i["answer"]} for i in items], ensure_ascii=False, indent=1)
    return yv.call_claude(CHECK_PROMPT.format(items=listing), [], CHECK_SCHEMA, "medium")["items"]


def load_results() -> dict[str, dict]:
    results = {}
    for line in yv.RESULTS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            results[r["key"]] = r
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--pagemap", action="store_true", help="全ページの地図（yellow-chart-pagemap.py）から、残りの例題を作り直す")
    args = parser.parse_args()
    yv.load_env()
    sys.stdout.reconfigure(encoding="utf-8")

    questions = json.loads(yv.QUESTIONS.read_text(encoding="utf-8"))
    groups: dict[tuple, list[dict]] = {}
    for q in questions:
        groups.setdefault((q["book"], q["part"], q["number"]), []).append(q)
    results = load_results()
    books = {title: yv.Book(title) for title in yv.PDFS}
    lock = threading.Lock()

    done = set()
    if REBUILT.exists():
        for line in REBUILT.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                if not r.get("error"):
                    done.add(r["key"])

    tasks = []
    for key, r in results.items():
        mode, book, part, number = key.split("|")
        if not number.isdigit():
            continue
        number = int(number)
        # 紙面で例題を確認できた（照合が ok/fixed/needs_figure を含む、または抜け例題が見つかった）ものだけ作り直す
        if r.get("error"):
            continue
        if mode == "verify" and not any(i["status"] in ("ok", "fixed", "needs_figure") for i in r.get("items", [])):
            continue
        if mode == "missing" and not r.get("found"):
            continue
        rkey = f"{book}|{part}|{number}"
        if rkey in done:
            continue
        tasks.append((rkey, book, part, number, mode, r.get("pages") or []))
    if args.pagemap:
        # 照合で確認できなかった例題・抜けていた例題を、地図のページ（見出しのページと次のページ）から作る
        example_pages = json.loads((yv.WORK / "example-pages.json").read_text(encoding="utf-8"))
        queued = {t[0] for t in tasks}
        tasks = []
        for rkey, page in sorted(example_pages.items()):
            if rkey in done or rkey in queued:
                continue
            book, part, number = rkey.split("|")
            tasks.append((rkey, book, part, int(number), "pagemap", [page, page + 1]))
    if args.only:
        wanted = {f"{p}|{n}" for p, n in (x.split("|") for x in args.only.split(","))}
        tasks = [t for t in tasks if f"{t[2]}|{t[3]}" in wanted]
    print(f"作り直し: {len(tasks)}例題（済み {len(done)}）", flush=True)

    def rebuild(task) -> dict:
        rkey, book, part, number, mode, pages = task
        b = books[book]
        pages = [p for p in pages if 0 <= p < b.doc.page_count][:8]
        items = groups.get((book, part, number), [])
        if items:
            kind, title = yv.example_title(items[0]["category"])
            current = json.dumps([{"sub": q["sub"], "prompt": q["prompt"], "answer": q["answer"]} for q in items], ensure_ascii=False, indent=1)
            section = CURRENT_SECTION.format(items=current)
        else:
            kind, title, section = "", "（見出しは紙面で確認）", "\n（この例題の既存データはありません。紙面から新しく作ってください。）\n"
        text = PROMPT.format(part=part, number=number, kind=kind, title=title, current_section=section, notation=yv.NOTATION)
        if not pages:
            out = {"found": False, "items": []}
        else:
            images = [b.image(p) for p in pages]
            out = yv.call_claude(text, images, SCHEMA, "medium")
            # 紙面を見ない検算で矛盾が見つかったら、その内容を伝えて丁寧に作り直させる（最大2回）
            for attempt in range(2):
                if not out.get("items"):
                    break
                bad = [c for c in check_items(out["items"]) if not c["consistent"]]
                if not bad:
                    out["check"] = "ok"
                    break
                out["check"] = "needs_review"
                out["issues"] = bad
                issues = json.dumps(bad, ensure_ascii=False, indent=1)
                previous = json.dumps(out["items"], ensure_ascii=False, indent=1)
                out = {**yv.call_claude(text + RETRY_NOTE.format(issues=issues, previous=previous), images, SCHEMA, "high"), "check": "needs_review", "issues": bad}
            else:
                bad = [c for c in check_items(out["items"]) if not c["consistent"]] if out.get("items") else []
                out["check"] = "ok" if not bad else "needs_review"
                out["issues"] = bad
        return {"key": rkey, "book": book, "part": part, "number": number, "pages": pages,
                "ids": {q["sub"]: q["id"] for q in items}, "category": items[0]["category"] if items else "", **out}

    import os
    os.environ.setdefault("YELLOW_CHART_DPI", "150")

    finished = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(rebuild, t): t[0] for t in tasks}
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
            except Exception as error:
                result = {"key": futures[future], "error": str(error)[:300]}
                print(f"失敗 {futures[future]}: {error}", flush=True)
            with lock:
                with REBUILT.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(result, ensure_ascii=False) + "\n")
            finished += 1
            if finished % 20 == 0:
                print(f"{finished}/{len(tasks)} 完了", flush=True)
    print("終了", flush=True)


if __name__ == "__main__":
    main()
