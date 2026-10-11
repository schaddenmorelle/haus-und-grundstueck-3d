#!/usr/bin/env python3
"""Baut die veröffentlichbare Seite (CDN-Three.js) und eine lokale Testseite.

  dist/haus-und-grundstueck-3d.html   -> wird als Artifact veröffentlicht
  dist/test_page.html                 -> lokal (node_modules/three), für Screenshots/Tests
"""
import json, os, re
root = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
tpl = rd('src/tpl.html')
strip_exports = lambda t: re.sub(r"^if [(]typeof module !== 'undefined'[)].*$", "", t, flags=re.M)  # Node-Export entfällt in der Seite
model = strip_exports(rd('src/model.js')).replace("if (typeof require !== 'undefined') var werteAufloesen = require('./werte.js').werteAufloesen;", "")
werte = strip_exports(rd('src/werte.js'))
haus = json.dumps(json.loads(rd('src/data/haus.json')), ensure_ascii=False, separators=(',', ':'))
app = rd('src/app.js')
page = tpl.replace('/*HAUS*/', haus).replace('/*WERTE*/', werte).replace('/*MODEL*/', model).replace('/*APP*/', app)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist/haus-und-grundstueck-3d.html'), 'w', encoding='utf-8').write(page)
local = page.replace('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', '../node_modules/three/build/three.min.js') \
            .replace('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', '../node_modules/three/examples/js/controls/OrbitControls.js')
open(os.path.join(root, 'dist/test_page.html'), 'w', encoding='utf-8').write(
    '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">'
    '<style>[hidden]{display:none!important}html,body{margin:0}</style>' + local)
print('ok', len(page), 'Bytes')
