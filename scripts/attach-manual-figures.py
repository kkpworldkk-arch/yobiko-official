#!/usr/bin/env python3
"""手動入力テンプレートの既存小問に、図（F:）を付ける。

使い方: python scripts/attach-manual-figures.py <本体テンプレート> <指定ファイル>

指定ファイルは1行1指定。「TYPE|N|S1,S2,…|図1 / 図2」（# から始まる行は無視）。
該当の小問に F: 行が無ければ A: の前に挿入し、あれば置き換える。
"""
import re
import sys

SEP = "\n---\n"


def field(block, name):
    m = re.search(r"^" + name + r":[ \t]*(.*)$", block, re.M)
    return m.group(1).strip() if m else None


def main():
    path, spec = sys.argv[1], sys.argv[2]
    text = open(path, encoding="utf-8").read()
    blocks = text.split(SEP)
    done = 0
    for line in open(spec, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        t, n, ss, figs = [x.strip() for x in line.split("|")]
        for s in [x.strip() for x in ss.split(",")]:
            hit = False
            for i, b in enumerate(blocks):
                if field(b, "TYPE") == t and field(b, "N") == n and field(b, "S") == s:
                    hit = True
                    if re.search(r"^F:", b, re.M):
                        b = re.sub(r"^F:.*$", "F: " + figs, b, flags=re.M)
                    else:
                        b = re.sub(r"^(A:)", "F: " + figs + r"\n\1", b, count=1, flags=re.M)
                    blocks[i] = b
                    done += 1
                    break
            if not hit:
                print(f"見つからない: {t} {n} {s}")
                sys.exit(1)
    open(path, "w", encoding="utf-8", newline="").write(SEP.join(blocks))
    print(f"図を付けた: {done}件")


main()
