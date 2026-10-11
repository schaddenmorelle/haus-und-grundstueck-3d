#!/usr/bin/env python3
"""Baut die veröffentlichbare Seite (CDN-Three.js) und eine lokale Testseite.

  dist/haus-und-grundstueck-3d.html   -> wird als Artifact veröffentlicht
  dist/test_page.html                 -> lokal (node_modules/three), für Screenshots/Tests
"""
import os
root = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
tpl = rd('src/tpl.html')
model = rd('src/model.js').replace("if (typeof module !== 'undefined') module.exports = { buildModel: buildModel };", "")
app = rd('src/app.js')
page = tpl.replace('/*MODEL*/', model).replace('/*APP*/', app)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist/haus-und-grundstueck-3d.html'), 'w', encoding='utf-8').write(page)
local = page.replace('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', '../node_modules/three/build/three.min.js') \
            .replace('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', '../node_modules/three/examples/js/controls/OrbitControls.js')
open(os.path.join(root, 'dist/test_page.html'), 'w', encoding='utf-8').write(
    '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">'
    '<style>[hidden]{display:none!important}html,body{margin:0}</style>' + local)
print('ok', len(page), 'Bytes')
