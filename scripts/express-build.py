#!/usr/bin/env python3
"""短期集中ゼミ 基礎からの数学(Word)の取り出し結果 data/manual-import/express-src/{a,b}.json を
手動入力テンプレート data/manual-import/express-1a.txt / express-2bc.txt に変換する。
(a.json/b.json は scripts/docx-math-extract.py が sankosho の Word から作る)
手直しは data/manual-import/express-src/overrides-{a,b}.json に書く:
  {"<番号>": {"stem": "共通の問題文", "items": [["(1)", "小問の問題文", "答え"], ...], "figs": false}}
  items の問題文が空のときは stem だけを問う。figs:false で図を付けない。"""
import re, sys, json, importlib.util, pathlib
sys.stdout.reconfigure(encoding="utf-8")
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "data/manual-import/express-src"
spec = importlib.util.spec_from_file_location("yc", root / "scripts/yellow-chart-v2.py")
yc = importlib.util.module_from_spec(spec); spec.loader.exec_module(yc)

BOOKS = {
    "a": dict(out="express-1a.txt", figdir="express1a", chapters=[
        (1, "第1章 数と式"), (11, "第2章 2次関数"), (21, "第3章 2次方程式・2次不等式"), (31, "第4章 集合と論理"),
        (36, "第5章 図形と計量"), (48, "第6章 データの分析"), (53, "第7章 場合の数と確率"),
        (74, "第8章 図形の性質"), (81, "第9章 整数の性質")]),
    "b": dict(out="express-2bc.txt", figdir="express2bc", chapters=[
        (1, "第1章 式と証明・複素数と方程式"), (17, "第2章 図形と方程式"), (31, "第3章 三角関数"), (39, "第4章 指数関数・対数関数"),
        (50, "第5章 微分・積分"), (64, "第6章 数列"), (77, "第7章 統計的な推測"), (90, "第8章 ベクトル"),
        (111, "第9章 複素数平面"), (125, "第10章 式と曲線")]),
}
LABEL = re.compile(r"（(\d+|[ア-オ])）")

def clean(s):
    s = re.sub(r"[　 ]*〈[^〉]*〉", "", s)
    s = re.sub(r"(\d+/\d+)(?=[A-Za-zπα-ωΑ-Ω√→])", r"(\1)", s)
    s = re.sub(r"(\d+/\d+)(?=\()", r"(\1)", s)
    s = re.sub(r"\^(\d+[A-Za-z]+)", r"^(\1)", s)
    s = re.sub(r"(連立(?:方程式|不等式)) ［連立：(.*?)］", lambda m: m[1] + " " + m[2].replace(" ／ ", "，"), s)
    s = re.sub(r"\(([A-Za-zα-ωΑ-Ω])\)‾", lambda m: m[1] + "̄", s)          # (A)‾ -> Ā
    s = re.sub(r"\(([^()]+)\)‾", lambda m: "(" + m[1] + ")の補集合", s)   # (C∪D)‾ -> (C∪D)の補集合
    s = re.sub(r"(log[\u2080-\u2089]+)(\d+/\d+)", lambda m: m[1] + "(" + m[2] + ")", s)
    s = re.sub(r"(sin|cos|tan) ([θα-ω])/(\d)", lambda m: m[1] + "(" + m[2] + "/" + m[3] + ")", s)
    s = s.replace("　", " ")
    return re.sub(r"\s+", " ", s).strip()

def split_labeled(lines):
    """行のリストを (前置き行, [(ラベル, 本文)...], 後ろの行) に分ける。"""
    pre, items, post = [], [], []
    for ln in lines:
        parts = re.split(r"(?=（(?:\d+|[ア-オ])）)", ln)
        parts = [p for p in parts if p.strip()]
        if parts and LABEL.match(parts[0]):
            for p in parts:
                m = LABEL.match(p)
                if m: items.append(["(" + m[1] + ")", p[m.end():]])
                else: items[-1][1] += p
        elif items: post.append(ln)
        else: pre.append(ln)
    return pre, items, post

def speech(prompt):
    t = prompt.replace("□", "空欄")
    t = re.sub(r"\{([a-zA-Z])\|", lambda m: "{" + m[1] + " ただし ", t)   # 集合 {x|x<1}
    t = re.sub("([A-Za-z])" + chr(0x304), lambda m: m[1] + ("の補集合" if (m[1] in "ABCDU" and "{" in t) else "バー"), t)
    t = t.replace(chr(0x233), "yバー").replace("sₓ", "sエックス").replace("sᵧ", "sワイ")
    return yc.speech(t)

def build(key):
    cfg = BOOKS[key]
    probs = json.loads((src / f"{key}.json").read_text(encoding="utf-8"))
    ov_path = src / f"overrides-{key}.json"
    ov = json.loads(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else {}
    out = [f"# 短期集中ゼミ（scripts/express-build.py が data/manual-import/express-src から作る。直接編集しない）", ""]
    count, warn = 0, []
    for pr in probs:
        n = pr["n"]
        chapter = [c for s, c in cfg["chapters"] if s <= n][-1]
        q = [clean(x) for x in pr["q"]]; a = [clean(x) for x in pr["a"]]
        o = ov.get(str(n))
        if o:
            stem = o.get("stem", ""); items = [(l, t, ans) for l, t, ans in o["items"]]
        else:
            pre, qi, post = split_labeled(q)
            _, ai, apost = split_labeled(a)
            stem = " ".join(pre)
            if qi:
                amap = {l: t for l, t in ai}
                if len(ai) == len(qi) and set(amap) == {l for l, _ in qi}:
                    items = [(l, t.strip() + (" " + " ".join(post) if post and i == len(qi) - 1 else ""), amap[l].strip()) for i, (l, t) in enumerate(qi)]
                else:
                    warn.append(f"{n}: 小問の数が問題と答えで合わない {len(qi)} vs {len(ai)}")
                    items = [("", " ".join(q), " ／ ".join(a))]; stem = ""
            elif ai:
                items = [(l, "", t.strip()) for l, t in ai]
            else:
                items = [("", "", " ／ ".join(a))]
        figs = [f"{cfg['figdir']}/{pathlib.Path(x).name}" for x in dict.fromkeys(pr["qimg"])]
        if o and o.get("figs") is False: figs = []
        if not o and not pr["qimg"] and re.search(r"右の|下の|次の図|図の", " ".join(q)): warn.append(f"{n}: 図を指す言葉があるが図が無い")
        for label, text, ans in items:
            if not text and not stem: prompt = pr["title"]
            elif not text: prompt = stem + (f" 【{label}】" if label and len(items) > 1 else "")
            else: prompt = (stem + " " + text).strip()
            b = ["C: " + chapter, f"N: {n}"]
            if label: b.append("S: " + label)
            elif len(items) > 1: b.append("S: 全体")
            b += [f"P: {n}", f"AP: {n}", "T: solve", "Q: " + prompt, "R: " + speech(prompt), "A: " + ans]
            if figs: b.append("F: " + " / ".join(figs))
            if not ans: warn.append(f"{n} {label}: 答えが空")
            if "□" in prompt: warn.append(f"{n} {label}: □が残っている")
            out.append("\n".join(b)); out.append("---"); count += 1
    (root / "data/manual-import" / cfg["out"]).write_text("\n".join(out[:-1]) + "\n", encoding="utf-8")
    print(f"{cfg['out']}: 問題 {len(probs)} 件 / 小問 {count} 件")
    print("\n".join(warn) if warn else "警告なし")

for k in (sys.argv[1:] or ["a", "b"]): build(k)
