from __future__ import annotations

import re
import sqlite3
import sys
import unicodedata
import uuid
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR
from rapidocr_onnxruntime.ch_ppocr_v3_rec.text_recognize import TextRecognizer

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "sankosho"
DB_PATH = ROOT / "data" / "app.db"

# rapidocr_onnxruntime は既定で中国語の認識モデル(ch_PP-OCRv3_rec)しか同梱しておらず、
# 日本語のひらがな・カタカナがほぼ読み飛ばされ、漢字も簡体字の字形に誤認識されていた。
# ここではPP-OCRv4の日本語認識モデルに差し替える。文字検出(Det)・傾き補正(Cls)は
# 言語非依存のため既定のモデルのままでよい。
JAPAN_REC_MODEL = ROOT / "scripts" / "ocr-models" / "japan_PP-OCRv4_rec_mobile.onnx"
JAPAN_REC_DICT = ROOT / "scripts" / "ocr-models" / "japan_dict_v4.txt"


def make_ocr() -> RapidOCR:
    ocr = RapidOCR()
    if JAPAN_REC_MODEL.exists() and JAPAN_REC_DICT.exists():
        ocr.text_recognizer = TextRecognizer({
            "use_cuda": False,
            "model_path": str(JAPAN_REC_MODEL),
            "keys_path": str(JAPAN_REC_DICT),
            "rec_img_shape": [3, 48, 320],
            "rec_batch_num": 6,
        })
    else:
        print(
            "warning: 日本語OCRモデルが見つかりません。既定の中国語モデルで実行します "
            "(scripts/ocr-models/ 以下にモデルを配置してください)。",
            file=sys.stderr,
        )
    return ocr

# タイトルは reference-book-catalog.ts (アプリ本体の参考書台帳) と厳密に一致させること。
# 以前はここが台帳とずれており（スペースの有無、「数学1+A」等）、find_book() が台帳の本ではなく
# 同名の別レコードを探してしまい、抽出結果が台帳上の参考書（アプリ・生徒が実際に見る方）に
# 一切反映されない、という問題が起きていた。
BOOKS = {
    "システム英単語 .pdf": "システム英単語",
    "システム英単語メディカル.pdf": "システム英単語 メディカル",
    "化学頻出スタンダード問題230選 .pdf": "化学頻出スタンダード問題230選",
    "標準セミナー生物基礎2021.pdf": "標準セミナー生物基礎 2021",
    "黄チャート式 解法と演習 数学1+A .pdf": "黄チャート式 解法と演習 数学1+A",
    "黄チャート式 解法と演習 数学2+B .pdf": "黄チャート式 解法と演習 数学2+B",
    "黄チャート式 解法と演習 数学3+C.pdf": "黄チャート式 解法と演習 数学3+C",
}

JAPANESE = re.compile(r"[ぁ-んァ-ン一-龥]")
ENGLISH = re.compile(r"^[A-Za-z][A-Za-z-]{1,24}$")
# 「=」単体や「公式」という単語だけでは数式判定のシグナルとして弱すぎた。英単語帳の
# 「意味(=類義語)」という一般的な表記（例:「決心する(=decide)」）を軒並み「次の公式・
# 定理または解法を述べ…」という誤った質問文に分類してしまっていた（システム英単語で
# 401件中118件が誤判定）。「=」と「公式」は数式以外の文脈でも頻出するため外し、
# より数式に固有の記号・キーワードだけを残す。
MATH = re.compile(r"(≧|≤|≥|sin|cos|tan|log|lim|∑|∫|定理|判別式|因数分解)")
BAD = ("目次", "はじめに", "本書", "Copyright", "http", "ISBN", "Step", "Stage")

# scan-reference-books.py と同じ考え方の「印字可能文字率」。PDFに埋め込まれた数式フォント
# のToUnicodeマッピングが壊れている場合、fitzのテキスト抽出は「文字数はそれなりにあるが
# 中身がでたらめ」なテキストを返すことがある（例：黄チャート式の数式部分）。以前は
# 「80文字以上かつ replacement character が無ければ信用する」という弱い判定だったため、
# このような壊れたテキストをそのまま採用してしまっていた。
PRINTABLE = re.compile(r"[ -~　-鿿]")
TEXT_LAYER_MIN_QUALITY = 0.92


