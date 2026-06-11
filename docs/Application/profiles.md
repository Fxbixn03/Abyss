# Profiles

> Route: `/profiles` · Gruppe: **Tools** · Komponente:
> [`ProfilesPage.tsx`](../../src/features/profiles/pages/ProfilesPage.tsx)

**Zweck:** **Benannte Umgebungen** – das aktuelle Setup erfassen und zwischen
Setups umschalten. Untertitel: „Named environments — capture your setup and
switch between them.“

## Agenten-Verfügbarkeit
Agnostisch – ein Profil kann den Zustand mehrerer Agenten festhalten.

## Was die Seite zeigt / kann
- Aktuelle Agenten-Config als benanntes Profil **erfassen**.
- Gespeichertes Profil jederzeit **anwenden** (z. B. Setup wechseln).
- Ohne Profile: „No profiles yet – Capture your current agent config as a named
  environment, then apply it any time (e.g. on another machine or to switch
  setups).“

## Datenquelle & Schreibziel
Profile werden als App-Daten gespeichert; das Anwenden schreibt die echten
Config-Dateien (Snapshot vorher), analog zu [Bundles](./bundles.md).

## Abgrenzung
- **Profiles:** benannte Sets zum schnellen Umschalten auf **dieser** Maschine.
- [Bundles](./bundles.md): portables Export-/Import-Paket für **andere** Maschinen.

## Verwandte Seiten
[Bundles](./bundles.md) · [Compare](./compare.md) · [History](./history.md)
