from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import fitz

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "sankosho"
DB_PATH = ROOT / "data" / "app.db"
PROGRESS_PATH = ROOT / "data" / "vision-extract-progress.json"
MODEL = os.environ.get("REFERENCE_IMPORT_MODEL", "claude-sonnet-4-5-20250929")
MAX_PAGES = int(os.environ.get("REFERENCE_IMPORT_MAX_PAGES", "0"))


def load_env_file() -> None:
    # 一晩放置で無人実行するため、$env: の手入力なしでも .env.local / .env から
    # ANTHROPIC_API_KEY を読めるようにしておく(既に環境変数がある場合はそちらを優先)。
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ and value:
                os.environ[key] = value


BOOKS = {
    "システム英単語 .pdf": "システム英単語",
    "システム英単語メディカル.pdf": "システム英単語 メディカル",
    "化学頻出スタンダード問題230選 .pdf": "化学頻出スタンダード問題230選",
    "標準セミナー生物基礎2021.pdf": "標準セミナー生物基礎 2021",
    "黄チャート式 解法と演習 数学1+A .pdf": "黄チャート式 解法と演習 数学1+A",
    "黄チャート式 解法と演習 数学2+B .pdf": "黄チャート式 解法と演習 数学2+B",
    "黄チャート式 解法と演習 数学3+C.pdf": "黄チャート式 解法と演習 数学3+C",
}

# これまでOCR+機械的な組み立てで繰り返し出てきた失敗パターンをすべて踏まえたプロンプト。
# 画像を直接読めるので、OCRでは不可能だった「図表を見て判断する」「選択肢全体を見て
# 正誤を判断する」ことができる。それでも判断が付かない場合は出題しない方を優先する。
PROMPT = """この参考書・問題集のページ画像から、口頭試問（一問一答）に使える問題だけを抽出してください。

抽出してよい問題:
- 用語の定義、性質、現象の説明、公式とその使い道など、生徒が覚えるべき知識
- ページ内の図・表・選択肢を見て、質問文だけで(他のページを見なくても)答えが一意に
  決まる問題

必ず除外する(出題にしない):
- 選択肢(①②③…やa/b/cなど)の一部の文を、それが正しいか誤りかページ内で確認できない
  まま、事実として出題すること。正誤が明記されている(正解が示されている、誤りの選択肢
  だと明言されているなど)場合のみ、その情報を踏まえて正しい知識として出題してよい。
- 「(ア)」「(イ)」「A」「B」のような仮の記号・空欄について、このページの中だけでは
  何を指すか特定できない場合
- 「(m 明るく、n 暗く)」のように、2つ以上の選択肢が括弧で並んでいる穴埋め文。この
  形式を質問文・模範解答にそのまま残してはいけない。ページ内の記述から正解がどちらか
  一意に確定できる場合は、その選択肢だけを使って(括弧や記号を取り除いて)自然な文に
  書き直してよい。確定できない場合は出題しない。
- 模範解答が、質問文を繰り返すだけで具体的な内容(用語・数値・理由)を含まない場合
- 参考書の前書き、勉強法の助言、本の構成説明、出典・大学名の注記など、知識そのもの
  ではない文章
- 画像が不鮮明で読み取れない箇所、数式や図が崩れて読めない箇所
- 推測で内容を補完しないと成立しない問題
- 模範解答が画像から確認できない場合。このとき「ページ内に記載なし」「確認できない」
  「出題不可」のような説明文を modelAnswer に書いて出題してはいけません。そのような
  問題は questions 配列に含めず、完全に省略してください。

正確さを守るための注意:
- 質問文と模範解答に出てくる物質名・化学式・用語は、画像に書かれている表記と完全に
  一致させること。問題文で言及した物質と、答えで説明している物質が食い違っていないか、
  出力前に必ず見直してください(例: 問題文は「過酸化アルミニウム」なのに答えは
  「水酸化アルミニウム」について説明している、のような不一致は不可)。
- 「反応条件(温度・濃度など)と生成物の対応」「似た名称の用語の違い」など、入試で
  意図的に対比・区別させる定番のひっかけポイントは、自分の既存知識で安易に補完・
  訂正せず、画像に実際に書かれている対応関係だけに忠実に出題してください。画像の
  記述と一般的な知識が食い違うように見える場合は、無理に出題せず除外してください。
- ある用語を定義する問題では、その用語が実際に指す範囲だけに答えを限定してください。
  隣接する別の概念(例: 複数の構造をまとめた上位の概念)の要素を混ぜ込まないこと。

模範解答は、画像から確認できる内容に忠実にし、簡潔に書いてください。
章・単元名がページから分かる場合は category に入れてください。
抽出できる内容がなければ空配列を返してください。無理に問題数を増やす必要はありません。

出力する前に、質問文と模範解答が内容・用語ともに矛盾なく対応しているか、もう一度
自分で読み返して確認してください。

必ずJSONだけを返してください。形式:
{"questions":[{"category":"章・単元","prompt":"質問文","modelAnswer":"模範解答"}]}
"""


