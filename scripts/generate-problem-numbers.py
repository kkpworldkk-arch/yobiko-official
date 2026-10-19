"""
既存の口頭試問の問題に「本の問題番号」を振るための対応表を作る。

問題の取り込み時に本の番号を保存していなかった参考書（黄チャート3冊・システム英単語2冊）について、
取り込み元のテキスト（data/manual-import/、git管理外）と DB の問題を照合し、
  { 問題ID: [本の問題番号, 小問ラベル] }
を src/lib/oral-exam-problem-numbers.json に書き出す。
中身は ID と番号だけで、参考書の本文は含まない（リポジトリに入れてよい）。
アプリ起動時に src/lib/db.ts が、番号の空いている問題へこの表から番号を入れる。

使い方:
  python scripts/generate-problem-numbers.py
"""
from __future__ import annotations

import collections
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"
IMPORT_DIR = ROOT / "data" / "manual-import"
OUT_PATH = ROOT / "src" / "lib" / "oral-exam-problem-numbers.json"

MATH_BOOKS = {
    "黄チャート式 解法と演習 数学1+A": ["yellow-chart-1a-ch*.txt", "yellow-chart-A-*.txt"],
    "黄チャート式 解法と演習 数学2+B": ["math2b-*.txt"],
    "黄チャート式 解法と演習 数学3+C": ["math3c-*.txt"],
}
EXAMPLE_HEADER_RE = re.compile(r"^\s*(基本|重要|補充|演習)?例題\s*(\d+)\s*(.*)$")
CATEGORY_EXAMPLE_RE = re.compile(r"(基本|重要|補充|演習)例題\s+(.*)$")
SUB_LABEL_RE = re.compile(r"[（(]\s*([0-9０-９]+)\s*[）)]")


def norm(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def book_id(conn: sqlite3.Connection, title: str) -> str:
    row = conn.execute("SELECT id FROM oral_exam_books WHERE title = ?", (title,)).fetchone()
    if not row:
        sys.exit(f"参考書が見つかりません: {title}")
    return row[0]


def sub_label(prompt: str) -> str:
    # 小問ごとに分けて取り込んだ問題は「共通の指示文 + (2) 小問」の形になっている。
    # 数字の小問番号がちょうど1種類だけ含まれていれば、それをこの問題の小問番号とみなす。
    # 「(1)、(2) が成り立つことを示せ」のように複数あるものは、分けていない問題なので付けない。
    labels = {unicodedata.normalize("NFKC", m) for m in SUB_LABEL_RE.findall(prompt)}
    return f"({labels.pop()})" if len(labels) == 1 else ""


def map_math(conn: sqlite3.Connection, title: str, patterns: list[str], out: dict) -> None:
    numbers: dict[tuple[str, str], set[int]] = collections.defaultdict(set)
    for pattern in patterns:
        for path in IMPORT_DIR.glob(pattern):
            for line in path.read_text(encoding="utf-8").splitlines():
                header = EXAMPLE_HEADER_RE.match(line.strip())
                if header and header.group(3):
                    numbers[(header.group(1) or "", norm(header.group(3)))].add(int(header.group(2)))

    rows = conn.execute(
        "SELECT id, category, prompt FROM oral_exam_questions WHERE book_id = ?", (book_id(conn, title),)
    ).fetchall()
    unmatched = 0
    for qid, category, prompt in rows:
        match = CATEGORY_EXAMPLE_RE.search(category)
        candidates = numbers.get((match.group(1), norm(match.group(2))), set()) if match else set()
        if len(candidates) != 1:
            unmatched += 1
            continue
        out[qid] = [next(iter(candidates)), sub_label(prompt)]
    print(f"{title}: {len(rows) - unmatched}/{len(rows)} 問に番号を付与")


def read_vocab(path: Path) -> list[list[str]]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or "\t" not in line:
            continue
        cols = line.split("\t")
        if cols[0].strip().isdigit():
            rows.append(cols)
    return rows


QUOTED_RE = re.compile(r"「(.+)」")


def map_vocab(conn: sqlite3.Connection, title: str, filename: str, out: dict) -> None:
    words: dict[str, set[int]] = collections.defaultdict(set)
    phrases: dict[str, set[int]] = collections.defaultdict(set)
    for cols in read_vocab(IMPORT_DIR / filename):
        number = int(cols[0])
        words[norm(cols[1])].add(number)
        if len(cols) >= 4 and cols[3].strip():
            phrases[norm(cols[3])].add(number)

    rows = conn.execute(
        "SELECT id, prompt FROM oral_exam_questions WHERE book_id = ? ORDER BY order_index",
        (book_id(conn, title),),
    ).fetchall()
    # 同じ単語が本に複数回載っている場合（at・in・on など）は、取り込み順に若い番号から割り当てる。
    used: dict[tuple[bool, str], int] = collections.defaultdict(int)
    unmatched = 0
    for qid, prompt in rows:
        quoted = QUOTED_RE.search(prompt)
        key = norm(quoted.group(1)) if quoted else ""
        is_phrase = "表現" in prompt
        candidates = sorted((phrases if is_phrase else words).get(key, set()))
        index = used[(is_phrase, key)]
        if index >= len(candidates):
            unmatched += 1
            continue
        used[(is_phrase, key)] += 1
        out[qid] = [candidates[index], "(フレーズ)" if is_phrase else ""]
    print(f"{title}: {len(rows) - unmatched}/{len(rows)} 問に番号を付与")


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    out: dict[str, list] = {}
    for title, patterns in MATH_BOOKS.items():
        map_math(conn, title, patterns, out)
    map_vocab(conn, "システム英単語", "system-eitango.txt", out)
    map_vocab(conn, "システム英単語 メディカル", "system-eitango-medical.txt", out)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(out)} 件を {OUT_PATH.relative_to(ROOT)} に書き出しました")


if __name__ == "__main__":
    main()
