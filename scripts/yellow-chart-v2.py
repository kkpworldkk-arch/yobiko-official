"""
黄チャートの口頭試問データを、取り込み元のテキスト（data/manual-import/ の黄チャート用ファイル）から作り直す（API は使わない）。

- 例題ごとに、問題文と「最終結果」を小問 (1)(2)… 単位で対応づける。
- 取り込み時の記法（[a]/[b]、x^[2] など）を普通の数式表記に直す。
- 口頭試問に向かない・崩れている可能性がある小問に印（flags）を付ける。印の付いたものは人が確認して
  data/yellow-chart/overrides.json で書き直す。
- 数式の読み上げ用の文を、規則で作る。

出力: data/yellow-chart/v2.json（参考書の本文を含むので git には入れない）

使い方:
  python scripts/yellow-chart-v2.py            # v2.json を作る
  python scripts/yellow-chart-v2.py --stats    # 印の集計だけ表示
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMPORT_DIR = ROOT / "data" / "manual-import"
OUT = ROOT / "data" / "yellow-chart" / "v2.json"
OVERRIDES = ROOT / "data" / "yellow-chart" / "overrides.json"

SOURCES = [
    ("黄チャート式 解法と演習 数学1+A", "数学I", "yellow-chart-1a-ch*.txt"),
    ("黄チャート式 解法と演習 数学1+A", "数学A", "yellow-chart-A-*.txt"),
    ("黄チャート式 解法と演習 数学2+B", "数学II", "math2b-II-*.txt"),
    ("黄チャート式 解法と演習 数学2+B", "数学B", "math2b-B-*.txt"),
    ("黄チャート式 解法と演習 数学3+C", "数学III", "math3c-III-*.txt"),
    ("黄チャート式 解法と演習 数学3+C", "数学C", "math3c-C-*.txt"),
]

HEADER_RE = re.compile(r"^\s*(基本|重要|補充)?例題\s*(\d+)\s*(.*)$")
CHAPTER_RE = re.compile(r"第\s*\d+\s*章.*$")
RESULT_RE = re.compile(r"^\s*最終結果\s*$")
ITEM_RE = re.compile(r"[（(]\s*([0-9]+|[アイウエオカキクケコ])\s*[）)]")
PERIOD_RE = re.compile(r"(?:^|(?<=\s)|(?<=、)|(?<=。))([0-9]+)\.\s+")
GARBAGE_RE = re.compile(r"[ऀ-๿�]")

SUP = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "n": "ⁿ", "-": "⁻", "−": "⁻", "+": "⁺"}
SUB = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "n": "ₙ", "k": "ₖ", "+": "₊", "-": "₋", "−": "₋"}


def atom(s: str) -> bool:
    return bool(re.fullmatch(r"[\w.πθαβγ′']+", s)) or bool(re.fullmatch(r"\(.*\)", s)) or bool(re.fullmatch(r"√\w+", s))


def wrap(s: str) -> str:
    return s if atom(s) else f"({s})"


def script(s: str, table: dict, fallback: str) -> str:
    return "".join(table[c] for c in s) if s and all(c in table for c in s) else fallback


def normalize(text: str) -> str:
    """取り込み時の記法を、画面で読める数式表記に直す。"""
    prev = None
    out = text
    while out != prev:
        prev = out
        out = re.sub(r"\[([^\[\]]*)\]/\[([^\[\]]*)\]", lambda m: f"{wrap(m.group(1))}/{wrap(m.group(2))}", out)
        out = re.sub(r"\^\[([^\[\]]*)\]", lambda m: script(m.group(1), SUP, f"^({m.group(1)})"), out)
        out = re.sub(r"_\[([^\[\]]*)\]", lambda m: script(m.group(1), SUB, f"_({m.group(1)})"), out)
        out = re.sub(r"√\[([^\[\]]*)\]", lambda m: f"√{wrap(m.group(1))}", out)
    out = re.sub(r"^\s*(?:問題|問|例題)\s*[0-9０-９]*\s*[:：、.)）]?\s+", "", out)
    out = re.sub(r"[ \t　]{2,}", " ", out)
    return out.strip()


def split_items(text: str) -> tuple[str, list[tuple[str, str]]]:
    for marker in (ITEM_RE, PERIOD_RE):
        matches = list(marker.finditer(text))
        if not matches:
            continue
        # 小問の印は (1) か (ア) のどちらかの系列にそろえる（(1) の中の (ア) を別の小問と取り違えない）
        first_kind = matches[0].group(1).isdigit()
        matches = [m for m in matches if m.group(1).isdigit() == first_kind]
        items = []
        for i, m in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            items.append((m.group(1), text[m.end():end].strip()))
        # 同じ印が重複する（本文中の (1) の参照など）なら分割しない
        labels = [l for l, _ in items]
        if len(set(labels)) != len(labels):
            return text.strip(), []
        return text[: matches[0].start()].strip(), items
    return text.strip(), []


def flags_for(prompt: str, answer: str) -> list[str]:
    f = []
    if re.search(r"グラフ(?:の概形)?を?(?:かけ|描け|かき|図示)|図示せよ|図示し", prompt):
        f.append("graph")
    if re.search(r"証明せよ|示せ|証明しなさい", prompt):
        f.append("proof")
    if "□" in prompt or "□" in answer:
        f.append("blank")
    if GARBAGE_RE.search(prompt + answer):
        f.append("garbage")
    if not answer.strip():
        f.append("no_answer")
    if re.search(r"図|右の|左の|下の表|次の表", prompt):
        f.append("figure_ref")
    if prompt.count("(") != prompt.count(")") or answer.count("(") != answer.count(")"):
        f.append("paren")
    # 崩れた数式の手がかり：同じ英字の不自然な連続、∫ や Σ や lim の後に範囲・式が無い
    if re.search(r"(?<![a-zA-Z])([a-z])\1{1,}[a-z]", prompt) or re.search(r"∫\s*(?:d|$)", prompt):
        f.append("garbled_math")
    # 積分記号と上下端が文字化けで消えている（「定積分 −33(…) dx」のような形）
    if (re.search(r"d[xtθ]", prompt) or "定積分" in prompt) and "∫" not in prompt:
        f.append("garbled_integral")
    if re.search(r"Σ\s*[^\[(\w]|lim\s*[^\[(_\w]", prompt):
        f.append("garbled_math")
    if len(prompt) > 220:
        f.append("long")
    return f


def parse_file(path: Path, book: str, part: str) -> list[dict]:
    lines = path.read_text(encoding="utf-8").splitlines()
    chapter = ""
    headers = []
    for i, line in enumerate(lines):
        if CHAPTER_RE.search(line.strip()) and not HEADER_RE.match(line):
            chapter = line.strip()
        h = HEADER_RE.match(line)
        if h:
            headers.append((i, h.group(1) or "基本", int(h.group(2)), h.group(3).strip(), chapter))
    examples = []
    for idx, (pos, kind, number, title, chap) in enumerate(headers):
        end = headers[idx + 1][0] if idx + 1 < len(headers) else len(lines)
        block = lines[pos + 1 : end]
        mark = next((j for j, l in enumerate(block) if RESULT_RE.match(l)), None)
        ex = {"book": book, "part": part, "number": number, "kind": kind, "title": normalize(title), "chapter": chap, "source": path.name}
        if mark is None:
            ex["items"] = []
            ex["error"] = "最終結果なし"
            examples.append(ex)
            continue
        problem = "\n".join(block[:mark]).strip()
        answer = "\n".join(block[mark + 1 :]).strip()
        pre_q, items_q = split_items(problem)
        pre_a, items_a = split_items(answer)
        items = []
        if items_q and items_a and [l for l, _ in items_q] == [l for l, _ in items_a]:
            for (label, q), (_, a) in zip(items_q, items_a):
                prompt = f"{pre_q}\n({label}) {q}".strip() if pre_q else f"({label}) {q}"
                items.append({"sub": f"({label})", "prompt": normalize(prompt), "answer": normalize(a)})
        elif items_q and items_a and len(items_q) == len(items_a):
            for (label, q), (_, a) in zip(items_q, items_a):
                prompt = f"{pre_q}\n({label}) {q}".strip() if pre_q else f"({label}) {q}"
                items.append({"sub": f"({label})", "prompt": normalize(prompt), "answer": normalize(a), "align": "by_count"})
        else:
            items.append({"sub": "", "prompt": normalize(problem), "answer": normalize(answer), "merged": bool(items_q)})
        for item in items:
            item["flags"] = flags_for(item["prompt"], item["answer"]) + (["merged"] if item.get("merged") else []) + (["align"] if item.get("align") else [])
        ex["items"] = items
        examples.append(ex)
    return examples


# ---------- 読み上げ用の文（規則で作る） ----------
NUM_JA = {"0": "ゼロ", "1": "いち", "2": "に", "3": "さん", "4": "よん", "5": "ご", "6": "ろく", "7": "なな", "8": "はち", "9": "きゅう"}
LETTER = {"a": "エー", "b": "ビー", "c": "シー", "d": "ディー", "e": "イー", "f": "エフ", "g": "ジー", "h": "エイチ", "i": "アイ", "j": "ジェー", "k": "ケー",
          "l": "エル", "m": "エム", "n": "エヌ", "o": "オー", "p": "ピー", "q": "キュー", "r": "アール", "s": "エス", "t": "ティー", "u": "ユー", "v": "ブイ",
          "w": "ダブリュー", "x": "エックス", "y": "ワイ", "z": "ゼット"}
SUP_REV = {v: k for k, v in SUP.items()}
SUB_REV = {v: k for k, v in SUB.items()}
SYMBOL = [
    ("≦", "以下"), ("≧", "以上"), ("≤", "以下"), ("≥", "以上"), ("≠", "ノットイコール"), ("＝", "イコール"), ("=", "イコール"),
    ("<", "小なり"), (">", "大なり"), ("＜", "小なり"), ("＞", "大なり"), ("±", "プラスマイナス"), ("×", "かける"), ("÷", "わる"),
    ("+", "プラス"), ("＋", "プラス"), ("−", "マイナス"), ("-", "マイナス"), ("√", "ルート"), ("π", "パイ"), ("θ", "シータ"), ("α", "アルファ"),
    ("β", "ベータ"), ("γ", "ガンマ"), ("∞", "無限大"), ("∫", "インテグラル"), ("Σ", "シグマ"), ("∩", "かつ"), ("∪", "または"), ("∈", "の要素"),
    ("⊂", "の部分集合"), ("°", "度"), ("′", "ダッシュ"), ("|", "絶対値"), ("→", "ベクトル"), ("·", "ドット"), ("・", "、"),
]


def read_number(s: str) -> str:
    return s  # 数字はそのまま読ませる（読み上げエンジンが「123」を正しく読む）


MODIFIER = {"ˣ": "x", "ʸ": "y", "ᵗ": "t", "ᵏ": "k", "ᵃ": "a", "ᵇ": "b"}


def _operand_left(s: str, end: int) -> int:
    """s[:end] の末尾にある被演算子（括弧のまとまり、または語）の開始位置。"""
    i = end - 1
    if i >= 0 and s[i] == ")":
        depth = 0
        while i >= 0:
            depth += {")": 1, "(": -1}.get(s[i], 0)
            if depth == 0:
                break
            i -= 1
        return max(i, 0)
    while i >= 0 and re.match(r"[\w.√⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉ₙπθ]", s[i]):
        i -= 1
    return i + 1


def _operand_right(s: str, start: int) -> int:
    """s[start:] の先頭にある被演算子の終了位置（含まない）。"""
    i = start
    if i < len(s) and s[i] == "(":
        depth = 0
        while i < len(s):
            depth += {"(": 1, ")": -1}.get(s[i], 0)
            if depth == 0:
                return i + 1
            i += 1
        return len(s)
    while i < len(s) and re.match(r"[\w.√⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉ₙπθ]", s[i]):
        i += 1
    return i


def fractions_to_speech(text: str) -> str:
    """a/b、(式)/(式) を「b分のa」の読み方にする（入れ子の括弧にも対応）。"""
    out = text
    for _ in range(10):
        pos = out.find("/")
        if pos <= 0 or pos >= len(out) - 1:
            break
        left = _operand_left(out, pos)
        right = _operand_right(out, pos + 1)
        num = out[left:pos]
        den = out[pos + 1:right]
        if not num or not den:
            out = out[:pos] + "／" + out[pos + 1:]  # 読めない形は記号を残して次へ
            continue
        strip = lambda x: x[1:-1] if x.startswith("(") and x.endswith(")") else x
        out = out[:left] + f"、{strip(den)}分の{strip(num)}、" + out[right:]
    return out.replace("／", "/")


def speech(text: str) -> str:
    """数式をざっくり日本語の読み方にする。日本語の部分はそのまま。"""
    out = fractions_to_speech(text)
    for mod, letter in MODIFIER.items():
        out = out.replace(mod, f"の{letter}乗")
    # 上付き
    out = re.sub(r"([\w)])([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁻⁺]+)", lambda m: m.group(1) + ("の二乗" if m.group(2) == "²" else "の三乗" if m.group(2) == "³" else "の" + "".join(SUP_REV.get(c, c) for c in m.group(2)) + "乗"), out)
    out = re.sub(r"\^\(([^()]+)\)", lambda m: f"の{m.group(1)}乗", out)
    # 下付き
    out = re.sub(r"([A-Za-z])([₀₁₂₃₄₅₆₇₈₉ₙₖ₊₋]+)", lambda m: m.group(1) + "".join(SUB_REV.get(c, c) for c in m.group(2)), out)
    for sym, word in SYMBOL:
        out = out.replace(sym, f" {word} ")
    # 半角英字1文字（変数）をカタカナに。単語（sin, cos, log, lim など）はそのまま
    def letters(m: re.Match) -> str:
        w = m.group(0)
        if w.lower() in ("sin", "cos", "tan", "log", "lim", "max", "min"):
            return {"sin": "サイン", "cos": "コサイン", "tan": "タンジェント", "log": "ログ", "lim": "リミット", "max": "マックス", "min": "ミニマム"}[w.lower()]
        return "".join(LETTER.get(c.lower(), c) for c in w) if len(w) <= 3 else w
    out = re.sub(r"(?<![A-Za-z])[A-Za-z]{1,3}(?![A-Za-z])", letters, out)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stats", action="store_true")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    examples = []
    for book, part, pattern in SOURCES:
        for path in sorted(IMPORT_DIR.glob(pattern)):
            examples.extend(parse_file(path, book, part))
    # 同じ (科目, 番号) が複数ファイルにある場合は、小問の多い方を採る
    best: dict[tuple, dict] = {}
    for ex in examples:
        key = (ex["book"], ex["part"], ex["number"])
        if key not in best or len(ex.get("items", [])) > len(best[key].get("items", [])):
            best[key] = ex
    examples = sorted(best.values(), key=lambda e: (e["book"], e["part"], e["number"]))
    # 取り込み元のテキストに無かった例題（紙面から読み取って data/yellow-chart/missing-examples.json に書いたもの）
    missing_path = OUT.parent / "missing-examples.json"
    if missing_path.exists():
        have = {(e["part"], e["number"]) for e in examples}
        for key, ex in json.loads(missing_path.read_text(encoding="utf-8")).items():
            part, number = key.split("|")
            if (part, int(number)) in have:
                continue
            examples.append({"book": ex["book"], "part": part, "number": int(number), "kind": ex["kind"], "title": ex["title"],
                             "chapter": "", "source": "missing-examples.json",
                             "items": [{**item, "flags": [], "patched": True} for item in ex["items"]]})
        examples.sort(key=lambda e: (e["book"], e["part"], e["number"]))
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    for ex in examples:
        key = f"{ex['part']}|{ex['number']}"
        if key in overrides:
            ex["items"] = overrides[key]["items"]
            ex["overridden"] = True
        # 小問単位の書き直し（キーは「科目|番号|小問」。小問が無い例題は「科目|番号|」）
        for i, item in enumerate(ex.get("items", [])):
            patch = overrides.get(f"{key}|{item['sub']}")
            if patch is not None:
                ex["items"][i] = {**item, **patch, "flags": [], "patched": True}
        ex["items"] = [item for item in ex.get("items", []) if not item.get("skip")]
        for item in ex.get("items", []):
            item.setdefault("speech", speech(item["prompt"]))
    OUT.write_text(json.dumps(examples, ensure_ascii=False, indent=1), encoding="utf-8")
    counts: dict[str, int] = {}
    total = 0
    for ex in examples:
        for item in ex.get("items", []):
            total += 1
            if ex.get("overridden") or item.get("patched"):
                continue
            for f in item.get("flags", []):
                counts[f] = counts.get(f, 0) + 1
    flagged = sum(1 for ex in examples if not ex.get("overridden") for i in ex.get("items", []) if i.get("flags") and not i.get("patched"))
    print(f"例題 {len(examples)} / 小問 {total} / 要確認の小問 {flagged} / 書き直し済み例題 {sum(1 for e in examples if e.get('overridden'))}")
    print("印の内訳:", json.dumps(counts, ensure_ascii=False))
    errors = [f"{e['part']}{e['number']}" for e in examples if e.get("error")]
    if errors:
        print("最終結果が無い例題:", ", ".join(errors))


if __name__ == "__main__":
    main()
