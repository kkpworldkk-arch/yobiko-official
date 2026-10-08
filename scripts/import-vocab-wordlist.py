"""
「番号 タブ 英単語 タブ 日本語訳 タブ 例文(英語) タブ 例文訳(日本語)」のタブ区切り形式
(他のAIアプリの出力をそのまま貼り付けたもの)から、口頭試問の問題を自動生成してDBに
取り込む。AIは一切使わない機械的な変換なので、費用も待ち時間もかからない。

1行につき最大2問を作る:
  - 「{英単語}」の意味を日本語で答えてください。 → {日本語訳}
  - 次の表現を日本語に訳してください：「{例文}」 → {例文訳}

「Section 1: Essential Stage (No. 1 - 270)」のような行はカテゴリとして扱い、
以降の問題のカテゴリに自動で使う。

使い方:
  .venv\\Scripts\\python.exe scripts\\import-vocab-wordlist.py --file data/manual-import/system-eitango-medical.txt --book "システム英単語メディカル" --dry-run

  問題なければ --dry-run を外して実行。--mode replace を付けると対象の本の既存問題を
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

SECTION_RE = re.compile(r"^Section\s+\d+[:：]\s*(.+)$")


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


def parse(text: str, book_title: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    section = book_title

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        section_match = SECTION_RE.match(stripped)
        if section_match:
            section = f"{book_title} - {section_match.group(1).strip()}"
            continue

        parts = line.split("\t")
        # 先頭列が通し番号(数字)で、3列(番号・単語・意味)または5列
        # (番号・単語・意味・例文・例文訳)の行だけを対象にする。
        if not parts[0].strip().isdigit():
            continue
        fields = [p.strip() for p in parts[1:]]

        word = meaning = phrase = phrase_ja = ""
        if len(fields) >= 2:
            word, meaning = fields[0], fields[1]
        if len(fields) >= 4:
            phrase, phrase_ja = fields[2], fields[3]

        if word and meaning:
            items.append(
                {
                    "category": section,
                    "prompt": f"「{word}」の意味を日本語で答えてください。",
                    "modelAnswer": meaning,
                }
            )
        if phrase and phrase_ja:
            items.append(
                {
                    "category": section,
                    "prompt": f"次の表現を日本語に訳してください：「{phrase}」",
                    "modelAnswer": phrase_ja,
                }
            )

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
    items = parse(text, book_title)

    print(f"パース結果: {len(items)} 問 (対象: {book_title})")
    for index, item in enumerate(items[:6], start=1):
        print(f"  [{index}] ({item['category']}) Q: {item['prompt']}")
        print(f"       A: {item['modelAnswer']}")
    if len(items) > 6:
        print(f"  ...ほか {len(items) - 6} 問")

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
        # 単語帳は機械的に正確なデータ(AI不使用)なので、出題前のAI点検は不要。
        # reviewed_at を最初から埋めておき、点検をスキップさせる。
        conn.execute(
            """INSERT INTO oral_exam_questions
            (id, book_id, order_index, category, prompt, model_answer, created_at, reviewed_at, blocked)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                str(uuid.uuid4()),
                book_id,
                order_index,
                item["category"],
                item["prompt"],
                item["modelAnswer"],
                created_at,
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
