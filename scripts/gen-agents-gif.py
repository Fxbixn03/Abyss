#!/usr/bin/env python3
"""Generate an agent-cycling demo GIF.

Renders a mock Abyss UI panel for each active agent and shows it twice in a
row — once in dark mode, once in light mode — so the loop walks through every
agent in both appearances. Uses the real default-theme palettes, display names
and capabilities (see src/shared/agents/defs.ts and
src/features/themes/presets/*). Reproducible: re-run to regenerate.
"""
import math
import os
import subprocess
import tempfile

W, H = 760, 430
DELAY = 95  # ~0.95s hold per frame
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "abyss-agents.gif")

STATUS = {"success": "#30a46c", "warning": "#f5a524", "danger": "#e5484d"}

# Border-radius token -> px (matches BorderRadius in src/shared/types/theme.ts).
RADIUS = {"none": 0, "sm": 4, "md": 8, "lg": 12}

# Capability key -> chip label (subset shown in the demo panel).
CAP_LABELS = [
    ("instructions", "Instructions"),
    ("mcp", "MCP"),
    ("permissions", "Permissions"),
    ("agents", "Subagents"),
    ("commands", "Commands"),
    ("skills", "Skills"),
    ("hooks", "Hooks"),
    ("rules", "Rules"),
    ("chats", "Chats"),
]

# Each active agent: display name, default theme label, radius/font tokens, the
# real light + dark palettes, and which capabilities are enabled.
AGENTS = [
    dict(
        name="Claude Code", theme="Claude — Dusk", r="md", mono=False,
        caps={"instructions", "mcp", "permissions", "agents", "commands",
              "skills", "hooks", "chats"},
        dark=dict(primary="#D4956A", pf="#1A1410", bg="#0F0D0B", surface="#1A1715",
                  border="#2E2926", text="#E8E0D8", muted="#8A7E74",
                  sidebar="#12100E", active="#2A2320"),
        light=dict(primary="#B5703B", pf="#FFFFFF", bg="#FAF7F2", surface="#FFFFFF",
                   border="#E7DFD4", text="#2A2018", muted="#8A7E74",
                   sidebar="#F3ECE2", active="#E9DFD1"),
    ),
    dict(
        name="OpenAI Codex", theme="Codex — Terminal", r="sm", mono=True,
        caps={"instructions", "mcp", "commands", "skills", "chats"},
        dark=dict(primary="#10A37F", pf="#FFFFFF", bg="#0D0D0D", surface="#171717",
                  border="#2D2D2D", text="#ECECEC", muted="#6B6B6B",
                  sidebar="#0A0A0A", active="#1F1F1F"),
        light=dict(primary="#0E8C6D", pf="#FFFFFF", bg="#FFFFFF", surface="#F7F7F7",
                   border="#E2E2E2", text="#1A1A1A", muted="#6B6B6B",
                   sidebar="#F0F0F0", active="#E6E6E6"),
    ),
    dict(
        name="Gemini CLI", theme="Gemini — Cosmos", r="lg", mono=False,
        caps={"instructions", "mcp", "agents", "commands", "skills", "hooks"},
        dark=dict(primary="#4285F4", pf="#FFFFFF", bg="#0C0E14", surface="#141720",
                  border="#22263A", text="#E3E8F4", muted="#6B7494",
                  sidebar="#090B10", active="#1C2035"),
        light=dict(primary="#2D6FE0", pf="#FFFFFF", bg="#FAFBFF", surface="#FFFFFF",
                   border="#DDE3F0", text="#1A2030", muted="#5B6480",
                   sidebar="#EEF2FC", active="#E1E8F8"),
    ),
    dict(
        name="Cursor", theme="Cursor — Graphite", r="md", mono=False,
        caps={"instructions", "mcp", "agents", "commands", "skills", "hooks",
              "rules"},
        dark=dict(primary="#6C8EEF", pf="#FFFFFF", bg="#0E0F12", surface="#17191F",
                  border="#2A2D36", text="#E6E8EE", muted="#7A7F8C",
                  sidebar="#0A0B0E", active="#20242E"),
        light=dict(primary="#3B5BDB", pf="#FFFFFF", bg="#FFFFFF", surface="#F6F7F9",
                   border="#E1E4EA", text="#1A1C22", muted="#6B7280",
                   sidebar="#EEF0F3", active="#E2E6EC"),
    ),
    dict(
        name="GitHub Copilot CLI", theme="Copilot — Mono", r="md", mono=False,
        caps={"instructions", "mcp"},
        dark=dict(primary="#6E7681", pf="#FFFFFF", bg="#0D1117", surface="#161B22",
                  border="#30363D", text="#E6EDF3", muted="#7D8590",
                  sidebar="#010409", active="#21262D"),
        light=dict(primary="#57606A", pf="#FFFFFF", bg="#FFFFFF", surface="#F6F8FA",
                   border="#D0D7DE", text="#1F2328", muted="#656D76",
                   sidebar="#F6F8FA", active="#EAEEF2"),
    ),
    dict(
        name="Windsurf", theme="Windsurf — Wave", r="md", mono=False,
        caps={"instructions", "mcp"},
        dark=dict(primary="#13C2C2", pf="#04201F", bg="#0A1414", surface="#10201F",
                  border="#1F3A38", text="#E2F2F1", muted="#6E908D",
                  sidebar="#06100F", active="#143230"),
        light=dict(primary="#0E8F8F", pf="#FFFFFF", bg="#FFFFFF", surface="#F2FAFA",
                   border="#D2E8E7", text="#0E2422", muted="#5C7D7A",
                   sidebar="#ECF7F6", active="#D9F0EF"),
    ),
    dict(
        name="Continue", theme="Continue — Loop", r="md", mono=False,
        caps={"instructions"},
        dark=dict(primary="#E6E6E6", pf="#121212", bg="#0D0D0D", surface="#181818",
                  border="#2C2C2C", text="#EDEDED", muted="#8A8A8A",
                  sidebar="#070707", active="#222222"),
        light=dict(primary="#1A1A1A", pf="#FFFFFF", bg="#FFFFFF", surface="#F7F7F7",
                   border="#E2E2E2", text="#1A1A1A", muted="#6A6A6A",
                   sidebar="#F2F2F2", active="#E6E6E6"),
    ),
    dict(
        name="Aider", theme="Aider — Slate", r="sm", mono=True,
        caps={"instructions"},
        dark=dict(primary="#7FB069", pf="#0C1408", bg="#101311", surface="#1A1F1B",
                  border="#2C342D", text="#E4EAE2", muted="#7E8A7C",
                  sidebar="#0B0E0C", active="#222B23"),
        light=dict(primary="#4F7942", pf="#FFFFFF", bg="#FFFFFF", surface="#F5F7F4",
                   border="#DDE3DA", text="#1A201A", muted="#647062",
                   sidebar="#EFF2ED", active="#E1E8DD"),
    ),
    dict(
        name="Cline", theme="Cline — Night", r="md", mono=False,
        caps={"instructions"},
        dark=dict(primary="#A78BFA", pf="#1A0F2E", bg="#0E0D14", surface="#17151F",
                  border="#2A2738", text="#E8E6F0", muted="#827E96",
                  sidebar="#09080F", active="#211D33"),
        light=dict(primary="#7C3AED", pf="#FFFFFF", bg="#FFFFFF", surface="#F8F7FC",
                   border="#E5E1F0", text="#1B1826", muted="#6B6680",
                   sidebar="#F1EFF9", active="#E6E0F5"),
    ),
]

