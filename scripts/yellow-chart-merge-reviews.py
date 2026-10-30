"""手作業で書いた書き直し（data/yellow-chart/ の proof-answers-*.json、region-prompts.json、prompt-fixes.json など）を
overrides.json に小問単位でまとめる。v2.json の元の問題文を使うので、先に yellow-chart-v2.py を実行しておく。"""
import json, re, sys
from pathlib import Path
W = Path("data/yellow-chart")
sys.stdout.reconfigure(encoding="utf-8")
# 元の問題文は、書き直しを当てる前の解析結果から取る
import importlib.util
spec = importlib.util.spec_from_file_location("v2", "scripts/yellow-chart-v2.py"); v2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v2)
original = {}
for book, part, pattern in v2.SOURCES:
    for path in sorted(v2.IMPORT_DIR.glob(pattern)):
        for ex in v2.parse_file(path, book, part):
            for item in ex.get("items", []):
                original.setdefault(f"{part}|{ex['number']}|{item['sub']}", item)

def to_outline(prompt: str) -> str:
    p = re.sub(r"(?:ことを|を)?(?:証明せよ|示せ)。?", "ことを証明するとき、方針と要点を答えよ。", prompt, count=1)
    return p.replace("ことことを", "ことを")

overrides = json.loads((W / "overrides.json").read_text(encoding="utf-8"))
count = 0
for f in sorted(W.glob("proof-answers-*.json")):
    for key, (answer, keywords) in json.loads(f.read_text(encoding="utf-8")).items():
        base = original.get(key)
        if not base:
            print("元の小問が見つからない:", key); continue
        overrides[key] = {"prompt": to_outline(base["prompt"]), "answer": answer, "keywords": keywords, "style": "proof"}
        count += 1
for key, prompt in json.loads((W / "region-prompts.json").read_text(encoding="utf-8")).items():
    base = original.get(key)
    if not base:
        print("元の小問が見つからない:", key); continue
    overrides[key] = {"prompt": prompt, "answer": base["answer"]}
    count += 1
for name in ("prompt-fixes.json", "fixes-figure.json", "fixes-graph.json", "fixes-misc.json"):
    path = W / name
    if not path.exists():
        continue
    for key, patch in json.loads(path.read_text(encoding="utf-8")).items():
        if key.count("|") == 1:
            # 例題単位の書き直し（小問の分け方を変えるとき）
            overrides[key] = {"items": [{**it, "flags": []} for it in patch["items"]]}
            count += 1
            continue
        if key not in original and not patch.get("skip"):
            print("元の小問が見つからない:", key); continue
        overrides[key] = patch
        count += 1
(W / "overrides.json").write_text(json.dumps(overrides, ensure_ascii=False, indent=1), encoding="utf-8")
print("小問単位の書き直し", count, "件を登録")
