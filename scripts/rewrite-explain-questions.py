"""
「次の内容を口頭で説明してください：「〜」」形式(答え=問題文と同じ文)の口頭試問問題を、
実際に内容を問う質問文＋その答えのペアに書き換える。

画像OCRではなく、既にDBに入っているテキストをAIで言い換えるだけなので、
画像を使った抽出(import-reference-questions.py)よりずっと安価。
ANTHROPIC_API_KEY は .env に設定済みのものをそのまま使う。

使い方:
  環境変数を設定してから実行する(PowerShellの例):
    $env:ANTHROPIC_API_KEY = "sk-ant-..."
    .venv\\Scripts\\python.exe scripts\\rewrite-explain-questions.py --book "化学頻出スタンダード問題230選" --limit 20 --dry-run

  問題なければ --dry-run を外し、--limit も外して全件実行する。
  一度書き換えた行は元のテンプレート文と一致しなくなるので、途中で止めても再実行すれば
  続きから処理される(二重変換の心配はない)。

オプション:
  --book TITLE   対象の参考書タイトル(部分一致)。省略時は黄チャートを除く全書。
  --limit N      処理件数の上限(テスト用)。
  --dry-run      DBを更新せず、変換結果を表示するだけ。
  --sleep SEC    API呼び出し間の待機秒数(既定 0.3)。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"
LOG_PATH = ROOT / "data" / "rewrite-log.txt"
# Haikuでは「プレースホルダーを答えに残さない」等の指示を守りきれず、不良率が改善しなかった
# ため、判断力の高いSonnetに変更。テキストのみの短い言い換えなので費用増は小さい。
MODEL = os.environ.get("REWRITE_MODEL", "claude-sonnet-4-5-20250929")


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

TEMPLATE_RE = re.compile(r"^次の内容を口頭で説明してください：「(.+)」$")

SYSTEM_PROMPT = (
    "あなたは教材編集者です。参考書から抜き出した一文を、口頭試問用の「質問文」と"
    "「模範解答」のペアに書き換えます。内容は原文に忠実にし、新しい情報を付け足したり"
    "推測で補完したりしないでください。"
)

USER_PROMPT_TEMPLATE = """次の一文は、参考書または問題集から抜き出したものです。

「{text}」

この内容を尋ねる自然な質問文と、それに対する模範解答(この一文の内容をもとにした説明)を作ってください。
ただし、以下のいずれかに当てはまる場合は変換せず、必ず {{"skip": true}} だけを返してください。
- 文が短すぎる、または主語・目的語が省略された断片で、そのままでは何について述べているか
  分からない(例:「衣料品や容器などに用いられている。」のように主語が欠けている)
- 選択肢の一部(「①」「②」等)であり、正しい記述か誤った記述か文脈なしに判断できない
- 科学的・事実として正しいか自信が持てない
- 生徒が身につけるべき知識(用語の定義・性質・現象の説明など)ではなく、以下のような
  本そのものについての文章：学習法・勉強のコツの助言、本の構成や凡例の説明、
  出題大学・出典についての注記、著者のまえがき・謝辞
- 模範解答が、質問に対する具体的な答え(用語・数値・理由など)を含まず、質問文とほぼ
  同じ内容を繰り返しているだけになってしまう場合
- 元の文が「(ア)」「(イ)」「(ウ)」「(A)」「(B)」「化合物A」「物質E」のような、本文中の
  図表や前後の文脈でしか意味が分からない記号・仮の名前を含んでおり、それが何を指すか
  この一文だけからは分からない場合(模範解答の中にその記号・仮の名前をそのまま残す
  ことになってしまうなら、必ずスキップしてください)
- 模範解答の中で、正解を1つに決められず「または〜など」のように複数の可能性を並べる
  ことになってしまう場合

判断に迷ったら変換せずスキップしてください。無理に変換する必要はありません。

変換できる場合は、必ず次のJSON形式だけを返してください(説明や```は不要):
{{"question": "質問文", "answer": "模範解答"}}
"""


def call_claude(key: str, text: str) -> dict | None:
    body = {
        "model": MODEL,
        "max_tokens": 400,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(text=text)}
        ],
    }
    request = Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=60) as response:
                payload = json.load(response)
            break
        except HTTPError as error:
            if error.code == 429 and attempt < 3:
                time.sleep(2 ** attempt * 2)
                continue
            raise
    else:
        raise RuntimeError("retry exhausted")

    raw = "".join(
        part.get("text", "")
        for part in payload.get("content", [])
        if part.get("type") == "text"
    )
    raw = re.sub(r"^```json\s*|\s*```$", "", raw.strip())
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if parsed.get("skip"):
        return None
    question = str(parsed.get("question", "")).strip()
    answer = str(parsed.get("answer", "")).strip()
    if not question or not answer:
        return None
    return {"question": question, "answer": answer}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.3)
    args = parser.parse_args()

    load_env_file()
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        print("ANTHROPIC_API_KEY が未設定です。.env.local か .env に設定するか、$env:ANTHROPIC_API_KEY を設定してから実行してください。", file=sys.stderr)
        return 1

    log_file = None
    if not args.dry_run:
        log_file = LOG_PATH.open("a", encoding="utf-8")

    conn = sqlite3.connect(str(DB_PATH))
    query = """
        SELECT q.id, q.prompt, b.title
        FROM oral_exam_questions q
        JOIN oral_exam_books b ON b.id = q.book_id
        WHERE q.prompt LIKE '次の内容を口頭で説明してください：%'
          AND b.title NOT LIKE '黄チャート%'
    """
    params: list[str] = []
    if args.book:
        query += " AND b.title LIKE ?"
        params.append(f"%{args.book}%")
    query += " ORDER BY b.title, q.order_index"
    rows = conn.execute(query, params).fetchall()

    if args.limit:
        rows = rows[: args.limit]

    total = len(rows)
    converted = 0
    skipped = 0

    for index, (qid, prompt, title) in enumerate(rows, start=1):
        match = TEMPLATE_RE.match(prompt)
        if not match:
            continue
        text = match.group(1)
        try:
            result = call_claude(key, text)
        except Exception as error:
            print(f"[{index}/{total}] error: {error}", file=sys.stderr)
            time.sleep(2)
            continue

        if result is None:
            skipped += 1
        else:
            converted += 1
            if args.dry_run:
                print(f"[{index}/{total}] Q: {result['question']}")
                print(f"           A: {result['answer']}")
            else:
                conn.execute(
                    "UPDATE oral_exam_questions SET prompt = ?, model_answer = ? WHERE id = ?",
                    (result["question"], result["answer"], qid),
                )
                conn.commit()
                if log_file:
                    log_file.write(
                        f"[{title}] 元の文: {text}\n"
                        f"  問題: {result['question']}\n"
                        f"  答え: {result['answer']}\n\n"
                    )
                    log_file.flush()

        if index % 20 == 0:
            print(f"progress {index}/{total} converted={converted} skipped={skipped}", flush=True)

        time.sleep(args.sleep)

    print(f"done. total={total} converted={converted} skipped={skipped} dry_run={args.dry_run}")
    if log_file:
        log_file.close()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
