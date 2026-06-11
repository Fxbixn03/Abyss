# Skills

> Route: `/skills` · Gruppe: **Development** · Komponente:
> [`SkillsPage.tsx`](../../src/features/collections/pages/SkillsPage.tsx)
> → rendert `CollectionManager kind="skills"` (Icon `graduation-cap`)

**Zweck:** Verwaltet die **Skills** des aktiven Agenten als Markdown-Collection
(jede Datei = ein Skill).

## Agenten-Verfügbarkeit
Für alle Agenten, die Skills als Markdown-Collection unterstützen (u. a. Claude,
Codex, Cursor, Gemini). Andere Agenten zeigen einen Leerzustand.

## Was die Seite zeigt / kann
- Liste aller Skill-Dateien mit Editor zum Anlegen, Bearbeiten und Löschen.
- Einheitliche Collection-UI (geteilt mit Agents, Commands, Rules).

## Datenquelle & Schreibziel
Markdown-Skill-Dateien im Skill-Verzeichnis des Agenten über `core/`.

## Verwandte Seiten
[Agents](./agents.md) · [Commands](./commands.md) · [Rules](./rules.md)
