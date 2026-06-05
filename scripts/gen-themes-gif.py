#!/usr/bin/env python3
"""Generate a theme-cycling demo GIF.

Renders a mock Abyss UI panel in each built-in theme (real preset colors) and
assembles a looping slideshow. Reproducible: re-run to regenerate.
"""
import os
import subprocess
import tempfile

W, H = 760, 430
DELAY = 110  # ~1.1s hold per theme
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "abyss-themes.gif")

STATUS = {"success": "#30a46c", "warning": "#f5a524", "danger": "#e5484d"}

# Real preset palettes (see src/features/themes/presets/*).
THEMES = [
    dict(label="Claude — Dusk", r=8, mono=False, primary="#D4956A", pf="#1A1410",
         bg="#0F0D0B", surface="#1A1715", border="#2E2926", text="#E8E0D8",
         muted="#8A7E74", sidebar="#12100E", active="#2A2320"),
    dict(label="Codex — Terminal", r=4, mono=True, primary="#10A37F", pf="#FFFFFF",
         bg="#0D0D0D", surface="#171717", border="#2D2D2D", text="#ECECEC",
         muted="#6B6B6B", sidebar="#0A0A0A", active="#1F1F1F"),
    dict(label="Gemini — Cosmos", r=12, mono=False, primary="#4285F4", pf="#FFFFFF",
         bg="#0C0E14", surface="#141720", border="#22263A", text="#E3E8F4",
         muted="#6B7494", sidebar="#090B10", active="#1C2035"),
    dict(label="Abyss — Slate", r=8, mono=False, primary="#818CF8", pf="#0B0B12",
         bg="#0B0D12", surface="#14171F", border="#232838", text="#E6E9F2",
         muted="#7A839C", sidebar="#090A0F", active="#1B2030"),
    dict(label="Abyss — Mono", r=0, mono=True, primary="#E0B341", pf="#1A1505",
         bg="#0B0B0C", surface="#151517", border="#26262A", text="#E6E6E8",
         muted="#7A7A82", sidebar="#08080A", active="#1C1C20"),
    dict(label="Claude — Dusk · Light", r=8, mono=False, primary="#B5703B", pf="#FFFFFF",
         bg="#FAF7F2", surface="#FFFFFF", border="#E7DFD4", text="#2A2018",
         muted="#8A7E74", sidebar="#F3ECE2", active="#E9DFD1"),
    dict(label="Abyss — Slate · Light", r=8, mono=False, primary="#5B63D3", pf="#FFFFFF",
         bg="#F8F9FC", surface="#FFFFFF", border="#E4E7F0", text="#1A1D29",
         muted="#5A6175", sidebar="#EEF0F8", active="#E2E6F4"),
]


def render(t: dict) -> str:
    r = t["r"]
    font = "monospace" if t["mono"] else "Inter, 'Segoe UI', sans-serif"
    nav = ["Dashboard", "Agents", "MCP", "Hooks"]
    nav_svg = ""
    for i, label in enumerate(nav):
        y = 78 + i * 34
        active = (
            f'<rect x="22" y="{y - 18}" width="118" height="28" rx="{r}" fill="{t["active"]}"/>'
            if i == 0
            else ""
        )
        color = t["text"] if i == 0 else t["muted"]
        nav_svg += f'{active}<text x="34" y="{y}" font-size="13" fill="{color}">{label}</text>'

    swatches = ""
    for i, key in enumerate(["primary", "surface", "sidebar", "active", "border", "muted"]):
        swatches += f'<rect x="{205 + i * 34}" y="312" width="26" height="26" rx="{min(r,6)}" fill="{t[key]}" stroke="{t["border"]}"/>'

    status = ""
    for i, (k, c) in enumerate(STATUS.items()):
        x = 205 + i * 92
        status += (
            f'<circle cx="{x + 6}" cy="262" r="6" fill="{c}"/>'
            f'<text x="{x + 20}" y="266" font-size="12" fill="{t["muted"]}">{k.title()}</text>'
        )

    return f"""<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="{font}">
  <rect x="1" y="1" width="{W-2}" height="{H-2}" rx="16" fill="{t['bg']}" stroke="{t['border']}" stroke-width="2"/>
  <!-- sidebar -->
  <rect x="14" y="14" width="150" height="{H-28}" rx="{r}" fill="{t['sidebar']}"/>
  <circle cx="32" cy="36" r="9" fill="{t['primary']}"/>
  <text x="48" y="41" font-size="15" font-weight="700" fill="{t['text']}">Abyss</text>
  {nav_svg}
  <!-- main -->
  <text x="186" y="40" font-size="13" fill="{t['muted']}">Theme</text>
  <text x="230" y="40" font-size="14" font-weight="700" fill="{t['text']}">{t['label']}</text>
  <rect x="186" y="56" width="{W-200}" height="320" rx="{r}" fill="{t['surface']}" stroke="{t['border']}" stroke-width="1.5"/>
  <text x="205" y="100" font-size="19" font-weight="700" fill="{t['text']}">Configure Claude Code</text>
  <text x="205" y="126" font-size="13" fill="{t['muted']}">Instructions · Agents · MCP · Hooks · Skills</text>
  <rect x="205" y="150" width="116" height="36" rx="{r}" fill="{t['primary']}"/>
  <text x="263" y="173" font-size="13" font-weight="700" fill="{t['pf']}" text-anchor="middle">Save</text>
  <rect x="333" y="150" width="124" height="36" rx="{r}" fill="{t['surface']}" stroke="{t['border']}"/>
  <text x="395" y="173" font-size="13" fill="{t['text']}" text-anchor="middle">Preview diff</text>
  <text x="205" y="228" font-size="12" fill="{t['muted']}">STATUS</text>
  {status}
  <text x="205" y="304" font-size="12" fill="{t['muted']}">PALETTE</text>
  {swatches}
</svg>"""


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        pngs = []
        for i, t in enumerate(THEMES):
            svg_path = os.path.join(tmp, f"t{i}.svg")
            png_path = os.path.join(tmp, f"t{i}.png")
            with open(svg_path, "w") as fh:
                fh.write(render(t))
            subprocess.run(
                ["rsvg-convert", "-w", str(W), "-h", str(H), svg_path, "-o", png_path],
                check=True,
            )
            pngs.append(png_path)
        subprocess.run(
            ["convert", "-delay", str(DELAY), "-loop", "0", *pngs,
             "-colors", "200", "-layers", "optimize", OUT],
            check=True,
        )
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
