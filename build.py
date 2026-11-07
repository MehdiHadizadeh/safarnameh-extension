#!/usr/bin/env python3
"""Inline every asset into one file.
  dist/index.html   — standalone page, deploy anywhere or open locally
  dist/artifact.html — same page without the html/head/body wrapper
"""
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
css  = (root / "assets/style.css").read_text(encoding="utf-8")
import base64
def _font(m):
    b = (root / "assets" / m.group(1)).read_bytes()
    return 'url("data:font/woff2;base64,' + base64.b64encode(b).decode() + '")'
css = re.sub(r'url\("(fonts/[^"]+)"\)', _font, css)
html = html.replace('<link rel="stylesheet" href="assets/style.css">',
                    "<style>\n" + css + "\n</style>")
for name in ["analyze", "report", "collector", "demo", "site"]:
    js = (root / f"assets/{name}.js").read_text(encoding="utf-8")
    html = html.replace(f'<script src="assets/{name}.js"></script>',
                        "<script>\n" + js + "\n</script>")
import hashlib
hashes = " ".join("'sha256-" + base64.b64encode(hashlib.sha256(m.encode("utf-8")).digest()).decode() + "'"
                  for m in re.findall(r"<script>(.*?)</script>", html, re.S))
html = html.replace("script-src 'self' file:", "script-src " + hashes, 1)
assert "assets/" not in html.split("<body>")[1], "an asset was left unlinked"
(root / "dist").mkdir(exist_ok=True)
(root / "dist/index.html").write_text(html, encoding="utf-8")

body = html.split("<body>", 1)[1].rsplit("</body>", 1)[0]
head = html.split("<head>", 1)[1].split("</head>", 1)[0]
keep = "\n".join(l for l in head.splitlines()
                 if ("<title>" in l or "fonts.googleapis" in l or "<style>" in l)) 
style = "<style>" + html.split("<style>", 1)[1].split("</style>", 1)[0] + "</style>"
title = re.search(r"<title>.*?</title>", head, re.S).group(0)
fonts = "\n".join(l for l in head.splitlines() if "fonts.googleapis" in l)
(root / "dist/artifact.html").write_text(
    fonts + "\n" + title + "\n" + style + "\n" + body, encoding="utf-8")
print("dist/index.html", len((root/'dist/index.html').read_bytes())//1024, "KB")
print("dist/artifact.html", len((root/'dist/artifact.html').read_bytes())//1024, "KB")

# ── browser extension: same analysis + report, no console step ──────────
import shutil, zipfile, json
ext_src = root / "extension"
ext_out = root / "dist" / "extension"
# generate the shared files INTO extension/ so that folder loads as-is
# ("Load unpacked" on extension/ works); dist/extension is a copy of it.
(ext_src / "assets").mkdir(exist_ok=True)
for f in ["analyze.js", "report.js", "style.css"]:  # generated; git-ignored
    shutil.copy(root / "assets" / f, ext_src / "assets" / f)
if (ext_src / "assets" / "fonts").exists():
    shutil.rmtree(ext_src / "assets" / "fonts")
shutil.copytree(root / "assets" / "fonts", ext_src / "assets" / "fonts")
src = (root / "index.html").read_text(encoding="utf-8")
a = src.index('<div id="report" hidden>')
b = src.index('\n\n  <div class="sitefoot">')
report_block = src[a:b]
sw = re.search(r'<button class="theme-sw".*?</button>', src, re.S).group(0)
page = f'''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>سفرنامه — گزارش</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
{sw}
<div class="wrap">
  <p id="boot-msg" class="note" hidden></p>
  {report_block}
</div>
<div id="tip" role="status" aria-live="polite"></div>
<script src="assets/analyze.js"></script>
<script src="assets/report.js"></script>
<script src="report-boot.js"></script>
</body>
</html>
'''
(ext_src / "report.html").write_text(page, encoding="utf-8")
if ext_out.exists():
    shutil.rmtree(ext_out)
shutil.copytree(ext_src, ext_out)
ver = json.loads((ext_src / "manifest.json").read_text(encoding="utf-8"))["version"]
zpath = root / "dist" / f"safarnameh-extension-v{ver}.zip"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(ext_out.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(ext_out).as_posix())
print("extension", zpath.name, zpath.stat().st_size // 1024, "KB")
