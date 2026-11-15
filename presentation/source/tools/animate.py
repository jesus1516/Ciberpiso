"""Inyecta transiciones (Morph con fallback a Fade) y animaciones de entrada en un .pptx.

Uso: python3 tools/animate.py base.pptx anim.json salida.pptx

anim.json: {"slides": {"1": {"transition": "fade"|"morph"|"push",
                              "dur": 1500,
                              "anims": [{"names": ["tagline"] | "prefix": "card0_",
                                         "fx": "fade"|"rise"|"zoom", "at": 600, "dur": 600}]}}}
Las animaciones arrancan solas al entrar en la diapositiva ("después de la anterior"),
cada grupo en su instante "at" (ms desde el inicio de la diapositiva).
"""
import json, re, shutil, sys, tempfile, zipfile
from pathlib import Path
from lxml import etree

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
P = "{%s}" % NS["p"]
MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
P159 = "http://schemas.microsoft.com/office/powerpoint/2015/09/main"


def transition_xml(kind, dur):
    spd = "slow" if dur >= 1000 else "med"
    if kind == "morph":
        return (
            f'<mc:AlternateContent xmlns:mc="{MC}">'
            f'<mc:Choice xmlns:p159="{P159}" Requires="p159">'
            f'<p:transition xmlns:p="{NS["p"]}" xmlns:p14="{P14}" spd="slow" p14:dur="{dur}">'
            f'<p159:morph option="byObject"/></p:transition></mc:Choice>'
            f'<mc:Fallback><p:transition xmlns:p="{NS["p"]}" spd="slow"><p:fade/></p:transition></mc:Fallback>'
            f'</mc:AlternateContent>'
        )
    inner = {"fade": "<p:fade/>", "fadeblack": '<p:fade thruBlk="1"/>', "push": '<p:push dir="l"/>'}[kind]
    return (
        f'<mc:AlternateContent xmlns:mc="{MC}">'
        f'<mc:Choice xmlns:p14="{P14}" Requires="p14">'
        f'<p:transition xmlns:p="{NS["p"]}" xmlns:p14="{P14}" spd="{spd}" p14:dur="{dur}">{inner}</p:transition></mc:Choice>'
        f'<mc:Fallback><p:transition xmlns:p="{NS["p"]}" spd="{spd}">{inner}</p:transition></mc:Fallback>'
        f'</mc:AlternateContent>'
    )


class Ids:
    def __init__(self):
        self.n = 2  # 1 = raíz, 2 = secuencia principal

    def __call__(self):
        self.n += 1
        return self.n


def set_vis(ids, spid):
    return (f'<p:set><p:cBhvr><p:cTn id="{ids()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:to><p:strVal val="visible"/></p:to></p:set>')


def fade(ids, spid, dur):
    return (f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ids()}" dur="{dur}"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>')


def anim(ids, spid, dur, attr, frm, to):
    return (f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ids()}" dur="{dur}" fill="hold"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{frm}"/></p:val></p:tav>'
            f'<p:tav tm="100000"><p:val><p:strVal val="{to}"/></p:val></p:tav></p:tavLst></p:anim>')


# presetID de PowerPoint: 10 = Fade, 42 = Float In (subir), 53 = Zoom
PRESETS = {"fade": (10, 0), "rise": (42, 0), "zoom": (53, 16)}


def effect(ids, spid, fx, dur, node):
    pid, sub = PRESETS[fx]
    cid = ids()
    beh = set_vis(ids, spid) + fade(ids, spid, dur)
    if fx == "rise":
        beh += anim(ids, spid, dur, "ppt_x", "#ppt_x", "#ppt_x") + anim(ids, spid, dur, "ppt_y", "#ppt_y+.06", "#ppt_y")
    elif fx == "zoom":
        beh += anim(ids, spid, dur, "ppt_w", "#ppt_w*0.7", "#ppt_w") + anim(ids, spid, dur, "ppt_h", "#ppt_h*0.7", "#ppt_h")
    return (f'<p:par><p:cTn id="{cid}" presetID="{pid}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{beh}</p:childTnLst></p:cTn></p:par>')


