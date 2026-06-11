# Settings (raw)

> Route: `/settings-file` · Gruppe: **System** · Sidebar-Label: „Settings (raw)“
> · Komponente:
> [`SettingsFilePage.tsx`](../../src/features/settings-file/pages/SettingsFilePage.tsx)

**Zweck:** **Roh-Editor** für die `settings.json` des aktiven Agenten – für
Feineinstellungen, die keine eigene UI haben. Icon `braces`.

## Agenten-Verfügbarkeit
Agenten mit `settings.json` (Adapter-Sektion „Settings (raw)“): u. a. **Claude,
Gemini, Copilot**. Sonst: „{agent} has no raw settings – Switch to an agent that
exposes settings.json.“ Ohne Config-Ort: „No config location set“.

## Was die Seite zeigt / kann
- Direkter JSON-Editor (CodeMirror) auf die echte Settings-Datei.
- Voller Zugriff – auch auf Felder ohne dedizierte Oberfläche.

## Datenquelle & Schreibziel
Liest/schreibt die rohe `settings.json` des Agenten über `core/` (Snapshot
vorher). ⚠️ Direkte JSON-Bearbeitung – ungültiges JSON kann den Agenten stören.

## Verwandte Seiten
[Model & Env](./model-env.md) · [Permissions](./permissions.md) ·
[Settings](./settings.md) (App-Einstellungen, nicht Agent)
