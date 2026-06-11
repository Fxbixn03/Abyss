# Commands

> Route: `/commands` · Gruppe: **Development** · Komponente:
> [`CommandsPage.tsx`](../../src/features/collections/pages/CommandsPage.tsx)
> → rendert `CollectionManager kind="commands"` (Icon `square-slash`)

**Zweck:** Verwaltet die **Custom-Slash-Commands** des aktiven Agenten als
Markdown-Collection (jede Datei = ein Command). Codex nennt diese Sektion in der
Sidebar „Prompts“.

## Agenten-Verfügbarkeit
- **Markdown-Collection** (diese Seite): Claude, Cursor, Codex (als „Prompts“)
  u. a.
- **Sonderfall Gemini:** Gemini-Commands sind gruppierte TOML-Dateien mit eigener
  Struktur. Für `gemini` wird daher die dedizierte
  [Gemini-Commands-Seite](./gemini-commands.md) gerendert.

## Was die Seite zeigt / kann
- Liste aller Command-Dateien mit Editor zum Anlegen, Bearbeiten und Löschen.
- Einheitliche Collection-UI (geteilt mit Agents, Skills, Rules).

## Datenquelle & Schreibziel
Markdown-Command-Dateien im Command-Verzeichnis des Agenten über `core/`.

## Verwandte Seiten
[Agents](./agents.md) · [Skills](./skills.md) · [Rules](./rules.md) ·
[Gemini Commands](./gemini-commands.md)
