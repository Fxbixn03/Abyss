# Prompt Templates

> Route: `/templates` · Gruppe: **Development** · Komponente:
> [`TemplatesPage.tsx`](../../src/features/templates/pages/TemplatesPage.tsx)

**Zweck:** Bibliothek **wiederverwendbarer System-Prompts und Regelsätze**.
Untertitel: „Reusable system prompts and rule sets. Apply one to add it to an
agent's instructions.“ Ein Template lässt sich auf die Instructions eines
Agenten anwenden.

## Agenten-Verfügbarkeit
Agnostisch – die Bibliothek ist global. Das Anwenden schreibt in die
Instructions des jeweils gewählten Agenten.

## Was die Seite zeigt / kann
- Durchsuchbare Liste von Templates mit Vorschau.
- **Pin/Favorit** – wichtige Templates nach oben anheften.
- **Compose-Modus** – mehrere Templates auswählen und kombinieren.
- **Apply** – ausgewähltes Template an die Instructions eines Agenten anhängen.

## Datenquelle & Schreibziel
Template-Bibliothek (App-eigene Daten). Das Anwenden schreibt über `core/` in die
Instruktionsdateien des Zielagenten (Snapshot vorher).

## Verwandte Seiten
[Instructions](./instructions.md) · [Rules](./rules.md) ·
[Sandbox](./sandbox.md) (zum Ausprobieren)
