# Analytics (Usage)

> Route: `/usage` · Gruppe: **Runtime** · Sidebar-Label: „Analytics“ ·
> Komponente: [`UsagePage.tsx`](../../src/features/usage/pages/UsagePage.tsx)

**Zweck:** **Token- und Kosten-Nutzung über die Zeit**. Nav-Beschreibung:
„Token & cost usage over time.“ Visualisiert, wie viel der Agent verbraucht.

## Agenten-Verfügbarkeit
Agenten mit Chat-/Session-Historie. Ohne Daten: „No usage recorded yet – Once
your agents have chat history, token use, cost estimates and an activity
calendar show up here.“

## Was die Seite zeigt / kann
- Token-Verbrauch und **Kostenschätzungen**.
- **Activity-Kalender** (Nutzung pro Tag).
- Aktions-Buttons im Header (z. B. Zeitraum/Refresh).

## Datenquelle
Leitet Kennzahlen aus den Session-/Chat-Daten des Agenten ab (über `core/`).
Nur lesend.

## Verwandte Seiten
[Dashboard](./dashboard.md) · [Sessions](./sessions.md) ·
[Insights](./insights.md)