def timing_xml(groups, kinds):
    """groups: lista [(at_ms, [(spid, fx, dur), ...])] ordenada por at."""
    ids = Ids()
    outer = ids()
    inner = ""
    first = True
    for at, effs in groups:
        par_id = ids()
        body = ""
        for spid, fx, dur in effs:
            body += effect(ids, spid, fx, dur, "afterEffect" if first else "withEffect")
            first = False
        inner += (f'<p:par><p:cTn id="{par_id}" fill="hold"><p:stCondLst><p:cond delay="{at}"/></p:stCondLst>'
                  f'<p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>')
    bld = ""
    for spid, kind in kinds.items():
        if kind == "sp":
            bld += f'<p:bldP spid="{spid}" grpId="0" animBg="1"/>'
        elif kind == "graphicFrame":
            bld += f'<p:bldGraphic spid="{spid}" grpId="0"><p:bldAsOne/></p:bldGraphic>'
    return (
        f'<p:timing xmlns:p="{NS["p"]}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        f'<p:par><p:cTn id="{outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        f'<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>{inner}</p:childTnLst></p:cTn></p:par>'
        f'</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        f'<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        f'</p:childTnLst></p:cTn></p:par></p:tnLst>' + (f'<p:bldLst>{bld}</p:bldLst>' if bld else '') + '</p:timing>'
    )


def shapes_by_name(root):
    out = {}
    for el in root.iter(P + "sp", P + "pic", P + "graphicFrame", P + "cxnSp"):
        c = el.find(".//p:cNvPr", NS)
        if c is not None:
            kind = etree.QName(el).localname
            out[c.get("name")] = (c.get("id"), "sp" if kind in ("sp", "cxnSp") else kind)
    return out


def slide_order(tmp):
    pres = etree.parse(str(tmp / "ppt/presentation.xml"))
    rels = etree.parse(str(tmp / "ppt/_rels/presentation.xml.rels"))
    rmap = {r.get("Id"): r.get("Target") for r in rels.getroot()}
    rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    return [tmp / "ppt" / rmap[s.get(rid)] for s in pres.getroot().find("p:sldIdLst", NS)]


def main(src, cfg_path, dst):
    cfg = json.loads(Path(cfg_path).read_text())["slides"]
    tmp = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(src) as z:
        z.extractall(tmp)
    for i, path in enumerate(slide_order(tmp), start=1):
        c = cfg.get(str(i))
        if not c:
            continue
        tree = etree.parse(str(path))
        root = tree.getroot()
        for old in root.findall("p:transition", NS) + root.findall("p:timing", NS) + root.findall("{%s}AlternateContent" % MC):
            root.remove(old)
        shapes = shapes_by_name(root)
        groups, kinds = {}, {}
        for a in c.get("anims", []):
            names = a.get("names") or [n for n in shapes if n.startswith(a["prefix"])]
            if not names:
                sys.exit(f"diapositiva {i}: nada coincide con {a}")
            for n in names:
                if n not in shapes:
                    sys.exit(f"diapositiva {i}: no existe la forma '{n}'")
                spid, kind = shapes[n]
                groups.setdefault(a["at"], []).append((spid, a.get("fx", "fade"), a.get("dur", 600)))
                kinds[spid] = kind
        clr = root.find("p:clrMapOvr", NS)
        pos = list(root).index(clr) + 1 if clr is not None else len(root)
        if c.get("transition"):
            root.insert(pos, etree.fromstring(transition_xml(c["transition"], c.get("dur", 1200))))
            pos += 1
        if groups:
            root.insert(pos, etree.fromstring(timing_xml(sorted(groups.items()), kinds)))
        tree.write(str(path), xml_declaration=True, encoding="UTF-8", standalone=True)
        print(f"diapositiva {i}: {c.get('transition')} · {sum(len(v) for v in groups.values())} animaciones")
    out = Path(dst)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml primero, como hace Office
        files = sorted(p for p in tmp.rglob("*") if p.is_file())
        files.sort(key=lambda p: p.name != "[Content_Types].xml")
        for p in files:
            z.write(p, p.relative_to(tmp).as_posix())
    shutil.rmtree(tmp)
    print("ok", out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
