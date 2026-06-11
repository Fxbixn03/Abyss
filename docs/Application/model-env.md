# Model & Env

> Route: `/model-env` · Gruppe: **System** · Komponente:
> [`ModelEnvPage.tsx`](../../src/features/model-env/pages/ModelEnvPage.tsx)

**Zweck:** Einstellung von **Modell** und **Umgebungsvariablen** des aktiven
Agenten.

## Agenten-Verfügbarkeit
Agenten mit Modell-/Env-Einstellungen – primär **Claude Code** (Adapter-Sektion
„Model & Env“). Sonst: „{agent} has no model settings – Switch to an agent that
supports model and environment configuration.“ Ohne Config-Ort: „No config
location set“.

## Was die Seite zeigt / kann
- **Model**-Auswahl (welches Modell der Agent nutzt).
- **Environment**-Variablen pflegen.
- **Save**-Button (nur aktiv, wenn ungespeicherte Änderungen vorliegen).

## Datenquelle & Schreibziel
Liest/schreibt Modell und Env über `core/claude-settings` (Snapshot vorher).

## Verwandte Seiten
[Permissions](./permissions.md) · [Settings (raw)](./settings-file.md) ·
[Status Line](./statusline.md)
