#!/usr/bin/env python3
"""手動入力テンプレートに、差分ファイルの小問を差し込む。

使い方: python scripts/merge-manual-blocks.py <本体テンプレート> <差分ファイル> [--dry-run]

差分ファイルは本体と同じ書式（C:/TYPE:/N:/S:… を「---」で区切る）。
- (TYPE, N, S) が本体にあれば、その位置で置き換える。
- 本体に無ければ、AFTER: <S> または BEFORE: <S>（同じ TYPE・N の小問）で位置を指定する。
- S を付け替えたいときは REMOVE: <旧い S>（同じ TYPE・N）で、その小問の位置に置き換える。
  AFTER/BEFORE/REMOVE の行は本体には書き出さない。
"""
import re
import sys

SEP = "\n---\n"


def field(block, name):
    m = re.search(r"^" + name + r":[ \t]*(.*)$", block, re.M)
    return m.group(1).strip() if m else None


def key(block):
    t, n, s = field(block, "TYPE"), field(block, "N"), field(block, "S")
    return (t, n, s) if t and n and s else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    base_path, patch_path = args
    base = open(base_path, encoding="utf-8").read().replace("\r\n", "\n")
    patch = open(patch_path, encoding="utf-8").read().replace("\r\n", "\n")
    blocks = base.split(SEP)
    replaced = inserted = 0
    for raw in patch.split(SEP):
        raw = raw.strip("\n")
        k = key(raw)
        if not k:
            continue
        after, before, remove = field(raw, "AFTER"), field(raw, "BEFORE"), field(raw, "REMOVE")
        block = re.sub(r"^(AFTER|BEFORE|REMOVE):.*\n?", "", raw, flags=re.M)
        block = re.sub(r"\A(#.*\n|\n)+", "", block).strip("\n")
        idx = next((i for i, b in enumerate(blocks) if key(b) == k), None)
        if remove:
            # S を付け替える小問：REMOVE で指定した旧い小問の位置に、この小問を置く
            idx = next((i for i, b in enumerate(blocks) if key(b) == (k[0], k[1], remove)), None)
            if idx is None:
                sys.exit(f"REMOVE の相手が見つかりません: {k} -> {remove}")
        if idx is not None:
            blocks[idx] = block
            replaced += 1
            continue
        ref = after or before
        if not ref:
            sys.exit(f"本体に無い小問に AFTER/BEFORE がありません: {k}")
        ref_idx = next((i for i, b in enumerate(blocks) if key(b) == (k[0], k[1], ref)), None)
        if ref_idx is None:
            sys.exit(f"AFTER/BEFORE の相手が見つかりません: {k} -> {ref}")
        blocks.insert(ref_idx + 1 if after else ref_idx, block)
        inserted += 1
    print(f"置き換え {replaced} / 追加 {inserted}")
    if not dry:
        with open(base_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(SEP.join(blocks))


main()