def text_quality(text: str) -> float:
    if not text:
        return 0.0
    return len(PRINTABLE.findall(text)) / len(text)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" \t\r\n|")


def valid(value: str) -> bool:
    return 8 <= len(value) <= 220 and "�" not in value and bool(JAPANESE.search(value))


def find_book(connection: sqlite3.Connection, title: str) -> str:
    row = connection.execute(
        "SELECT id FROM oral_exam_books WHERE title = ? OR title LIKE ? LIMIT 1",
        (title, f"{title}%"),
    ).fetchone()
    if row is None:
        raise RuntimeError(f"Missing catalog entry: {title}")
    return row[0]


def lines_from_page(
    ocr: RapidOCR, page: fitz.Page, force_image_ocr: bool = False
) -> list[tuple[str, float]]:
    text = page.get_text("text").strip()
    if not force_image_ocr and len(text) >= 80 and text_quality(text) >= TEXT_LAYER_MIN_QUALITY:
        return [(clean(line), 1.0) for line in text.splitlines() if clean(line)]
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False)
    result, _ = ocr(pixmap.tobytes("png"))
    if not result:
        return []
    ordered = sorted(result, key=lambda item: (item[0][0][1], item[0][0][0]))
    return [(clean(str(item[1])), float(item[2])) for item in ordered]


MAX_CANDIDATES_PER_PAGE = 12
MAX_MATH_CANDIDATES_PER_PAGE = 4
MATH_LINE_MAX_LEN = 80


def candidates_for_page(
    title: str, page_number: int, lines: list[tuple[str, float]]
) -> list[tuple[str, str, str]]:
    output: list[tuple[str, str, str]] = []
    math_count = 0
    for index, (line, score) in enumerate(lines):
        if len(output) >= MAX_CANDIDATES_PER_PAGE:
            break
        if score < 0.55 or not valid(line) or any(token in line for token in BAD):
            continue
        category = f"{title} p.{page_number}"
        if ENGLISH.fullmatch(line):
            if index + 1 < len(lines) and valid(lines[index + 1][0]):
                meaning = lines[index + 1][0]
                output.append(
                    (category, f"「{line}」の意味を日本語で答えてください。", meaning)
                )
            continue
        if "とは" in line or "をいう" in line or "意味" in line or line.endswith("。"):
            output.append(
                (
                    category,
                    f"次の内容を口頭で説明してください：「{line}」",
                    line,
                )
            )
        elif MATH.search(line) and len(line) <= MATH_LINE_MAX_LEN:
            # 数式を含む行は、公式のボックスだけでなく解説中の計算過程も無差別に拾ってしまい
            # ノイズが非常に多かった（黄チャート式で1ページあたり数十件になっていた）。
            # 1ページあたりの件数に上限を設け、行の長さも短いもの（単一の公式らしきもの）に絞る。
            if math_count >= MAX_MATH_CANDIDATES_PER_PAGE:
                continue
            output.append(
                (
                    category,
                    f"次の公式・定理または解法を述べ、何に使うか説明してください：「{line}」",
                    line,
                )
            )
            math_count += 1
    return output


