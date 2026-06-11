# Instructions

> Route: `/config` · Gruppe: **Development** · Sidebar-Label: „Instructions“ ·
> Komponente: [`ConfigPage.tsx`](../../src/features/config/pages/ConfigPage.tsx)

**Zweck:** Editor für die **Instruktions-/Config-Dateien** des aktiven Agenten –
z. B. `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`. Untertitel: „Configuration files for
{agent}“.

## Agenten-Verfügbarkeit
Für alle Agenten mit Instruktionsdateien. Ist kein Config-Ort gesetzt, zeigt die
Seite: „No config location set – Abyss could not find a config directory … Set
one in Settings to start editing.“

## Was die Seite zeigt / kann
- CodeMirror-Editor (Markdown) für die Instruktionsdateien des Agenten.
- Auswahl zwischen mehreren Zieldateien, falls der Agent welche definiert.
- Speichern schreibt direkt in die echte Datei (vorher Snapshot, siehe History).

## Datenquelle & Schreibziel
Liest/schreibt über `core/config-io`. Die konkreten Dateipfade kommen aus der
`AgentDefinition` (`configFiles`, `resolvePaths`) in `src/shared/agents/defs.ts`.

## Verwandte Seiten
[Context](./context.md) (kompilierte Sicht) · [Templates](./templates.md)
(Bausteine einfügen) · [History](./history.md) · [Validation](./validation.md)
