"""Render icons and share images from the sources in this folder with headless Chrome.
Usage: python branding/render.py"""
import subprocess, pathlib, shutil, sys
here = pathlib.Path(__file__).resolve().parent
root = here.parent
CHROME = next((p for p in [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"] if pathlib.Path(p).exists()), None)
if not CHROME: sys.exit("no chrome/edge found")

def shot(src, out, w, h, transparent=False):
    args = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--window-size={w},{h}", "--force-device-scale-factor=1",
            "--allow-file-access-from-files", f"--screenshot={out}", src.as_uri()]
    if transparent: args.insert(2, "--default-background-color=00000000")
    subprocess.run(args, check=True, capture_output=True)

tmp = here / "_t.html"
for n in (16, 32, 48, 128):
    tmp.write_text(f'<body style="margin:0;background:transparent"><img src="icon.svg" width="{n}" height="{n}" style="display:block">')
    shot(tmp, root / "extension" / "icons" / f"icon{n}.png", n, n, True)
tmp.write_text('<body style="margin:0;background:transparent"><img src="icon.svg" width="512" height="512" style="display:block">')
shot(tmp, here / "icon-512.png", 512, 512, True)
tmp.unlink()
for name, w, h in (("og", 1200, 630), ("store-tile", 880, 560), ("store-marquee", 1400, 560)):
    shot(here / f"{name}.html", here / f"{name}.png", w, h)
try:  # store tile is authored at 2x for crispness, shipped at 440x280
    from PIL import Image
    im = Image.open(here / "store-tile.png"); im.resize((440, 280), Image.LANCZOS).save(here / "store-tile.png")
except ImportError:
    print("Pillow missing: store-tile.png left at 880x560, resize it to 440x280")
print("ok")
