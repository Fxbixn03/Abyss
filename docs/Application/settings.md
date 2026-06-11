# Settings

> Route: `/settings` · Position: **unten in der Sidebar angepinnt** · Komponente:
> [`SettingsPage.tsx`](../../src/features/settings/pages/SettingsPage.tsx)

**Zweck:** **App-eigene Einstellungen** von Abyss – nicht zu verwechseln mit der
Agenten-`settings.json`. Untertitel: „Paths, appearance and app preferences.“

## Agenten-Verfügbarkeit
Agnostisch – betrifft Abyss selbst und die Pfade/Optionen aller Agenten.

## Was die Seite zeigt / kann
- **Paths:** Config-Verzeichnisse der Agenten festlegen/überschreiben (viele
  „No config location set“-Leerzustände anderer Seiten verlinken hierher).
- **Appearance:** Theme/Erscheinungsbild.
- **Preferences:** sonstige App-Einstellungen.
- Verwaltung eigener (custom) Agenten.

## Datenquelle & Schreibziel
Liest/schreibt die Abyss-eigenen Einstellungen über `core/settings-store`
(persistiert via Zustand `persist`).

## Abgrenzung
- **Settings:** App-Einstellungen von Abyss.
- [Settings (raw)](./settings-file.md): rohe `settings.json` eines **Agenten**.

## Verwandte Seiten
[Settings (raw)](./settings-file.md) · [Discover](./discover.md) ·
[Dashboard](./dashboard.md)