# プロンプトで「答えが確認できない場合は省略して」と指示しても、モデルが律儀に
# 「ページ内に記載なし」のような説明文をmodelAnswerに書いて出題してしまうことがあった
# (#152, #155で実際に確認)。プロンプト指示だけに頼らず、コード側でも機械的に弾く。
NON_ANSWER_RE = re.compile(
    r"(記載なし|記載がない|確認できない|出題不可|判断できない|分かりません|不明です)"
)


def call_claude(image_bytes: bytes) -> list[dict[str, str]]:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY が未設定です。")
    body = {
        "model": MODEL,
        "max_tokens": 1800,
        "system": "あなたは参考書を正確な口頭試問問題へ変換する教材編集者です。不確かな内容は出題しません。",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(image_bytes).decode("ascii")}},
            ],
        }],
    }
    request = Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode("utf-8"),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urlopen(request, timeout=120) as response:
                payload = json.load(response)
            break
        except HTTPError as error:
            last_error = error
            if error.code == 429 and attempt < 3:
                time.sleep(2 ** attempt * 3)
                continue
            raise
        except URLError as error:
            last_error = error
            if attempt < 3:
                time.sleep(2 ** attempt * 2)
                continue
            raise
    else:
        raise last_error or RuntimeError("retry exhausted")

    text = "".join(part.get("text", "") for part in payload.get("content", []) if part.get("type") == "text")
    text = re.sub(r"^```json\s*|\s*```$", "", text.strip())
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # ClaudeがJSONの後ろに補足文を付けた場合でも、先頭のJSONだけは利用する。
        parsed, _ = json.JSONDecoder().raw_decode(text.lstrip())
    questions = parsed.get("questions", [])
    return [
        {"category": str(q.get("category", "")).strip(), "prompt": str(q.get("prompt", "")).strip(), "modelAnswer": str(q.get("modelAnswer", "")).strip()}
        for q in questions
        if str(q.get("prompt", "")).strip()
        and str(q.get("modelAnswer", "")).strip()
        and not NON_ANSWER_RE.search(str(q.get("modelAnswer", "")))
    ]


def resolve_source_path(file_name: str) -> Path:
    # sankosho内のファイル名は濁点・半濁点付き文字がNFD（結合文字）で保存されている場合があり、
    # このファイル内の文字列リテラル（NFC）とバイト単位では一致しないことがある。
    direct = SOURCE_DIR / file_name
    if direct.exists():
        return direct
    target = unicodedata.normalize("NFC", file_name)
    for candidate in SOURCE_DIR.glob("*.pdf"):
        if unicodedata.normalize("NFC", candidate.name) == target:
            return candidate
    raise FileNotFoundError(file_name)


def book_id(connection: sqlite3.Connection, title: str) -> str:
    row = connection.execute("SELECT id FROM oral_exam_books WHERE title = ?", (title,)).fetchone()
    if not row:
        raise RuntimeError(f"参考書台帳に未登録です: {title}")
    return row[0]


def ensure_columns(connection: sqlite3.Connection) -> None:
    columns = {row[1] for row in connection.execute("PRAGMA table_info(oral_exam_questions)")}
    if "reviewed_at" not in columns:
        connection.execute("ALTER TABLE oral_exam_questions ADD COLUMN reviewed_at TEXT")
    if "blocked" not in columns:
        connection.execute("ALTER TABLE oral_exam_questions ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0")
    if "source_page" not in columns:
        connection.execute("ALTER TABLE oral_exam_questions ADD COLUMN source_page INTEGER")
    connection.commit()


