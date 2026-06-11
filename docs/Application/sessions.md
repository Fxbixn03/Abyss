# Sessions

> Route: `/sessions` · Gruppe: **Runtime** · Sidebar-Label: „Sessions“ ·
> Komponente: [`SessionsPage.tsx`](../../src/features/sessions/pages/SessionsPage.tsx)

**Zweck:** **Session-Explorer** – aufgezeichnete Agenten-Sessions durchsuchen,
vergleichen und inspizieren. Nav-Beschreibung: „Browse, compare & inspect
sessions.“

## Agenten-Verfügbarkeit
Nur Agenten, die Sessions aufzeichnen (z. B. Claude, Codex). Sonst:
„{agent} has no session history – Switch to an agent that records chat sessions
to explore them here.“

## Was die Seite zeigt / kann
- Liste aller Sessions mit Detailansicht.
- Vergleichen und Inspizieren einzelner Sessions (Verlauf, Nachrichten,
  Tool-Aufrufe).

## Datenquelle
Liest die Session-Dateien des Agenten von der Platte über `core/`. Nur lesend.

## Verwandte Seiten
[Chats](./chats.md) · [Insights](./insights.md) · [Analytics](./analytics.md)
