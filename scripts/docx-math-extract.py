#!/usr/bin/env python3
"""短期集中ゼミ(Word)から、問題番号・題名・問題文・最終結果・図を取り出す。
Word の数式(OMML)を 1/(√5+2) のような一行の式に直す。
使い方: python -X utf8 scripts/docx-math-extract.py <docx> <出力json> [図の出力フォルダ]"""
import sys, re, json, zipfile, pathlib
import xml.etree.ElementTree as ET
M = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

def wrap(s):
    s = s.strip()
    if len(s) <= 1 or re.fullmatch(r"[\w.]+", s) or (s.startswith("(") and s.endswith(")") and balanced(s[1:-1])):
        return s
    return f"({s})"
def balanced(s):
    d = 0
    for c in s:
        d += c == "("; d -= c == ")"
        if d < 0: return False
    return d == 0

def omml(e):
    t = e.tag
    if t == M + "t": return e.text or ""
    if t == M + "f":
        return wrap(omml(e.find(M+"num"))) + "/" + wrap(omml(e.find(M+"den")))
    if t == M + "rad":
        deg = omml(e.find(M+"deg")) if e.find(M+"deg") is not None else ""
        body = omml(e.find(M+"e"))
        r = "√" + wrap(body)
        return (f"{deg}乗根" + wrap(body)) if deg.strip() and deg.strip() != "2" else r
    if t == M + "sSub":
        sub = omml(e.find(M+"sub")); SUB = {**{str(i): "₀₁₂₃₄₅₆₇₈₉"[i] for i in range(10)}, "n": "ₙ", "+": "₊", "-": "₋", "−": "₋"}
        if sub and all(c in SUB for c in sub): sub = "".join(SUB[c] for c in sub); return omml(e.find(M+"e")) + sub
        return omml(e.find(M+"e")) + "_" + wrap(sub)
    if t == M + "acc":
        ch = e.find(M+"accPr/"+M+"chr"); ch = ch.get(M+"val") if ch is not None else "̂"
        body = omml(e.find(M+"e"))
        if ch == "⃗": return "→" + body
        return body + ch
    if t == M + "sSup":
        return omml(e.find(M+"e")) + "^" + wrap(omml(e.find(M+"sup")))
    if t == M + "bar":
        return "(" + omml(e.find(M+"e")) + ")‾"
    if t == M + "d":
        pr = e.find(M+"dPr"); beg, end = "(", ")"
        if pr is not None:
            b = pr.find(M+"begChr"); en = pr.find(M+"endChr")
            if b is not None: beg = b.get(M+"val", "")
            if en is not None: end = en.get(M+"val", "")
        inner = "，".join(omml(x) for x in e.findall(M+"e"))
        if beg == "{" and end in ("", None): return inner  # 連立の左かっこ
        return beg + inner + end
    if t == M + "m":
        rows = []
        for mr in e.findall(M+"mr"):
            rows.append(" ".join(omml(c) for c in mr.findall(M+"e")))
        return "［連立：" + " ／ ".join(rows) + "］"
    return "".join(omml(c) for c in e if not c.tag.endswith(("Pr", "ctrlPr")))

def para(p, rels):
    out, imgs = [], []
    def walk(n):
        for c in n:
            if c.tag == M + "oMath": out.append(omml(c))
            elif c.tag == M + "oMathPara":
                for mm in c.findall(M+"oMath"): out.append(omml(mm))
            elif c.tag == W + "t": out.append(c.text or "")
            elif c.tag == W + "tab": out.append(" ")
            elif c.tag == W + "br": out.append(" ")
            elif c.tag == A + "blip":
                imgs.append(rels[c.get(R+"embed")])
            elif c.tag == M + "oMath": pass
            else: walk(c)
    walk(p)
    return "".join(out).strip(), imgs

def main():
    docx, outjson = sys.argv[1], sys.argv[2]
    figdir = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
    z = zipfile.ZipFile(docx)
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("word/_rels/document.xml.rels"))}
    body = ET.fromstring(z.read("word/document.xml")).find(W+"body")
    paras = []
    for p in body.iter(W+"p"):
        # oMath が段落直下にある場合も含めて走査
        txt, imgs = para(p, rels)
        paras.append((txt, imgs))
    probs, cur, mode = [], None, "q"
    for txt, imgs in paras:
        m = re.match(r"^(\d{1,3})[\s　]+(.+)$", txt)
        if m and (cur is None or int(m[1]) == cur["n"] + 1):
            cur = dict(n=int(m[1]), title=m[2], q=[], a=[], qimg=[], aimg=[]); probs.append(cur); mode = "q"; continue
        if cur is None: continue
        if txt.strip() == "最終結果": mode = "a"; continue
        if txt: cur["q" if mode == "q" else "a"].append(txt)
        for im in imgs: cur["qimg" if mode == "q" else "aimg"].append(im)
    if figdir:
        figdir.mkdir(parents=True, exist_ok=True)
        for pr in probs:
            for im in set(pr["qimg"] + pr["aimg"]):
                (figdir / pathlib.Path(im).name).write_bytes(z.read("word/" + im))
    pathlib.Path(outjson).write_text(json.dumps(probs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(probs), "題", "最終番号", probs[-1]["n"], "図付き", sum(1 for p in probs if p["qimg"] or p["aimg"]))
main()