def reset_book(connection: sqlite3.Connection, target_book_id: str, title: str) -> None:
    old_ids = [r[0] for r in connection.execute("SELECT id FROM oral_exam_questions WHERE book_id = ?", (target_book_id,))]
    for qid in old_ids:
        connection.execute("DELETE FROM oral_exam_mastery WHERE question_id = ?", (qid,))
    connection.execute("DELETE FROM oral_exam_questions WHERE book_id = ?", (target_book_id,))
    connection.commit()
    if old_ids:
        print(f"replace: removed {len(old_ids)} old questions for {title}")


def import_questions(connection: sqlite3.Connection, book_id_value: str, questions: list[dict[str, str]], page_number: int) -> int:
    existing = {row[0] for row in connection.execute("SELECT prompt FROM oral_exam_questions WHERE book_id = ?", (book_id_value,))}
    next_index = connection.execute("SELECT COALESCE(MAX(order_index), -1) FROM oral_exam_questions WHERE book_id = ?", (book_id_value,)).fetchone()[0] + 1
    inserted = 0
    for question in questions:
        prompt = question["prompt"]
        if prompt in existing:
            continue
        category = question["category"] or f"p.{page_number}"
        connection.execute(
            "INSERT INTO oral_exam_questions (id, book_id, order_index, category, prompt, model_answer, created_at, reviewed_at, blocked, source_page) "
            "VALUES (?, ?, ?, ?, ?, ?, datetime('now'), NULL, 0, ?)",
            (str(uuid.uuid4()), book_id_value, next_index, category, prompt, question["modelAnswer"], page_number),
        )
        existing.add(prompt)
        next_index += 1
        inserted += 1
    return inserted


def load_progress() -> dict[str, int]:
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))
    return {}


def save_progress(progress: dict[str, int]) -> None:
    PROGRESS_PATH.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--book",
        action="append",
        help="対象の参考書タイトルの部分一致文字列。複数回指定可。省略時は黄チャートを除く全書が対象。",
    )
    parser.add_argument("--replace", action="store_true", help="対象の本の既存問題を全て削除してから取り込む(進捗もリセット)")
    args = parser.parse_args()

    load_env_file()
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        print("ANTHROPIC_API_KEY が未設定のため、AI問題抽出は実行できません。", file=sys.stderr)
        sys.exit(2)

    if args.book:
        target_books = {
            fn: title for fn, title in BOOKS.items() if any(b in title for b in args.book)
        }
    else:
        target_books = {fn: title for fn, title in BOOKS.items() if not title.startswith("黄チャート")}

    if not target_books:
        print("対象の参考書が見つかりませんでした。", file=sys.stderr)
        sys.exit(1)

    connection = sqlite3.connect(DB_PATH)
    ensure_columns(connection)
    progress = load_progress()
    total = 0
    try:
        for file_name, title in target_books.items():
            try:
                path = resolve_source_path(file_name)
            except FileNotFoundError:
                print(f"skip: {file_name}")
                continue
            target_book_id = book_id(connection, title)

            if args.replace:
                reset_book(connection, target_book_id, title)
                progress[title] = 0

            document = fitz.open(path)
            page_limit = min(len(document), MAX_PAGES) if MAX_PAGES > 0 else len(document)
            start_page = progress.get(title, 0)
            if start_page:
                print(f"resuming: {title} from page {start_page + 1}")
            print(f"processing: {title} ({page_limit}/{len(document)} pages)")

            for page_index in range(start_page, page_limit):
                page = document.load_page(page_index)
                image = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).tobytes("png")
                try:
                    questions = call_claude(image)
                    inserted = import_questions(connection, target_book_id, questions, page_index + 1)
                    connection.commit()
                    total += inserted
                    print(f"  page {page_index + 1}: extracted={len(questions)} inserted={inserted}")
                except Exception as error:
                    connection.rollback()
                    print(f"  page {page_index + 1}: failed={error}", file=sys.stderr)
                progress[title] = page_index + 1
                save_progress(progress)
                time.sleep(0.2)
    finally:
        connection.close()
    print(f"imported questions: {total}")


if __name__ == "__main__":
    main()
