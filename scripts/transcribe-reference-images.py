from __future__ import annotations

import argparse
import json
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR
from rapidocr_onnxruntime.ch_ppocr_v3_rec.text_recognize import TextRecognizer


ROOT = Path(__file__).resolve().parent.parent
JAPAN_REC_MODEL = ROOT / "scripts" / "ocr-models" / "japan_PP-OCRv4_rec_mobile.onnx"
JAPAN_REC_DICT = ROOT / "scripts" / "ocr-models" / "japan_dict_v4.txt"


def make_ocr() -> RapidOCR:
    ocr = RapidOCR()
    ocr.text_recognizer = TextRecognizer(
        {
            "use_cuda": False,
            "model_path": str(JAPAN_REC_MODEL),
            "keys_path": str(JAPAN_REC_DICT),
            "rec_img_shape": [3, 48, 320],
            "rec_batch_num": 6,
        }
    )
    return ocr


def transcribe_page(ocr: RapidOCR, page: fitz.Page, page_number: int) -> dict:
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
    result, _ = ocr(pixmap.tobytes("png"))
    rows = []
    for polygon, text, score in sorted(
        result or [], key=lambda item: (item[0][0][1], item[0][0][0])
    ):
        rows.append(
            {
                "text": str(text),
                "confidence": float(score),
                "polygon": [[float(x), float(y)] for x, y in polygon],
            }
        )
    return {"page": page_number, "rows": rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("start", type=int)
    parser.add_argument("end", type=int)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    document = fitz.open(args.pdf)
    if not 1 <= args.start <= args.end <= len(document):
        raise SystemExit(f"page range must be between 1 and {len(document)}")

    ocr = make_ocr()
    pages = [transcribe_page(ocr, document[number - 1], number) for number in range(args.start, args.end + 1)]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(pages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    text_output = args.output.with_suffix(".txt")
    sections = []
    for page in pages:
        lines = [row["text"] for row in page["rows"]]
        sections.append(f"===== ページ{page['page']:03d} =====\n" + "\n".join(lines))
    text_output.write_text("\n\n".join(sections) + "\n", encoding="utf-8")
    print(f"wrote {len(pages)} image pages to {args.output} and {text_output}")


if __name__ == "__main__":
    main()