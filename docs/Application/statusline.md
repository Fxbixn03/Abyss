# Status Line

> Route: `/statusline` · Gruppe: **System** · Komponente:
> [`StatusLinePage.tsx`](../../src/features/statusline/pages/StatusLinePage.tsx)

**Zweck:** Builder für die **Status-Line** von Claude Code (die untere
Statuszeile im CLI).

## Agenten-Verfügbarkeit
**Nur Claude Code.** Andere Agenten: „{agent} has no status line – The status
line builder is specific to Claude Code. Switch to Claude to configure it.“ Ohne
Config-Ort: „No config location set“.

## Was die Seite zeigt / kann
- Zusammenstellen/Anpassen der Status-Line-Bausteine.
- Vorschau und Speichern in die Claude-Settings.

## Datenquelle & Schreibziel
Liest/schreibt die Status-Line-Konfiguration über `core/claude-settings`
(Snapshot vorher).

## Verwandte Seiten
[Spinner](./spinner.md) · [Model & Env](./model-env.md) ·
[Settings (raw)](./settings-file.md)
