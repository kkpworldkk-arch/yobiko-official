import re,sys
sys.stdout.reconfigure(encoding="utf-8")
P="data/manual-import/chemistry-230.txt"
ELEM=set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Ag Cd Sn Sb I Xe Cs Ba Pt Au Hg Pb Bi U".split())
ABC=dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ","エー ビー シー ディー イー エフ ジー エイチ アイ ジェー ケー エル エム エヌ オー ピー キュー アール エス ティー ユー ブイ ダブリュー エックス ワイ ゼット".split()))
NUM={1:"ワン",2:"ツー",3:"スリー",4:"フォー",5:"ファイブ",6:"シックス",7:"セブン",8:"エイト",9:"ナイン",10:"テン",11:"イレブン",12:"トゥエルブ",14:"フォーティーン",16:"シックスティーン",17:"セブンティーン",18:"エイティーン",20:"トゥエンティ",60:"シックスティ"}
def num(s):
    n=int(s); return NUM.get(n) or "".join(NUM[int(c)] if c!="0" else "ゼロ" for c in s)
TOKEN=re.compile(r"(?<![A-Za-z0-9])((?:\[|\()?[A-Z][a-z]?(?:[A-Z][a-z]?|\d+|[()\[\]]|・\d*)*(?:\d*[+＋\-−])?)(?![A-Za-z0-9.%])")
def read(tok):
    m=re.match(r"^(.*?)(\d*)([+＋\-−])$",tok)
    body,charge="",""
    if m and (m.group(2) or not re.search(r"\d$",m.group(1))):
        body=m.group(1); charge=(num(m.group(2)) if m.group(2) else "")+("プラス" if m.group(3) in "+＋" else "マイナス")
    else: body=tok
    out=[];i=0;elems=0
    while i<len(body):
        c=body[i]
        if c.isupper():
            sym=body[i:i+2] if i+1<len(body) and body[i+1].islower() else c
            if sym not in ELEM: return None
            out.append("".join(ABC[x.upper()] for x in sym)); elems+=1; i+=len(sym)
        elif c.isdigit():
            j=i
            while j<len(body) and body[j].isdigit(): j+=1
            out.append(num(body[i:j])); i=j
        elif c in "()[]": i+=1
        elif c=="・": out.append("・"); i+=1
        else: return None
    # 単独の元素記号1文字（「原子X」「試料A」などの記号と区別がつかない）は、数字か電荷がある時だけ読む
    if elems==1 and len(body)<=2 and not re.search(r"\d",body) and not charge: return None
    return "".join(out)+charge
def speech(q):
    changed=False
    def rep(m):
        nonlocal changed
        r=read(m.group(1))
        if r: changed=True; return r
        return m.group(1)
    s=TOKEN.sub(rep,q)
    return s if changed else None

text=open(P,encoding="utf-8").read()
lines=text.split("\n")
# 1) ブロック単位で処理
out=[];block=[]
def flush():
    if not block: return
    keys=[re.match(r"^([A-Z]+):",l).group(1) if re.match(r"^([A-Z]+):",l) else None for l in block]
    if "N" in keys and "R" not in keys and "Q" in keys:
        qi=keys.index("Q"); qlines=[block[qi][2:].strip()]; j=qi+1
        while j<len(block) and keys[j] is None and block[j].strip(): qlines.append(block[j]); j+=1
        sp=speech("\n".join(qlines))
        if sp:
            sp_lines=sp.split("\n"); block[j:j]=["R: "+sp_lines[0]]+sp_lines[1:]
            stats["R"]+=1
    out.extend(block); block.clear()
stats={"R":0}
for l in lines:
    if l.startswith("#") or l.strip()=="":
        flush(); out.append(l); continue
    block.append(l)
    if l.strip()=="---": flush()
flush()
open(P,"w",encoding="utf-8",newline="").write("\n".join(out))
print("読み上げ文を追加:",stats["R"])
