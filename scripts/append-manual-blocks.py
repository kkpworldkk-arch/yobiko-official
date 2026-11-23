#!/usr/bin/env python3
"""手動入力テンプレートの末尾に、差分ファイルの小問をそのまま追記する（新規の章用）。

使い方: python scripts/append-manual-blocks.py <本体テンプレート> <差分ファイル>
同じ (C, TYPE, N, S) がすでに本体にあるときは止まる。
"""
import re
import sys

SEP = "\n---\n"


def key(block):
    f = lambda n: (re.search(r"^" + n + r":[ \t]*(.*)$", block, re.M) or [None, ""])[1].strip()
    t, n, s = f("TYPE"), f("N"), f("S")
    return (t, n, s) if t and n and s else None


base_path, patch_path = sys.argv[1:3]
base = open(base_path, encoding="utf-8").read().replace("\r\n", "\n")
patch = open(patch_path, encoding="utf-8").read().replace("\r\n", "\n")
have = {key(b) for b in base.split(SEP)}
add = []
for raw in patch.split(SEP):
    block = re.sub(r"\A(#.*\n|\n)+", "", raw).strip("\n")
    k = key(block)
    if not k:
        continue
    if k in have:
        sys.exit(f"すでにあります: {k}")
    have.add(k)
    add.append(block)
with open(base_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(base.rstrip("\n") + "\n---\n" + SEP.join(add) + "\n---\n")
print(f"追記 {len(add)}")