NAV = ["Dashboard", "Agents", "Instructions", "MCP", "Hooks", "Themes"]


def chips(agent: dict, p: dict, r: int) -> str:
    """Lay out the enabled-capability chips, wrapping within the panel."""
    labels = [lbl for key, lbl in CAP_LABELS if key in agent["caps"]]
    # Monospace glyphs are wider, so size the pills per font.
    cw = 8.4 if agent["mono"] else 7.2
    out, x, y = "", 205, 244
    for lbl in labels:
        w = round(len(lbl) * cw) + 30
        if x + w > W - 26:
            x, y = 205, y + 34
        out += (
            f'<rect x="{x}" y="{y - 16}" width="{w}" height="26" rx="{min(r, 8)}" '
            f'fill="{p["surface"]}" stroke="{p["border"]}"/>'
            f'<circle cx="{x + 13}" cy="{y - 3}" r="3" fill="{p["primary"]}"/>'
            f'<text x="{x + 22}" y="{y + 1}" font-size="11.5" fill="{p["text"]}">{lbl}</text>'
        )
        x += w + 10
    return out


def render(agent: dict, mode: str) -> str:
    p = agent[mode]
    r = RADIUS[agent["r"]]
    font = "monospace" if agent["mono"] else "Inter, 'Segoe UI', sans-serif"
    initial = agent["name"][0]

    nav_svg = ""
    for i, label in enumerate(NAV):
        y = 92 + i * 36
        active = i == 1  # highlight "Agents"
        if active:
            nav_svg += (
                f'<rect x="22" y="{y - 18}" width="150" height="28" rx="{r}" '
                f'fill="{p["active"]}"/>'
            )
        color = p["text"] if active else p["muted"]
        weight = "600" if active else "400"
        nav_svg += (
            f'<text x="34" y="{y}" font-size="13" font-weight="{weight}" '
            f'fill="{color}">{label}</text>'
        )

    swatches = ""
    for i, key in enumerate(["primary", "surface", "sidebar", "active", "border", "muted"]):
        swatches += (
            f'<rect x="{565 + i * 30}" y="{H - 44}" width="22" height="22" '
            f'rx="{min(r, 6)}" fill="{p[key]}" stroke="{p["border"]}"/>'
        )

    status = ""
    for i, (k, c) in enumerate(STATUS.items()):
        x = 205 + i * 92
        status += (
            f'<circle cx="{x + 6}" cy="{H - 33}" r="6" fill="{c}"/>'
            f'<text x="{x + 20}" y="{H - 29}" font-size="12" fill="{p["muted"]}">{k.title()}</text>'
        )

    # Appearance badge (top-right): sun for light, moon for dark.
    is_dark = mode == "dark"
    badge_label = "DARK" if is_dark else "LIGHT"
    badge_w = 96
    bx = W - 30 - badge_w
    if is_dark:
        glyph = (
            f'<circle cx="{bx + 18}" cy="44" r="6.5" fill="none" stroke="{p["primary"]}" stroke-width="2"/>'
            f'<circle cx="{bx + 21}" cy="41" r="5.5" fill="{p["surface"]}"/>'
        )
    else:
        cx, cy = bx + 18, 44
        glyph = f'<circle cx="{cx}" cy="{cy}" r="4.5" fill="{p["primary"]}"/>' + "".join(
            f'<line x1="{cx + 8 * math.cos(a):.1f}" y1="{cy + 8 * math.sin(a):.1f}" '
            f'x2="{cx + 6 * math.cos(a):.1f}" y2="{cy + 6 * math.sin(a):.1f}" '
            f'stroke="{p["primary"]}" stroke-width="1.6" stroke-linecap="round"/>'
            for a in [i * math.pi / 4 for i in range(8)]
        )

    return f"""<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="{font}">
  <rect x="1" y="1" width="{W-2}" height="{H-2}" rx="16" fill="{p['bg']}" stroke="{p['border']}" stroke-width="2"/>
  <!-- sidebar -->
  <rect x="14" y="14" width="180" height="{H-28}" rx="{r}" fill="{p['sidebar']}"/>
  <circle cx="36" cy="40" r="10" fill="{p['primary']}"/>
  <text x="54" y="45" font-size="15" font-weight="700" fill="{p['text']}">Abyss</text>
  {nav_svg}
  <!-- main header -->
  <text x="205" y="34" font-size="11" letter-spacing="1.5" fill="{p['muted']}">ACTIVE AGENT</text>
  <rect x="{bx}" y="28" width="{badge_w}" height="32" rx="{r}" fill="{p['surface']}" stroke="{p['border']}"/>
  {glyph}
  <text x="{bx + 34}" y="48" font-size="12" font-weight="600" letter-spacing="1" fill="{p['text']}">{badge_label}</text>
  <!-- agent identity -->
  <circle cx="221" cy="84" r="17" fill="{p['primary']}"/>
  <text x="221" y="90" font-size="17" font-weight="700" fill="{p['pf']}" text-anchor="middle">{initial}</text>
  <text x="248" y="80" font-size="22" font-weight="700" fill="{p['text']}">{agent['name']}</text>
  <text x="249" y="100" font-size="12.5" fill="{p['muted']}">Default theme · {agent['theme']}</text>
  <!-- actions -->
  <rect x="205" y="132" width="116" height="36" rx="{r}" fill="{p['primary']}"/>
  <text x="263" y="155" font-size="13" font-weight="700" fill="{p['pf']}" text-anchor="middle">Save</text>
  <rect x="333" y="132" width="128" height="36" rx="{r}" fill="{p['surface']}" stroke="{p['border']}"/>
  <text x="397" y="155" font-size="13" fill="{p['text']}" text-anchor="middle">Preview diff</text>
  <!-- capabilities -->
  <text x="205" y="208" font-size="11" letter-spacing="1.5" fill="{p['muted']}">CAPABILITIES</text>
  {chips(agent, p, r)}
  <!-- footer: status + palette -->
  {status}
  <text x="565" y="{H - 50}" font-size="10" letter-spacing="1" fill="{p['muted']}">PALETTE</text>
  {swatches}
</svg>"""


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        pngs = []
        idx = 0
        for agent in AGENTS:
            for mode in ("dark", "light"):
                svg_path = os.path.join(tmp, f"f{idx}.svg")
                png_path = os.path.join(tmp, f"f{idx}.png")
                with open(svg_path, "w") as fh:
                    fh.write(render(agent, mode))
                subprocess.run(
                    ["rsvg-convert", "-w", str(W), "-h", str(H), svg_path, "-o", png_path],
                    check=True,
                )
                pngs.append(png_path)
                idx += 1
        subprocess.run(
            ["convert", "-delay", str(DELAY), "-loop", "0", *pngs,
             "-colors", "220", "-layers", "optimize", OUT],
            check=True,
        )
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
