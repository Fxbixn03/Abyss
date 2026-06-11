# Discover

> Route: `/discover` · Gruppe: **Tools** · Komponente:
> [`DiscoverPage.tsx`](../../src/features/discovery/pages/DiscoverPage.tsx)

**Zweck:** Findet **Agenten, CLIs und MCP-Server auf diesem Rechner**.
Untertitel: „Agents, CLIs and MCP servers found on this machine.“ Hilft beim
Einrichten neuer/erkannter Tools.

## Agenten-Verfügbarkeit
Agnostisch – scannt das ganze System.

## Was die Seite zeigt / kann
- Auf der Maschine erkannte Agenten/CLIs und zusätzliche MCP-Server.
- Vorschläge zum Einrichten. Ist alles schon erfasst: „Nothing new to discover –
  Every agent found on your system is already set up, and no extra MCP servers
  were found.“

## Datenquelle
Nutzt die Detektion in `core/agent-paths` und MCP-Erkennung über IPC. Lesend;
Einrichten kann gezielt Config anlegen.

## Verwandte Seiten
[Marketplace](./marketplace.md) · [MCP](./mcp.md) · [Settings](./settings.md)
