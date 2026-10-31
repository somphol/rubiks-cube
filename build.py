#!/usr/bin/env python3
"""Build the single-file CubeLab app.

The generated index.html is completely self-contained apart from the
Three.js scripts loaded from jsDelivr. Edit files in src/ and re-run:

    python3 build.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

TEMPLATE = (SRC / "index.template.html").read_text(encoding="utf-8")
STYLES = (SRC / "styles.css").read_text(encoding="utf-8")
APP = (SRC / "app.js").read_text(encoding="utf-8")
CUBE = (SRC / "vendor" / "cube.min.js").read_text(encoding="utf-8")
SOLVE = (SRC / "vendor" / "solve.js").read_text(encoding="utf-8")

VENDOR_HEADER = """
/* ------------------------------------------------------------------
   cube.js — MIT License
   Copyright (c) 2013-2017 Petri Lehtinen <petri@digip.org>
   Copyright (c) 2018 Ludovic Fernandez

   Permission is hereby granted, free of charge, to any person obtaining a
   copy of this software and associated documentation files (the "Software"),
   to deal in the Software without restriction, including without limitation
   the rights to use, copy, modify, merge, publish, distribute, sublicense,
   and/or sell copies of the Software, and to permit persons to whom the
   Software is furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   THE SOFTWARE.

   Source: https://github.com/ldez/cubejs (v1.3.2)
   ------------------------------------------------------------------ */
"""

vendor = VENDOR_HEADER + "\n" + CUBE + "\n\n" + SOLVE

html = TEMPLATE.replace("/*__STYLES__*/", STYLES)
html = html.replace("/*__VENDOR__*/", vendor)
html = html.replace("/*__APP__*/", APP)

(ROOT / "index.html").write_text(html, encoding="utf-8")

print(f"Built {ROOT / 'index.html'} ({len(html):,} bytes)")
