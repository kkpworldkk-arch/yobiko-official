from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "sankosho"
REPORT_PATH = ROOT / "data" / "reference-book-scan-report.json"


def scan_pdf(path: Path) -> dict[str, object]:
    reader = PdfReader(str(path), strict=False)
    text_pages = 0
    text_chars = 0
    printable_chars = 0

    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            text_pages += 1
            text_chars += len(text)
            printable_chars += len(re.findall(r"[\u0020-\u007e\u3000-\u9fff]", text))

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    quality = printable_chars / text_chars if text_chars else 0
    return {
        "fileName": path.name,
        "pageCount": len(reader.pages),
        "textPageCount": text_pages,
        "textCharacterCount": text_chars,
        "printableCharacterRatio": round(quality, 4),
        "sha256": digest,
        "status": "ready-for-review" if quality >= 0.5 else "ocr-required",
        "questionsImported": 0,
    }


def main() -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(SOURCE_DIR.glob("*.pdf"))
    report = [scan_pdf(path) for path in files]

    by_hash: dict[str, list[dict[str, object]]] = {}
    for entry in report:
        by_hash.setdefault(str(entry["sha256"]), []).append(entry)
    for entries in by_hash.values():
        if len(entries) < 2:
            continue
        for entry in entries:
            entry["duplicateOf"] = [
                other["fileName"] for other in entries if other is not entry
            ]
            entry["status"] = "duplicate"

    REPORT_PATH.write_text(
        json.dumps(
            {
                "generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(),
                "sourceDirectory": "sankosho",
                "questionImportPolicy": "Do not import questions until extracted text passes manual quality review.",
                "books": report,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Scanned {len(report)} PDF files -> {REPORT_PATH.relative_to(ROOT)}")
    for entry in report:
        print(
            f"{entry['fileName']}: pages={entry['pageCount']}, "
            f"text_pages={entry['textPageCount']}, status={entry['status']}"
        )


if __name__ == "__main__":
    main()
