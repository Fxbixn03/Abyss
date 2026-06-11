# Context

> Route: `/context` · Gruppe: **Runtime** · Komponente:
> [`ContextPage.tsx`](../../src/features/context/pages/ContextPage.tsx)

**Zweck:** Zeigt den **kompilierten Kontext**, den das Modell tatsächlich sieht –
also alle zusammengeführten Instruktionsdateien – und deckt **Konflikte** auf.
Nav-Beschreibung: „Compiled prompt & conflicts.“

## Agenten-Verfügbarkeit
Agenten mit Instruktionsdateien. Sonst: „{agent} has no compiled context –
Switch to an agent with instruction files to inspect what the model sees.“

## Was die Seite zeigt / kann
- Den vollständig zusammengesetzten Prompt aus allen Quellen des Agenten.
- Herkunft der Bausteine (welche Datei steuert was bei).
- Konflikte/Widersprüche zwischen Instruktionsteilen.

## Datenquelle
Kompiliert die Instruktionsdateien des Agenten über `core/`. Nur lesend –
Änderungen erfolgen auf [Instructions](./instructions.md).

## Verwandte Seiten
[Instructions](./instructions.md) · [Relations](./relations.md) ·
[Validation](./validation.md)
