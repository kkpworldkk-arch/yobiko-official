#!/usr/bin/env python3
"""数学1・A 基礎問題精講: 作業用ファイル(data/manual-import/m1a-src/ch*.txt + answers-e.txt)を
手動入力テンプレート(data/manual-import/math1a-kiso-seikou.txt)に変換する。

作業用ファイルの書式:
  @C 章名
  @T 基礎問|演習問題 番号 P<紙面ページ> AP<答えのページ>
  F: m1a/xxx.png [/ m1a/yyy.png]   以降の小問に付く図（次の F: まで）
  stem: 共通の問題文   以降の小問の頭につく
  g: 小問群の前置き文   同上
  (小問ラベル) 問題文 => 答え         ラベルなし・問題文だけでもよい
  答えが「@」のとき answers-e.txt の `E<番号> <ラベル> => 答え` から引く
"""
import re, sys, importlib.util, pathlib
sys.stdout.reconfigure(encoding="utf-8")
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "data/manual-import/m1a-src"
spec = importlib.util.spec_from_file_location("yc", root / "scripts/yellow-chart-v2.py")
yc = importlib.util.module_from_spec(spec); spec.loader.exec_module(yc)

answers = {}
for ln in (src / "answers-e.txt").read_text(encoding="utf-8").splitlines():
    if not ln.strip() or ln.startswith("#"):
        continue
    m = re.match(r"E(\d+)\s*(.*?)\s*=>\s*(.*)$", ln)
    assert m, ln
    answers[(int(m[1]), m[2].strip())] = m[3].strip()
used = set()

LABEL = re.compile(r"^(?:[⓪①②③④⑤⑥⑦⑧⑨]|\((?:\d+|i{1,3}|iv|v|vi{0,3}|[ア-オ])\))+[^\s(=]*")

def parse_left(left):
    left = left.strip()
    m = LABEL.match(left)
    if m:
        return m[0], left[m.end():].strip()
    if " " not in left and len(left) <= 14:
        return left, ""
    return "", left

blocks, problems = [], []
chapter = ""
cur = None
def finish():
    pass
errors = []
for path in sorted(src.glob("ch*.txt")):
    figs, stem, group = [], "", ""
    for ln in path.read_text(encoding="utf-8").splitlines():
        if not ln.strip() or ln.startswith("#"):
            continue
        if ln.startswith("@C "):
            chapter = ln[3:].strip(); continue
        if ln.startswith("@T "):
            m = re.match(r"@T (基礎問|演習問題) (\d+) P(\d+) AP(\d+)", ln); assert m, ln
            cur = dict(type=m[1], n=int(m[2]), p=int(m[3]), ap=int(m[4]), chapter=chapter, items=[])
            problems.append(cur); figs, stem, group = [], "", ""
            continue
        if ln.startswith("F: "):
            figs = [x.strip() for x in ln[3:].split(" / ")]; continue
        if ln.startswith("stem: ") and " => " not in ln:
            stem, group = ln[6:].strip(), ""; continue
        if ln.startswith("g: ") and " => " not in ln:
            group, stem = ln[3:].strip(), ""; continue
        if ln.startswith(("stem: ", "g: ")):  # 前置きと答えが同じ行のとき: 単独の小問
            ln = ln.split(": ", 1)[1]; stem = group = ""
        if " => " not in ln:
            stem, group = ln.strip(), ""; continue  # 「=>」のない行は共通の問題文（前置き）
        left, ans = ln.split(" => ", 1)
        label, text = parse_left(left)
        ctx = stem or group
        prompt = (ctx + " " + text).strip() if text else (ctx + (f" 【{label}】" if label else "")).strip()
        if not text and not ctx:
            prompt = label
        cur["items"].append(dict(label=label, prompt=prompt, ans=ans.strip(), figs=list(figs)))

out = ["# 数学1・A 基礎問題精講（scripts/m1a-build.py が data/manual-import/m1a-src から作る。直接編集しない）", ""]
count = 0
for pr in problems:
    labels = [it["label"] for it in pr["items"]]
    if len(set(labels)) != len(labels):
        errors.append(f"{pr['type']}{pr['n']}: 小問ラベルが重複 {labels}")
    for it in pr["items"]:
        ans = it["ans"]
        if ans == "@":
            key = (pr["n"], it["label"])
            if pr["type"] != "演習問題" or key not in answers:
                errors.append(f"答えが見つからない: {pr['type']}{pr['n']} {it['label']!r}")
                continue
            ans = answers[key]; used.add(key)
        prompt = it["prompt"]
        speech = yc.speech(prompt)
        b = ["C: " + pr["chapter"], "TYPE: " + pr["type"], f"N: {pr['n']}"]
        if it["label"] or len(pr["items"]) > 1:
            b.append("S: " + (it["label"] or "全体"))
        b += [f"P: {pr['p']}", f"AP: {pr['ap']}", "T: solve", "Q: " + prompt, "R: " + speech, "A: " + ans]
        if it["figs"]:
            b.append("F: " + " / ".join(it["figs"]))
        out.append("\n".join(b)); out.append("---"); count += 1
for k in answers:
    if k not in used:
        errors.append(f"使われなかった答え: E{k[0]} {k[1]!r}")
(root / "data/manual-import/math1a-kiso-seikou.txt").write_text("\n".join(out[:-1]) + "\n", encoding="utf-8")
print(f"問題 {len(problems)} 件（基礎問 {sum(p['type']=='基礎問' for p in problems)}、演習問題 {sum(p['type']=='演習問題' for p in problems)}）/ 小問 {count} 件")
print("\n".join(errors) if errors else "エラーなし")
