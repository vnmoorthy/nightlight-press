"""Add slide transitions, staggered entrance animations and video autoplay to the generated deck."""
import re, sys, shutil, zipfile, os
src, dst = sys.argv[1], sys.argv[2]
tmp = "/tmp/deck_motion"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
zipfile.ZipFile(src).extractall(tmp)
TRANS = {1: '<p:fade/>', 2: '<p:push dir="u"/>', 3: '<p:fade/>', 4: '<p:fade/>', 5: '<p:push dir="l"/>', 6: '<p:wipe dir="r"/>', 7: '<p:fade/>', 8: '<p:push dir="u"/>', 9: '<p:cover dir="l"/>', 10: '<p:fade/>'}
SPEED = {1: "slow", 4: "slow", 10: "slow"}
def effect(ctn, spid, delay, first):
    node = "afterEffect" if first else "withEffect"
    return (f'<p:par><p:cTn id="{ctn}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{ctn+1}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ctn+2}" dur="550"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
            f'</p:childTnLst></p:cTn></p:par>')
for n in range(1, 11):
    p = f"{tmp}/ppt/slides/slide{n}.xml"; x = open(p, encoding="utf-8").read()
    shapes = []
    for m in re.finditer(r'<p:(sp|pic|graphicFrame)\b.*?</p:\1>', x, flags=re.S):
        cm = re.search(r'<p:cNvPr id="(\d+)" name="([^"]*)"', m.group(0))
        if cm: shapes.append((m.group(1), int(cm.group(1)), cm.group(2)))
    anims = []
    for kind, sid, name in shapes:
        a = re.match(r'anim-(\d+)(?:-(\d+))?', name)
        if a: anims.append((int(a.group(1)), int(a.group(2) or 0), kind, sid))
    anims.sort(key=lambda t: (t[0], t[1], t[3]))
    video = next((s for k, s, nm in shapes if nm == "townvideo"), None)
    ctn = 5; inner = []; first = True
    if video:
        inner.append(f'<p:par><p:cTn id="{ctn}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="{ctn+1}" dur="33000" fill="hold"/><p:tgtEl><p:spTgt spid="{video}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>')
        ctn += 2; first = False
    for step, sub, kind, sid in anims:
        delay = 250 + (step - 1) * 420 + sub * 140
        inner.append(effect(ctn, sid, delay, first)); ctn += 3; first = False
    timing = ""
    if inner:
        main = (f'<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
                f'<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{"".join(inner)}</p:childTnLst></p:cTn></p:par>'
                f'</p:childTnLst></p:cTn></p:par>')
        media = ""
        if video:
            media = f'<p:video><p:cMediaNode vol="80000"><p:cTn id="{ctn}" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{video}"/></p:tgtEl></p:cMediaNode></p:video>'
        bld = "".join(f'<p:bldP spid="{sid}" grpId="0" animBg="1"/>' if kind == "sp" else (f'<p:bldGraphic spid="{sid}" grpId="0"><p:bldAsOne/></p:bldGraphic>' if kind == "graphicFrame" else "") for _, _, kind, sid in anims)
        timing = (f'<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
                  f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>{main}</p:childTnLst></p:cTn>'
                  f'<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
                  f'{media}</p:childTnLst></p:cTn></p:par></p:tnLst>{"<p:bldLst>" + bld + "</p:bldLst>" if bld else ""}</p:timing>')
    trans = f'<p:transition spd="{SPEED.get(n, "med")}">{TRANS[n]}</p:transition>'
    x = x.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + trans + timing, 1)
    open(p, "w", encoding="utf-8").write(x)
    print(f"slide {n}: {len(anims)} animated, video={bool(video)}")
if os.path.exists(dst): os.remove(dst)
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    names = []
    for root, _, files in os.walk(tmp):
        for f in files: names.append(os.path.relpath(os.path.join(root, f), tmp))
    names.sort(key=lambda n: (n != "[Content_Types].xml", n))
    for nm in names: z.write(os.path.join(tmp, nm), nm)
print("wrote", dst)
