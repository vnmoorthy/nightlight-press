"""Add slide transitions, staggered fade-in entrances and looping video autoplay to the generated deck.

    python3 motion.py in.pptx out.pptx

Shapes named  anim-<step>-<sub>[suffix]  fade in automatically after the slide appears: steps run
420 ms apart, subs 120 ms apart. Every video (a <p:pic> holding <a:videoFile>) starts by itself,
loops, and gets a unique shape id (pptxgenjs derives the id from the rel id, which can collide).
"""
import os, re, shutil, subprocess, sys, tempfile, zipfile

src, dst = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp(prefix="nl-motion-")
zipfile.ZipFile(src).extractall(tmp)

TRANS = {1: '<p:fade/>', 2: '<p:push dir="u"/>', 3: '<p:fade/>', 4: '<p:fade/>', 5: '<p:push dir="l"/>',
         6: '<p:fade thruBlk="1"/>', 7: '<p:wipe dir="r"/>', 8: '<p:push dir="u"/>', 9: '<p:cover dir="l"/>', 10: '<p:fade thruBlk="1"/>'}
SPEED = {1: "slow", 6: "slow", 10: "slow"}


def video_ms(slide_no, rid):
    """Length of the video behind relationship rid, from the slide's rels, via ffprobe (fallback 30 s)."""
    rels = open(f"{tmp}/ppt/slides/_rels/slide{slide_no}.xml.rels", encoding="utf-8").read()
    m = re.search(rf'Id="{rid}"[^>]*Target="([^"]+)"', rels) or re.search(rf'Target="([^"]+)"[^>]*Id="{rid}"', rels)
    if not m:
        return 30000
    media = os.path.normpath(os.path.join(tmp, "ppt", "slides", m.group(1)))
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", media],
                             capture_output=True, text=True, timeout=20).stdout.strip()
        return max(1000, int(float(out) * 1000))
    except Exception:
        return 30000


def effect(ctn, spid, delay, first):
    node = "afterEffect" if first else "withEffect"
    return (f'<p:par><p:cTn id="{ctn}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{ctn+1}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ctn+2}" dur="500"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
            f'</p:childTnLst></p:cTn></p:par>')


slides = sorted(int(m.group(1)) for f in os.listdir(f"{tmp}/ppt/slides") if (m := re.match(r"slide(\d+)\.xml$", f)))
for n in slides:
    p = f"{tmp}/ppt/slides/slide{n}.xml"
    x = open(p, encoding="utf-8").read()
    x = re.sub(r"<p:transition\b.*?</p:transition>|<p:timing>.*?</p:timing>", "", x, flags=re.S)  # idempotent

    # give every video a unique shape id
    ids = [int(i) for i in re.findall(r'<p:cNvPr id="(\d+)"', x)]
    next_id = max(ids + [1]) + 100
    videos = []  # (spid, rid)

    def renumber(m):
        global next_id
        pic = m.group(0)
        if "<a:videoFile" not in pic:
            return pic
        rid = re.search(r'<a:videoFile r:link="([^"]+)"', pic).group(1)
        pic = re.sub(r'<p:cNvPr id="\d+"', f'<p:cNvPr id="{next_id}"', pic, count=1)
        videos.append((next_id, rid))
        next_id += 1
        return pic
    x = re.sub(r"<p:pic>.*?</p:pic>", renumber, x, flags=re.S)

    shapes = []
    for m in re.finditer(r"<p:(sp|pic|graphicFrame)\b.*?</p:\1>", x, flags=re.S):
        cm = re.search(r'<p:cNvPr id="(\d+)" name="([^"]*)"', m.group(0))
        if cm:
            shapes.append((m.group(1), int(cm.group(1)), cm.group(2)))
    anims = []
    for kind, sid, name in shapes:
        a = re.match(r"anim-(\d+)-(\d+)([a-z]?)", name)
        if a:
            anims.append((int(a.group(1)), int(a.group(2)), a.group(3), kind, sid))
    anims.sort(key=lambda t: (t[0], t[1], t[2], t[4]))

    ctn = 5
    inner, first = [], True
    for spid, rid in videos:
        dur = video_ms(n, rid)
        inner.append(f'<p:par><p:cTn id="{ctn}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="{"afterEffect" if first else "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="{ctn+1}" dur="{dur}" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>')
        ctn += 2
        first = False
    for step, sub, _, kind, sid in anims:
        delay = 200 + (step - 1) * 420 + sub * 120
        inner.append(effect(ctn, sid, delay, first))
        ctn += 3
        first = False

    timing = ""
    if inner:
        main = (f'<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
                f'<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{"".join(inner)}</p:childTnLst></p:cTn></p:par>'
                f'</p:childTnLst></p:cTn></p:par>')
        media = ""
        for spid, _ in videos:
            media += (f'<p:video><p:cMediaNode vol="80000"><p:cTn id="{ctn}" repeatCount="indefinite" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn>'
                      f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cMediaNode></p:video>')
            ctn += 1
        bld = "".join(f'<p:bldP spid="{sid}" grpId="0" animBg="1"/>' if kind == "sp" else
                      (f'<p:bldGraphic spid="{sid}" grpId="0"><p:bldAsOne/></p:bldGraphic>' if kind == "graphicFrame" else "")
                      for _, _, _, kind, sid in anims)
        timing = (f'<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
                  f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>{main}</p:childTnLst></p:cTn>'
                  f'<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
                  f'{media}</p:childTnLst></p:cTn></p:par></p:tnLst>{"<p:bldLst>" + bld + "</p:bldLst>" if bld else ""}</p:timing>')
    trans = f'<p:transition spd="{SPEED.get(n, "med")}">{TRANS.get(n, "<p:fade/>")}</p:transition>'
    x = x.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + trans + timing, 1)
    open(p, "w", encoding="utf-8").write(x)
    print(f"slide {n}: {len(anims)} animated, videos={len(videos)}")

if os.path.exists(dst):
    os.remove(dst)
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    names = []
    for root, _, files in os.walk(tmp):
        for f in files:
            names.append(os.path.relpath(os.path.join(root, f), tmp))
    names.sort(key=lambda nm: (nm != "[Content_Types].xml", nm))
    for nm in names:
        z.write(os.path.join(tmp, nm), nm)
shutil.rmtree(tmp, ignore_errors=True)
print("wrote", dst)
