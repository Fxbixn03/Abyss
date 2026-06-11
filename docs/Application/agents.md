# Agents / Subagents

> Route: `/agents` · Gruppe: **Development** · Komponente:
> [`AgentsPage.tsx`](../../src/features/collections/pages/AgentsPage.tsx)
> → rendert `CollectionManager kind="agents"` (Icon `bot`)

**Zweck:** Verwaltet die **Subagent-Definitionen** des aktiven Agenten – als
Markdown-Collection (jede Datei = ein Subagent). Sidebar-Label je Agent: bei
Claude „Agents“, bei Cursor/Gemini „Subagents“.

## Agenten-Verfügbarkeit
- **Markdown-Collection** (diese Seite): Claude, Cursor, Gemini u. a.
- **Sonderfall Codex:** Codex-Subagenten sind TOML-Dateien mit eigener Struktur.
  Für `codex` wird daher statt des CollectionManagers die dedizierte
  [Codex-Subagents-Seite](./codex-subagents.md) gerendert.

## Was die Seite zeigt / kann
- Liste aller Subagent-Dateien mit Editor zum Anlegen, Bearbeiten und Löschen.
- Einheitliche Collection-UI (geteilt mit Commands, Skills, Rules).

## Datenquelle & Schreibziel
Markdown-Dateien im Subagent-Verzeichnis des Agenten, gelesen/geschrieben über
`core/`. Vor Überschreiben Snapshot.

## Verwandte Seiten
[Commands](./commands.md) · [Skills](./skills.md) · [Rules](./rules.md) ·
[Codex Subagents](./codex-subagents.md)
