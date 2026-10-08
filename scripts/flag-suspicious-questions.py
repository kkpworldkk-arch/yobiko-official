"""
DB内の口頭試問データから「怪しい行」だけを抜き出してテキストファイルに書き出す。
追加のOCR処理やAPI課金は一切なし。data/app.db を読むだけ。

使い方:
  .venv\\Scripts\\python.exe scripts\\flag-suspicious-questions.py

出力:
  data/flagged-for-review.txt
"""
import re
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = REPO_ROOT / "data" / "app.db"
OUT_PATH = REPO_ROOT / "data" / "flagged-for-review.txt"

# OCRの誤読で紛れ込みやすい、参考書の本文には出てこないはずの記号(囲みCJK文字・私用領域・
# 置換文字)。丸数字(①②③…)は化学の問題集で選択肢番号として正規に使われているため対象から
# 外した(74件中70件がこれによる誤検出だった)。以前は「印字可能文字の比率」でも判定していたが、
# 全角コロン「：」や「≪≫」のような正規の記号まで「印字不可」扱いにしてしまい、正常な文を
# 大量に誤検出したためやめた。実際に観測した壊れ方の文字種だけをブラックリストで狙う。
GARBAGE_CHARS = re.compile(
    r"[㈀-㏿�-]"
)

EXCLUDE_BOOK_PREFIXES = ("黄チャート",)

# システム英単語系は「英単語の次の行＝意味」と機械的にペアにしているため、発音記号や
# 別の単語の断片が答えに紛れ込み、問題と答えがズレることがある。意味であるはずの
# model_answer にラテン文字や角括弧([])が混ざっているのは、その典型的なサイン。
# ※この判定は「「word」の意味を日本語で答えてください。」形式(=英単語一語のペア)にのみ
#   適用する。「次の内容を口頭で説明してください：「文章」」形式は、仕様として答え＝
#   引用文そのものなので、同じ判定をかけると全件誤検出になる。
LATIN_FRAGMENT = re.compile(r"[A-Za-z]{2,}")
BRACKET = re.compile(r"[\[\]]")
VOCAB_PROMPT = re.compile(r"^「(.+?)」の意味を日本語で答えてください。$")


def flag_reasons(prompt: str, answer: str) -> list[str]:
    reasons = []
    combined = f"{prompt}{answer}"
    if GARBAGE_CHARS.search(combined):
        reasons.append("不審な記号")
    if len(answer.strip()) <= 1:
        reasons.append("答えが短すぎる")
    vocab_match = VOCAB_PROMPT.match(prompt)
    if vocab_match:
        word = vocab_match.group(1)
        if LATIN_FRAGMENT.search(answer):
            reasons.append("答えに英字が混入(ズレの疑い)")
        if BRACKET.search(answer):
            reasons.append("答えに発音記号らしき括弧(ズレの疑い)")
        if word.lower() in answer.lower():
            reasons.append("答えに問題文の単語自体を含む(ズレの疑い)")
    return reasons


def main() -> int:
    if not DB_PATH.exists():
        print(f"DB not found: {DB_PATH}")
        return 1

    conn = sqlite3.connect(str(DB_PATH))
    rows = conn.execute(
        """
        SELECT b.title, q.order_index, q.category, q.prompt, q.model_answer
        FROM oral_exam_questions q
        JOIN oral_exam_books b ON b.id = q.book_id
        ORDER BY b.title, q.order_index
        """
    ).fetchall()
    conn.close()

    by_book: dict[str, list[str]] = {}
    total = 0
    flagged_total = 0

    for title, order_index, category, prompt, answer in rows:
        if title.startswith(EXCLUDE_BOOK_PREFIXES):
            continue
        total += 1
        reasons = flag_reasons(prompt or "", answer or "")
        if not reasons:
            continue
        flagged_total += 1
        by_book.setdefault(title, []).append(
            f"#{order_index + 1} [{'/'.join(reasons)}]\n"
            f"  問題: {prompt}\n"
            f"  答え: {answer}\n"
        )

    lines = [
        "怪しい行リスト(黄チャートは対象外・手作業修正の参考用)",
        f"対象 {total} 問中 {flagged_total} 問を抽出",
        "",
    ]
    for title, items in by_book.items():
        lines.append(f"===== {title} ({len(items)}件) =====")
        lines.extend(items)
        lines.append("")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")

    print(f"Flagged {flagged_total} / {total} questions (excluding 黄チャート books).")
    print(f"Written to: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
