"""
黄チャート（Codexなどでテキスト化した参考書本文）から、口頭試問の問題を
AIを一切使わずに機械的に抽出してDBに取り込む。

対応する構造:
  第N章 ...                       → カテゴリに使う章見出し(任意)
  基本例題N  サブタイトル / 重要例題N  サブタイトル
  <問題文。「次の〜せよ。」のような指示文の後に (1) (2) (3) ... または
   （ア）（イ）（ウ）... の形で項目が続く>
  最終結果
  <(1) (2) (3) ... にそれぞれ対応する答え>

問題側の項目番号と解答側の項目番号が完全に一致する場合は項目ごとに分割して
取り込む。一致しない(入れ子の番号・別形式の注記などで判定できない)場合は、
誤った組み合わせを作らないよう分割せず、問題文全体・答え全体を1問として
まとめて取り込み、警告として表示する(内容は後で確認できる)。

使い方:
  .venv\\Scripts\\python.exe scripts\\import-yellow-chart.py --file data/manual-import/yellow-chart-1a-ch1.txt --book "黄チャート式 解法と演習 数学1+A" --dry-run

  問題なければ --dry-run を外して実行。--mode replace で対象の本の既存問題を
  全て入れ替える(既定は追加)。
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"

CHAPTER_RE = re.compile(r"第\s*\d+\s*章.*$")
HEADER_RE = re.compile(r"^(基本|重要|補充)例題\s*(\d+)\s+(\S.*)$")
RESULT_MARKER_RE = re.compile(r"^最終結果\s*$")
ITEM_MARKER_RE = re.compile(r"[（(]\s*([0-9]+|[アイウエオカキクケコサシスセソ])\s*[）)]")
# 「1. イ　2. ウ」のように、カッコではなく「数字+ピリオド+空白」で項目を
# 区切る本もある。小数(0.342 など)はピリオドの直後に空白が来ないので
# 誤認識しない。
PERIOD_MARKER_RE = re.compile(r"(?:^|(?<=\s)|(?<=、)|(?<=。))([0-9]+)\.\s+")

# PDFのスタック分数などがテキスト化の際に文字化けすると、この範囲の文字
# (ベンガル文字〜タイ文字など、通常の日本語/数式では使わない文字)として
# 出てくることが多い。見つけたら警告だけ出す(取り込みは止めない)。
GARBAGE_RE = re.compile(r"[ऀ-๿]")


def ensure_columns(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(oral_exam_questions)")}
    if "reviewed_at" not in columns:
        conn.execute("ALTER TABLE oral_exam_questions ADD COLUMN reviewed_at TEXT")
    if "blocked" not in columns:
        conn.execute("ALTER TABLE oral_exam_questions ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0")
    conn.commit()


def _split_by_markers(text: str, marker_re: re.Pattern[str]) -> tuple[str, list[tuple[str, str]]]:
    matches = list(marker_re.finditer(text))
    if not matches:
        return text.strip(), []
    prefix = text[: matches[0].start()].strip()
    items: list[tuple[str, str]] = []
    for i, m in enumerate(matches):
        label = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if content:
            items.append((label, content))
    return prefix, items


def split_items(text: str) -> tuple[str, list[tuple[str, str]]]:
    prefix, items = _split_by_markers(text, ITEM_MARKER_RE)
    if items:
        return prefix, items
    # （1）（2）形式が無ければ「1. 」形式を試す
    return _split_by_markers(text, PERIOD_MARKER_RE)


def clean_math_prompt(text: str) -> str:
    # 問題番号はカテゴリで管理するため、本文先頭に重複している見出しだけ除く。
    return re.sub(r"^\s*(?:問|問題|例題)\s*[0-9０-９]+\s*[:：、.)）]?\s*", "", text).strip()


def parse(text: str, book_title: str) -> tuple[list[dict[str, str]], list[str]]:
    lines = text.splitlines()
    header_positions = [i for i, line in enumerate(lines) if HEADER_RE.match(line.strip())]

    chapter_at: dict[int, str] = {}
    current_chapter = ""
    for i, line in enumerate(lines):
        if CHAPTER_RE.search(line.strip()):
            current_chapter = line.strip()
        chapter_at[i] = current_chapter

    items_out: list[dict[str, str]] = []
    warnings: list[str] = []

    for idx, hpos in enumerate(header_positions):
        end = header_positions[idx + 1] if idx + 1 < len(header_positions) else len(lines)
        header_match = HEADER_RE.match(lines[hpos].strip())
        assert header_match
        kind, number, title = header_match.group(1), header_match.group(2), header_match.group(3).strip()
        chapter = chapter_at[hpos]
        category = f"{book_title} - {chapter} {kind}例題 {title}".strip()

        block_lines = lines[hpos + 1 : end]
        marker_idx = next(
            (j for j, l in enumerate(block_lines) if RESULT_MARKER_RE.match(l.strip())), None
        )
        if marker_idx is None:
            warnings.append(f"[{kind}例題{number}] 「最終結果」が見つからないためスキップ")
            continue

        problem_text = clean_math_prompt("\n".join(block_lines[:marker_idx]))
        answer_text = "\n".join(block_lines[marker_idx + 1 :]).strip()

        prefix_q, items_q = split_items(problem_text)
        prefix_a, items_a = split_items(answer_text)

        if not items_q:
            if not problem_text or not answer_text:
                warnings.append(f"[{kind}例題{number}] 問題文または答えが空のためスキップ")
                continue
            items_out.append(
                {"category": category, "prompt": problem_text, "modelAnswer": answer_text}
            )
            continue

        if [l for l, _ in items_q] != [l for l, _ in items_a]:
            if not problem_text or not answer_text:
                # 答え(図示のみなど、テキストで表せない解答)が空の場合は、
                # 統合しても口頭試問として使えないので取り込まない。
                warnings.append(
                    f"[{kind}例題{number}] 問題文または答えが空のためスキップ"
                )
                continue
            # 項目番号が一致しない(入れ子番号・別形式の注記など)場合、誤った
            # 組み合わせを作るより、問題文全体と答え全体を1問として
            # まとめて取り込む方が安全。警告は出すが取り込みはする。
            warnings.append(
                f"[{kind}例題{number}] 問題の項目番号 {[l for l, _ in items_q]} と"
                f" 答えの項目番号 {[l for l, _ in items_a]} が一致しないため、"
                "分割せず1問として統合しました(内容を確認してください)"
            )
            items_out.append(
                {"category": category, "prompt": problem_text, "modelAnswer": answer_text}
            )
            continue

        for (label, qtext), (_, atext) in zip(items_q, items_a):
            prompt = f"{prefix_q} ({label}) {qtext}".strip()
            items_out.append({"category": category, "prompt": prompt, "modelAnswer": atext})

    return items_out, warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--book", required=True)
    parser.add_argument("--mode", choices=["append", "replace"], default="append")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.file.exists():
        print(f"ファイルが見つかりません: {args.file}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(DB_PATH))
    ensure_columns(conn)
    exact = conn.execute(
        "SELECT id, title FROM oral_exam_books WHERE title = ?", (args.book,)
    ).fetchone()
    if exact:
        book_id, book_title = exact
    else:
        matches = conn.execute(
            "SELECT id, title FROM oral_exam_books WHERE title LIKE ?", (f"%{args.book}%",)
        ).fetchall()
        if not matches:
            print(f"参考書が見つかりません(部分一致で検索): {args.book}", file=sys.stderr)
            return 1
        if len(matches) > 1:
            print(
                f"「{args.book}」が複数の本に一致しました。安全のため停止します。"
                "--book に完全なタイトルを指定してください:",
                file=sys.stderr,
            )
            for _, title in matches:
                print(f"  - {title}", file=sys.stderr)
            return 1
        book_id, book_title = matches[0]

    text = args.file.read_text(encoding="utf-8")
    items, warnings = parse(text, book_title)

    print(f"パース結果: {len(items)} 問 (対象: {book_title})")
    for index, item in enumerate(items[:6], start=1):
        print(f"  [{index}] ({item['category']})")
        print(f"       Q: {item['prompt']}")
        print(f"       A: {item['modelAnswer']}")
    if len(items) > 6:
        print(f"  ...ほか {len(items) - 6} 問")

    if warnings:
        print(f"\n警告 ({len(warnings)}件。取り込みはしていますが、要確認):")
        for w in warnings:
            print(f"  - {w}")

    garbage_hits = [
        item
        for item in items
        if GARBAGE_RE.search(item["prompt"]) or GARBAGE_RE.search(item["modelAnswer"])
    ]
    if garbage_hits:
        print(f"\n文字化けの疑いがある問題 ({len(garbage_hits)}件、取り込みはされます。後で手動確認してください):")
        for item in garbage_hits:
            print(f"  - {item['category']}: {item['prompt'][:40]}")

    if args.dry_run:
        conn.close()
        return 0

    if not items:
        print("取り込む問題がありませんでした。", file=sys.stderr)
        conn.close()
        return 1

    if args.mode == "replace":
        old_ids = [
            r[0]
            for r in conn.execute(
                "SELECT id FROM oral_exam_questions WHERE book_id = ?", (book_id,)
            )
        ]
        for qid in old_ids:
            conn.execute("DELETE FROM oral_exam_mastery WHERE question_id = ?", (qid,))
        conn.execute("DELETE FROM oral_exam_questions WHERE book_id = ?", (book_id,))
        if old_ids:
            print(f"replace: 既存 {len(old_ids)} 問を削除しました")

    order_index = (
        conn.execute(
            "SELECT COALESCE(MAX(order_index), -1) FROM oral_exam_questions WHERE book_id = ?",
            (book_id,),
        ).fetchone()[0]
        + 1
    )
    created_at = datetime.now(timezone.utc).isoformat()

    inserted = 0
    for item in items:
        # 機械的パースなので内容の正しさは未保証。reviewed_at は NULL のままにして、
        # 実際に生徒に出題される際の既存の口頭試問レビュー(AI)に任せる。
        conn.execute(
            """INSERT INTO oral_exam_questions
            (id, book_id, order_index, category, prompt, model_answer, created_at, reviewed_at, blocked)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0)""",
            (
                str(uuid.uuid4()),
                book_id,
                order_index,
                item["category"],
                item["prompt"],
                item["modelAnswer"],
                created_at,
            ),
        )
        order_index += 1
        inserted += 1

    conn.commit()
    conn.close()
    print(f"完了: {inserted} 問を取り込みました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
