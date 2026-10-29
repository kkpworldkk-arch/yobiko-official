"""
化学230選の口頭試問データを、参考書の問題ごとに作り直す（照合結果 data/chem-verify/results.jsonl を前提）。

方針（利用者の要望）:
- 参考書と合っている既存の小問は、そのまま残す。
- 問題番号は参考書の「第◯問」に合わせる。別の問題の内容が紛れていた小問は、本来の問題の小問に置き換える。
- 参考書の第◯問の小問（問1、問2、I、II…）が、すべて口頭試問に入るようにする。

結果: data/chem-verify/rebuilt.jsonl（1問1行）。途中で止めても再実行で続きから。
その後 `python scripts/chemistry-rebuild.py --write` で data/manual-import/chemistry-230.txt を書き直す
（元のファイルは chemistry-230.before-rebuild.txt として残す）。

使い方:
  python scripts/chemistry-rebuild.py --only 6,88,145   # 試し
  python scripts/chemistry-rebuild.py                   # 全部
  python scripts/chemistry-rebuild.py --write           # テンプレートに書き出し
"""
from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import json
import shutil
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("chemverify", ROOT / "scripts" / "chemistry-verify.py")
cv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cv)

REBUILT = cv.WORK / "rebuilt.jsonl"

SCHEMA = {
    "type": "object",
    "properties": {
        "chapter": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sub": {"type": "string"},
                    "origin": {"type": "string", "enum": ["kept", "fixed", "new"]},
                    "kind": {"type": "string", "enum": ["recall", "solve"]},
                    "prompt": {"type": "string"},
                    "answer": {"type": "string"},
                    "keywords": {"type": "array", "items": {"type": "string"}},
                    "accepted": {"type": "array", "items": {"type": "string"}},
                    "misconceptions": {"type": "array", "items": {"type": "string"}},
                    "numeric_answer": {"type": "string"},
                    "significant_figures": {"type": "integer"},
                },
                "required": ["sub", "origin", "kind", "prompt", "answer", "keywords", "accepted", "misconceptions", "numeric_answer", "significant_figures"],
                "additionalProperties": False,
            },
        },
        "skipped": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["chapter", "items", "skipped"],
    "additionalProperties": False,
}

PROMPT = """あなたは化学の問題集「化学頻出スタンダード問題230選」の第{n}問を、生徒向けの口頭試問（音声で出題する一問一答）データにする担当です。
添付は第{n}問の問題ページと、その解答・解説ページの画像です。下に、今あるデータと、紙面と照合した結果（点検メモ）を示します。

作り方:
1. 紙面の第{n}問の小問（I・II、問1・問2、(1)(2) など）をすべて洗い出し、各小問を1件以上の一問一答にする。紙面の小問は1つも漏らさない。
2. 今あるデータのうち、紙面と合っているものは文言を変えずにそのまま使う（origin: "kept"）。
   誤りがあるものは最小限だけ直す（origin: "fixed"）。第{n}問に無い内容のデータは使わない。
   紙面の小問に当たるデータが無ければ新しく作る（origin: "new"）。
3. 音声で出題するので、図・表・グラフは使えない。図の内容を言葉で言い換えれば答えられる場合は、問題文に言葉で書き込む。
   言い換えても答えられない小問だけ出題しない（skipped に「問3：グラフの読み取り」のように理由を書く）。
   選択肢の問題は、選択肢の中身を問題文に書き込むか、記述で答える形にする（「a〜dから選べ」のように記号だけでは出さない）。
4. 前の小問の答えを使う場合は、必要な値を問題文に書き足し、その件だけで解けるようにする。
5. 答え（answer）は解答ページの正解に基づく。計算問題（kind: "solve"）は numeric_answer に「0.50 mol」のように数値と単位を書き、
   有効数字の指定があれば significant_figures に桁数（無ければ 0）。暗記で答える問題は kind: "recall"。
   keywords には正解に必須の語、accepted には正解として認める言い換え、misconceptions には典型的な誤答を入れる（無ければ空）。
6. 文字は1行の文字だけで書く。化学式は H2O、Fe3+、CuSO4・5H2O のように書く。指数は 1.0×10^-3。
7. sub は紙面の小問の表記に合わせる（例 "I"、"問1"、"問2(1)"）。小問が無い問題は空文字。同じ sub は1件につき1回だけ使う。
   1つの小問を複数件に分ける場合は "問1(1)" "問1(2)" のように区別する。
8. chapter は今あるデータの章名をそのまま使う。

今あるデータ:
{current}

点検メモ（紙面との照合結果）:
{notes}
"""


def parse_template_full() -> dict[int, list[dict]]:
    import re
    text = "\n".join(l for l in cv.TEMPLATE.read_text(encoding="utf-8").splitlines() if not l.startswith("#"))
    out: dict[int, list[dict]] = {}
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
            out.setdefault(int(fields["N"].strip()), []).append({k: v.strip() for k, v in fields.items()})
    return out