def insert(
    connection: sqlite3.Connection,
    book_id: str,
    candidates: list[tuple[str, str, str]],
) -> int:
    existing = {
        row[0]
        for row in connection.execute(
            "SELECT prompt FROM oral_exam_questions WHERE book_id = ?", (book_id,)
        )
    }
    order_index = connection.execute(
        "SELECT COALESCE(MAX(order_index), -1) FROM oral_exam_questions WHERE book_id = ?",
        (book_id,),
    ).fetchone()[0] + 1
    created_at = datetime.now(timezone.utc).isoformat()
    inserted = 0
    for category, prompt, answer in candidates:
        if prompt in existing or len(answer) > 500:
            continue
        connection.execute(
            """INSERT INTO oral_exam_questions
            (id, book_id, order_index, category, prompt, model_answer, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), book_id, order_index, category, prompt, answer, created_at),
        )
        existing.add(prompt)
        order_index += 1
        inserted += 1
    return inserted


def resolve_source_path(file_name: str) -> Path:
    # sankosho内のファイル名の中には、濁点・半濁点付きの文字（ダ・デ等）がNFD（基底文字＋
    # 結合文字の2文字）で保存されているものがあり、このファイル内の文字列リテラル（NFC・
    # 合成済み1文字）とバイト単位では一致しないことがある。まず素直に探し、無ければ
    # 正規化した上で一致するファイルを探す。
    direct = SOURCE_DIR / file_name
    if direct.exists():
        return direct
    target = unicodedata.normalize("NFC", file_name)
    for candidate in SOURCE_DIR.glob("*.pdf"):
        if unicodedata.normalize("NFC", candidate.name) == target:
            return candidate
    raise FileNotFoundError(f"sankosho内に見つかりません: {file_name}")


def process_book(file_name: str, title: str, output_path: Path | None) -> None:
    ocr = make_ocr()
    path = resolve_source_path(file_name)
    document = fitz.open(path)
    force_image_ocr = title == "化学頻出スタンダード問題230選"
    all_candidates: list[tuple[str, str, str]] = []
    for page_number, page in enumerate(document, start=1):
        all_candidates.extend(
            candidates_for_page(
                title,
                page_number,
                lines_from_page(ocr, page, force_image_ocr=force_image_ocr),
            )
        )
        if page_number % 25 == 0:
            print(
                f"{file_name.encode('unicode_escape').decode('ascii')} "
                f"page={page_number}/{len(document)} candidates={len(all_candidates)}",
                flush=True,
            )
    if output_path:
        output_path.write_text(
            json.dumps(all_candidates, ensure_ascii=False), encoding="utf-8"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", choices=list(BOOKS))
    parser.add_argument("--export-dir", type=Path)
    parser.add_argument(
        "--replace",
        action="store_true",
        help=(
            "DB取り込み時、対象の本の既存の問題をすべて削除してから取り込む。"
            "以前の（壊れた）OCR結果が同じ本に残っている場合の作り直しに使う。"
            "指定しない場合は、既存の問題に追加する（重複するprompt文字列は自動でスキップ）。"
        ),
    )
    parser.add_argument(
        "--only",
        help=(
            "DB取り込み時、タイトルにこの文字列を含む本だけを対象にする（部分一致）。"
            "他の本の生徒の進捗（oral_exam_mastery）を誤って消さないため、--replace と"
            "組み合わせて特定の1冊だけをリセットしたいときに使う。"
        ),
    )
    args = parser.parse_args()
    if args.book:
        process_book(args.book, BOOKS[args.book], args.export_dir / f"{list(BOOKS).index(args.book)}.json")
        return
    connection = sqlite3.connect(DB_PATH)
    try:
        for file_name, title in BOOKS.items():
            if args.only and args.only not in title:
                continue
            try:
                resolve_source_path(file_name)
            except FileNotFoundError:
                continue
            book_id = find_book(connection, title)
            export_path = ROOT / "data" / "ocr-candidates" / f"{list(BOOKS).index(file_name)}.json"
            if not export_path.exists():
                continue
            if args.replace:
                old_question_ids = [
                    r[0]
                    for r in connection.execute(
                        "SELECT id FROM oral_exam_questions WHERE book_id = ?", (book_id,)
                    )
                ]
                for qid in old_question_ids:
                    connection.execute(
                        "DELETE FROM oral_exam_mastery WHERE question_id = ?", (qid,)
                    )
                connection.execute(
                    "DELETE FROM oral_exam_questions WHERE book_id = ?", (book_id,)
                )
                if old_question_ids:
                    print(
                        f"replaced: removed {len(old_question_ids)} old questions for "
                        f"{file_name.encode('unicode_escape').decode('ascii')}",
                        flush=True,
                    )
            candidates = json.loads(export_path.read_text(encoding="utf-8"))
            inserted = insert(connection, book_id, candidates)
            connection.commit()
            print(f"completed {file_name.encode('unicode_escape').decode('ascii')} candidates={len(candidates)} inserted={inserted}", flush=True)
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ocr import failed: {error}", file=sys.stderr)
        raise
