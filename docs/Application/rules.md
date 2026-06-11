# Rules

> Route: `/rules` · Gruppe: **Development** · Komponente:
> [`RulesPage.tsx`](../../src/features/collections/pages/RulesPage.tsx)
> → rendert `CollectionManager kind="rules"` (Icon `book-open`)

**Zweck:** Verwaltet die **Regel-Dateien** des aktiven Agenten als
Markdown-Collection (jede Datei = ein Regelsatz, z. B. projektspezifische
Vorgaben).

## Agenten-Verfügbarkeit
Für alle Agenten mit Regel-Collections (u. a. Cursor-/Windsurf-Rules,
Claude-Regeln). Nicht unterstützende Agenten zeigen einen Leerzustand.

## Was die Seite zeigt / kann
- Liste aller Regel-Dateien mit Editor zum Anlegen, Bearbeiten und Löschen.
- Einheitliche Collection-UI (geteilt mit Agents, Commands, Skills).

## Datenquelle & Schreibziel
Markdown-Regel-Dateien im Rules-Verzeichnis des Agenten über `core/`.

## Verwandte Seiten
[Instructions](./instructions.md) · [Agents](./agents.md) ·
[Templates](./templates.md)
