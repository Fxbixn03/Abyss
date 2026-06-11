# MCP Marketplace

> Route: `/marketplace` · Gruppe: **Tools** · Komponente:
> [`MarketplacePage.tsx`](../../src/features/marketplace/pages/MarketplacePage.tsx)

**Zweck:** **MCP-Server browsen und installieren**. Untertitel/Nav: „Browse &
install MCP servers.“ Katalog zum Hinzufügen von Model-Context-Protocol-Servern
zum aktiven Agenten.

## Agenten-Verfügbarkeit
Nur Agenten mit MCP-Unterstützung. Sonst: „{agent} has no MCP support – Switch to
an agent that supports the Model Context Protocol to browse and install servers.“

## Was die Seite zeigt / kann
- Durchsuchbarer Katalog verfügbarer MCP-Server.
- **Installieren** eines Servers in die MCP-Config des aktiven Agenten.

## Datenquelle & Schreibziel
Listet Marketplace-Einträge; Installation schreibt über `core/mcp` in die
Agenten-Config (Snapshot vorher).

## Abgrenzung
- **Marketplace:** MCP-Server aus einem Katalog hinzufügen.
- [Plugins](./plugins.md): Claude-spezifische Plugin-/Marketplace-Verwaltung.

## Verwandte Seiten
[MCP](./mcp.md) · [Discover](./discover.md) · [Plugins](./plugins.md)
