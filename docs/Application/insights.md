# Insights

> Route: `/insights` · Gruppe: **Runtime** · Komponente:
> [`InsightsPage.tsx`](../../src/features/insights/pages/InsightsPage.tsx)

**Zweck:** Qualitäts- und **Friction-Signale** aus den Sessions. Nav-
Beschreibung: „Session friction & quality signals.“ Macht sichtbar, wie reibungs-
arm die Zusammenarbeit mit dem Agenten verläuft.

## Agenten-Verfügbarkeit
Agenten mit Session-Historie (analog [Sessions](./sessions.md)).

## Was die Seite zeigt / kann
- **Friction-Buckets**: smooth (grün) · some friction (gelb) · rough (rot) als
  Balkenverteilung.
- Tages-Scores (Durchschnitt pro Tag, Anzahl Sessions).
- Hervorgehobene reibungsbehaftete Stellen/Sessions mit Titel.

## Datenquelle
Berechnet die Signale aus den Session-Daten des Agenten (über `core/`). Nur
lesend.

## Verwandte Seiten
[Sessions](./sessions.md) · [Analytics](./analytics.md) · [Chats](./chats.md)
