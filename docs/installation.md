# Installation

Abyss runs on **Linux** and **Windows**. Grab a prebuilt release, or build it
yourself from source.

## Linux (AppImage, recommended)

Download `Abyss-<version>-x86_64.AppImage` from
[Releases](https://github.com/Fxbixn03/Abyss/releases) (published by CI on
tagged builds), then:

```bash
chmod +x Abyss-*-x86_64.AppImage
./Abyss-*-x86_64.AppImage
```

If you hit a FUSE error, run it extracted:

```bash
./Abyss-*-x86_64.AppImage --appimage-extract-and-run
```

### Add it to your application menu (KDE/GNOME)

```bash
mkdir -p ~/Applications ~/.local/share/applications
cp Abyss-*-x86_64.AppImage ~/Applications/Abyss.AppImage
chmod +x ~/Applications/Abyss.AppImage

cat > ~/.local/share/applications/abyss.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Abyss
Comment=Unified configuration UI for AI coding agents
Exec=$HOME/Applications/Abyss.AppImage %U
Icon=abyss
Terminal=false
Categories=Development;
StartupWMClass=Abyss
EOF

update-desktop-database ~/.local/share/applications 2>/dev/null || true
```

## Windows

Download the NSIS installer (`Abyss-<version>-x64.exe`) or the portable build
from [Releases](https://github.com/Fxbixn03/Abyss/releases) and run it.

## Build from source

Requires **Node 20+** and **pnpm**.

```bash
git clone https://github.com/Fxbixn03/Abyss.git
cd Abyss
pnpm install

pnpm dev          # run in development (Vite + Electron, hot reload)
pnpm build        # type-check, bundle, and package an installer/AppImage
```

The packaged artifact lands in `release/<version>/`.

## First run

On first launch Abyss auto-detects each agent's config directory and shows a
quick setup so you can confirm or override the locations. Paths that exist get a
green check, missing ones a warning, and you can always point to your own with
the folder browser. Your choices are saved; change them any time under
**Settings → Config Paths**.
