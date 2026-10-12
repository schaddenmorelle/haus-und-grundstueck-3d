#!/usr/bin/env python3
"""Baut die veröffentlichbare Seite (CDN-Three.js) und eine lokale Testseite.

  dist/haus-und-grundstueck-3d.html   -> wird als Artifact veröffentlicht
  dist/test_page.html                 -> lokal (node_modules/three), für Screenshots/Tests
"""
import json, os, re
root = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
tpl = rd('src/tpl.html')
# Node-Export und require() entfallen in der Seite (die Module liegen dort als globale Funktionen hintereinander)
strip_exports = lambda t: re.sub(r"^if [(]typeof (module|require) !== 'undefined'[)].*$", "", t, flags=re.M)
model = strip_exports(rd('src/model.js'))
werte, raeume, dach, treppe, wohnflaeche, pruefen, grundriss, schnitt, aendern, aufmass = (strip_exports(rd('src/' + n + '.js')) for n in ('werte', 'raeume', 'dach', 'treppe', 'wohnflaeche', 'pruefen', 'grundriss', 'schnitt', 'aendern', 'aufmass'))
# polygon-clipping (MIT) wird in die Seite eingebaut, kein zusätzliches CDN
clip_lizenz = rd('node_modules/polygon-clipping/LICENSE.md').replace('*/', '* /')
clipping = '/* polygon-clipping 0.15.7\n' + clip_lizenz + '\n*/\n' + rd('node_modules/polygon-clipping/dist/polygon-clipping.umd.min.js')
haus = json.dumps(json.loads(rd('src/data/haus.json')), ensure_ascii=False, separators=(',', ':'))
# Prüfmaße ohne den Hinweistext (der nennt Dateien aus eingaben/)
pm = json.loads(rd('src/data/pruefmasse.json'))
pm.pop('hinweis', None)
pruefmasse = json.dumps(pm, ensure_ascii=False, separators=(',', ':'))
app = rd('src/app.js')
plan2d = rd('src/plan2d.js')
page = tpl.replace('/*HAUS*/', haus).replace('/*CLIPPING*/', clipping).replace('/*WERTE*/', werte).replace('/*RAEUME*/', raeume) \
           .replace('/*DACH*/', dach).replace('/*TREPPE*/', treppe).replace('/*WOHNFLAECHE*/', wohnflaeche).replace('/*PRUEFEN*/', pruefen).replace('/*GRUNDRISS*/', grundriss).replace('/*SCHNITT*/', schnitt).replace('/*AENDERN*/', aendern).replace('/*AUFMASS*/', aufmass).replace('/*PRUEFMASSE*/', pruefmasse).replace('/*PLAN2D*/', plan2d).replace('/*MODEL*/', model).replace('/*APP*/', app)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist/haus-und-grundstueck-3d.html'), 'w', encoding='utf-8').write(page)
local = page.replace('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', '../node_modules/three/build/three.min.js') \
            .replace('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', '../node_modules/three/examples/js/controls/OrbitControls.js')
open(os.path.join(root, 'dist/test_page.html'), 'w', encoding='utf-8').write(
    '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">'
    '<style>[hidden]{display:none!important}html,body{margin:0}</style>' + local)
print('ok', len(page), 'Bytes')
# Grundrisse als SVG nach docs/plaene/ (im Git-Diff als Bild sichtbar)
import subprocess
subprocess.run(['node', os.path.join(root, 'tools/plan_svg.js')], check=True, cwd=root)
# Wohnfläche als Dokument nach docs/ (im Git-Diff sichtbar)
subprocess.run(['node', os.path.join(root, 'tools/wohnflaeche.js'), '--datei', os.path.join(root, 'docs/wohnflaeche.md')], check=True, cwd=root)