def write_template() -> None:
    import re
    sys.path.insert(0, str(ROOT / "scripts"))
    rebuilt = {}
    for line in REBUILT.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            rebuilt[r["n"]] = r
    current = parse_template_full()
    pagemap = json.loads(cv.PAGEMAP.read_text(encoding="utf-8"))
    q_page: dict[int, int] = {}
    a_page: dict[int, int] = {}
    for i, numbers in sorted((int(k), v) for k, v in pagemap.items()):
        for n in numbers:
            (a_page if i >= cv.ANSWER_START else q_page).setdefault(n, i + 1)

    header = cv.TEMPLATE.read_text(encoding="utf-8").split("# ここから下に書いていく。")[0] + "# ここから下に書いていく。\n"
    blocks = []
    stats = {"kept": 0, "fixed": 0, "new": 0}
    for n in range(1, 231):
        r = rebuilt.get(n)
        if not r or r.get("error"):
            # 作り直せなかった問題は、今のデータをそのまま残す
            for f in current.get(n, []):
                blocks.append("\n".join(f"{k}: {v}" for k, v in f.items()))
            continue
        chapter = r["chapter"] or (current.get(n, [{}])[0].get("C", ""))
        for s in r.get("skipped", []):
            blocks.append(f"# N:{n} 飛ばし：{s}")
        seen = set()
        for item in r["items"]:
            sub = item["sub"].strip()
            if sub in seen:
                continue
            seen.add(sub)
            stats[item["origin"]] += 1
            lines = [f"N: {n}"]
            if sub:
                lines.append(f"S: {sub}")
            lines += [f"C: {chapter}", f"P: {q_page.get(n, 0)}", f"AP: {a_page.get(n, 0)}", f"T: {item['kind']}"]
            lines.append("Q: " + item["prompt"].strip())
            lines.append("A: " + item["answer"].strip())
            if item["keywords"]:
                lines.append("K: " + " / ".join(item["keywords"]))
            if item["accepted"]:
                lines.append("OK: " + " / ".join(item["accepted"]))
            if item["misconceptions"]:
                lines.append("NG: " + " / ".join(item["misconceptions"]))
            numeric = item["numeric_answer"].strip()
            if item["kind"] == "solve" and not numeric:
                numeric = item["answer"].strip().splitlines()[0][:60]
            if numeric:
                lines.append("U: " + numeric)
            if item["significant_figures"]:
                lines.append(f"SIG: {item['significant_figures']}")
            blocks.append("\n".join(lines))
    shutil.copyfile(cv.TEMPLATE, cv.TEMPLATE.with_name("chemistry-230.before-rebuild.txt"))
    body = "\n---\n".join(b for b in blocks if not b.startswith("#") or True)
    # コメント行の後ろに区切りが付かないよう整形
    out_lines = []
    for b in blocks:
        out_lines.append(b if b.startswith("#") else b + "\n---")
    cv.TEMPLATE.write_text(header + "\n" + "\n".join(out_lines) + "\n", encoding="utf-8")
    print(f"書き出し: そのまま {stats['kept']} / 修正 {stats['fixed']} / 新規 {stats['new']}（作り直し {len(rebuilt)}問）")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    cv.load_env()
    sys.stdout.reconfigure(encoding="utf-8")
    if args.write:
        write_template()
        return

    import base64
    import glob
    import pymupdf

    pdf = pymupdf.open([p for p in glob.glob(str(ROOT / "sankosho" / "*.pdf")) if "230" in p][0])
    lock = threading.Lock()
    verify = {}
    for line in cv.RESULTS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            verify[r["n"]] = r
    current = parse_template_full()
    done = set()
    if REBUILT.exists():
        done = {json.loads(l)["n"] for l in REBUILT.read_text(encoding="utf-8").splitlines() if l.strip() and not json.loads(l).get("error")}
    targets = [int(x) for x in args.only.split(",") if x.strip()] or list(range(1, 231))
    targets = [n for n in targets if n not in done]
    print(f"作り直し: {len(targets)}問", flush=True)

    def image(index: int) -> str:
        with lock:
            return base64.b64encode(pdf[index].get_pixmap(dpi=110).tobytes("png")).decode()

    def rebuild(n: int) -> dict:
        pages = verify.get(n, {}).get("pages") or []
        if not pages:
            return {"n": n, "error": "pages_unknown"}
        cur = [{"sub": f.get("S", ""), "kind": f.get("T", ""), "prompt": f.get("Q", ""), "answer": f.get("A", "")} for f in current.get(n, [])]
        notes = [{"sub": i["key"].split("|", 1)[1], "status": i["status"], "note": i["note"]} for i in verify.get(n, {}).get("items", [])]
        text = PROMPT.format(n=n, current=json.dumps(cur, ensure_ascii=False, indent=1), notes=json.dumps(notes, ensure_ascii=False, indent=1))
        out = cv.call_claude(cv.VERIFY_MODEL, text, [image(p) for p in pages], SCHEMA, "medium")
        return {"n": n, **out}

    finished = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(rebuild, n): n for n in targets}
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
            except Exception as error:
                result = {"n": futures[future], "error": str(error)[:300]}
                print(f"失敗 第{futures[future]}問: {error}", flush=True)
            with lock:
                with REBUILT.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(result, ensure_ascii=False) + "\n")
            finished += 1
            if finished % 20 == 0:
                print(f"{finished}/{len(targets)} 完了", flush=True)
    print("終了", flush=True)


if __name__ == "__main__":
    main()
