"""
data/manual-import/*.txt のテンプレートに貼り付けた問題を、口頭試問DBに取り込む。
OCRや画像処理は一切行わず、テキストファイルを読んでDBに書き込むだけ。

テキスト形式:
  C: カテゴリ(省略可)
  Q: 質問文
  A: 模範解答(複数行可)
  ---                <- 1問ごとに単独行の "---" で区切る
  (以降くり返し)
  "#" で始まる行はコメントとして無視される。

使い方:
  .venv\\Scripts\\python.exe scripts\\import-manual-questions.py --file data/manual-import/system-eitango-medical.txt --book "システム英単語メディカル"

オプション:
  --file   取り込むテキストファイル(必須)
  --book   対象の参考書タイトル(部分一致)。DBに同名の本が無い場合はエラーになる。
  --mode   append(既定・追加) または replace(その本の既存問題を全て削除してから取り込む)
  --dry-run  DBを更新せず、パース結果を表示するだけ
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


def strip_comments(text: str) -> str:
    lines = [line for line in text.splitlines() if not line.strip().startswith("#")]
    return "\n".join(lines)


def ensure_columns(conn: sqlite3.Connection) -> None:
    # Next.js側(src/lib/db.ts)のマイグレーションが開発サーバー起動時にしか走らないため、
    # サーバーを一度も起動していないとこの列がまだDBに存在しない。Pythonスクリプト単体でも
    # 動くよう、ここでも同じ列を保証しておく。
    columns = {row[1] for row in conn.execute("PRAGMA table_info(oral_exam_questions)")}
    if "reviewed_at" not in columns:
        conn.execute("ALTER TABLE oral_exam_questions ADD COLUMN reviewed_at TEXT")
    if "blocked" not in columns:
        conn.execute("ALTER TABLE oral_exam_questions ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0")
    conn.commit()


def parse_blocks(text: str, default_category: str) -> list[dict[str, str]]:
    text = strip_comments(text)
    raw_blocks = re.split(r"^\s*---\s*$", text, flags=re.MULTILINE)
    items: list[dict[str, str]] = []

    for raw in raw_blocks:
        if not raw.strip():
            continue
        category = default_category
        question_lines: list[str] = []
        answer_lines: list[str] = []
        mode: str | None = None

        for line in raw.splitlines():
            if line.startswith("C:"):
                category = line[2:].strip() or default_category
                mode = None
            elif line.startswith("Q:"):
                mode = "q"
                question_lines.append(line[2:].strip())
            elif line.startswith("A:"):
                mode = "a"
                answer_lines.append(line[2:].strip())
            elif mode == "q":
                question_lines.append(line.strip())
            elif mode == "a":
                answer_lines.append(line.strip())

        question = "\n".join(l for l in question_lines if l).strip()
        answer = "\n".join(l for l in answer_lines if l).strip()
        if not question or not answer:
            continue
        items.append({"category": category, "prompt": question, "modelAnswer": answer})

    return items


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
            "SELECT id, title FROM oral_exam_books WHERE title LIKE ?",
            (f"%{args.book}%",),
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
    items = parse_blocks(text, default_category=book_title)

    print(f"パース結果: {len(items)} 問 (対象: {book_title})")
    for index, item in enumerate(items[:5], start=1):
        print(f"  [{index}] Q: {item['prompt'][:40]}")
        print(f"       A: {item['modelAnswer'][:40]}")
    if len(items) > 5:
        print(f"  ...ほか {len(items) - 5} 問")

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

    order_index = conn.execute(
        "SELECT COALESCE(MAX(order_index), -1) FROM oral_exam_questions WHERE book_id = ?",
        (book_id,),
    ).fetchone()[0] + 1
    created_at = datetime.now(timezone.utc).isoformat()

    inserted = 0
    for item in items:
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
