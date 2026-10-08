"""
rewrite-explain-questions.py で変換済みの問題からランダムにサンプルを抜き出して表示する。
品質の抜き取り確認用。DBへの書き込みは一切なし。

使い方:
  .venv\\Scripts\\python.exe scripts\\sample-converted-questions.py --book "化学頻出スタンダード問題230選" --n 30
"""
import argparse
import random
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"
DEFAULT_OUT_PATH = ROOT / "data" / "converted-sample.txt"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book")
    parser.add_argument("--n", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    out_path = args.out or DEFAULT_OUT_PATH

    conn = sqlite3.connect(str(DB_PATH))
    query = """
        SELECT q.order_index, q.prompt, q.model_answer, b.title
        FROM oral_exam_questions q
        JOIN oral_exam_books b ON b.id = q.book_id
        WHERE b.title NOT LIKE '黄チャート%'
    """
    params: list[str] = []
    if args.book:
        query += " AND b.title LIKE ?"
        params.append(f"%{args.book}%")
    rows = conn.execute(query, params).fetchall()
    conn.close()

    random.seed(args.seed)
    sample = random.sample(rows, min(args.n, len(rows)))

    lines = [f"変換済み問題からランダム抽出: {len(sample)} / {len(rows)}件", ""]
    for order_index, prompt, answer, title in sample:
        lines.append(f"[{title} #{order_index + 1}]")
        lines.append(f"  問題: {prompt}")
        lines.append(f"  答え: {answer}")
        lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"total_converted={len(rows)} sampled={len(sample)}")
    print(f"written to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
