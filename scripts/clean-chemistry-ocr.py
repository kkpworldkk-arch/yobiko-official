from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FILES = (
    ROOT / "data/chemistry-image-ocr-questions-017-158.txt",
    ROOT / "data/chemistry-image-ocr-answers-159-345.txt",
)


def clean_line(line: str) -> str:
    replacements = {
        "スタンダード間題": "スタンダード問題",
        "無機化含物": "無機化合物",
        "無楼化合物": "無機化合物",
        "解谷群": "解答群",
        "ハログン": "ハロゲン",
        "ハ ロゲン": "ハロゲン",
        "化学間題": "化学問題",
        "ア三ノ酸": "アミノ酸",
        "アミノ酸": "アミノ酸",
        "セルロ一ス": "セルロース",
        "ニ糖類": "二糖類",
        "プタジエン": "ブタジエン",
        "ボリペプチド": "ポリペプチド",
        "ボリイソプレン": "ポリイソプレン",
        "合成脂": "合成樹脂",
        "裁維": "繊維",
        "鞭維": "繊維",
        "ア三ノ": "アミノ",
        "解答・解説編": "解答・解説編",
    }
    for source, target in replacements.items():
        line = line.replace(source, target)

    line = re.sub(r"第([0-9０-９]+)間", r"第\1問", line)
    line = re.sub(r"第([0-9０-９]+)題", r"第\1問", line)
    line = re.sub(r"(図問|囚問|☆図問|★図問|口問|四問)([0-9０-９]+)", r"問\2", line)
    return line


for source in FILES:
    if not source.exists():
        continue
    cleaned = "\n".join(clean_line(line) for line in source.read_text(encoding="utf-8").splitlines())
    target = source.with_name(source.stem + "-cleaned.txt")
    target.write_text(cleaned + "\n", encoding="utf-8")
    print(target.relative_to(ROOT))