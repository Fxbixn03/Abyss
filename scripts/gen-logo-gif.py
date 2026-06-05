#!/usr/bin/env python3
"""Generate the animated Abyss logo GIF (rings rippling into the void).

Procedurally renders SVG frames, rasterizes them with rsvg-convert and
assembles a looping GIF with ImageMagick. Reproducible: re-run to regenerate.
"""
import math
import os
import subprocess
import tempfile

SIZE = 260
FRAMES = 30
DELAY = 4  # 1/100s units -> ~25 fps
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "abyss-logo.gif")


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def hexlerp(c1: str, c2: str, t: float) -> str:
    a = [int(c1[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i : i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(lerp(a[i], b[i], t)):02x}" for i in range(3))


DEFS = """
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#171B27"/>
      <stop offset="1" stop-color="#0B0D12"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.44" r="0.62">
      <stop offset="0" stop-color="#818CF8" stop-opacity="0.20"/>
      <stop offset="0.55" stop-color="#818CF8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="void" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#05060A"/>
      <stop offset="1" stop-color="#0A0C12"/>
    </radialGradient>
  </defs>"""


def frame_svg(t: float) -> str:
    rings = ""
    k = 4
    for i in range(k):
        p = ((i / k) + t) % 1.0
        r = lerp(300, 72, p)
        op = (math.sin(math.pi * p) ** 0.7) * 0.85
        sw = lerp(28, 16, p)
        cy = 512 + lerp(-16, 22, p)
        col = hexlerp("#818CF8", "#A8AEFF", p)
        rings += (
            f'<circle cx="512" cy="{cy:.1f}" r="{r:.1f}" fill="none" '
            f'stroke="{col}" stroke-opacity="{op:.3f}" stroke-width="{sw:.1f}"/>'
        )
    # Flat background (gradients dither badly in a 256-color GIF).
    return f"""<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  {DEFS}
  <rect x="64" y="64" width="896" height="896" rx="208" fill="#0E1119"/>
  <rect x="65" y="65" width="894" height="894" rx="207" fill="none" stroke="#2B3454" stroke-width="2"/>
  <g>{rings}</g>
  <circle cx="512" cy="534" r="58" fill="#070910"/>
</svg>"""


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        pngs = []
        for f in range(FRAMES):
            t = f / FRAMES
            svg_path = os.path.join(tmp, f"f{f:03d}.svg")
            png_path = os.path.join(tmp, f"f{f:03d}.png")
            with open(svg_path, "w") as fh:
                fh.write(frame_svg(t))
            subprocess.run(
                ["rsvg-convert", "-w", str(SIZE), "-h", str(SIZE), svg_path, "-o", png_path],
                check=True,
            )
            pngs.append(png_path)
        subprocess.run(
            ["convert", "-delay", str(DELAY), "-loop", "0", *pngs,
             "-colors", "128", "-layers", "optimize", OUT],
            check=True,
        )
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
