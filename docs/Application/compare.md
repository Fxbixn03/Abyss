# Compare & Sync

> Route: `/compare` · Gruppe: **Tools** · Komponente:
> [`ComparePage.tsx`](../../src/features/compare/pages/ComparePage.tsx)

**Zweck:** **Zwei Agenten vergleichen** und Konfiguration zwischen ihnen
kopieren. Untertitel: „Diff two agents and copy config between them.“

## Agenten-Verfügbarkeit
Wählt zwei Agenten (A und B) aus den aktiven Agenten. Unterstützt ein Bereich
(„Surface“) nicht beide Agenten, wird das angezeigt: „Surface not supported by
both agents“.

## Was die Seite zeigt / kann
- **Diff** der gewählten Surface (z. B. Instructions, MCP, Hooks) zwischen A und B.
- **Swap** – A und B tauschen.
- **Copy A→B** und **B→A** – Konfiguration in eine Richtung übernehmen
  (mit Bestätigung).

## Datenquelle & Schreibziel
Liest beide Agenten über `core/`; das Kopieren schreibt in den Ziel-Agenten
(Snapshot vorher).

## Verwandte Seiten
[Bundles](./bundles.md) · [Profiles](./profiles.md) · [Discover](./discover.md)
