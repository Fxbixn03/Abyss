# MCP Servers

> Route: `/mcp` · Gruppe: **System** · Komponente:
> [`McpPage.tsx`](../../src/features/mcp/pages/McpPage.tsx)

**Zweck:** Verwaltung der **Model-Context-Protocol-Server** des aktiven Agenten –
hinzufügen, bearbeiten, entfernen.

## Agenten-Verfügbarkeit
Agenten mit MCP-Unterstützung (Adapter-Sektion „MCP Servers“): u. a. **Claude,
Codex, Gemini, Cursor, Copilot, Windsurf**. Sonst: „{agent} has no MCP support –
Switch to an agent that supports the Model Context Protocol to manage servers.“
Ohne Config-Ort führt ein Button nach [Settings](./settings.md).

## Was die Seite zeigt / kann
- Liste der konfigurierten MCP-Server mit Status.
- Mehrere Header-Aktionen (u. a. Server hinzufügen/importieren, Verwaltung).
- Einstieg zum [Marketplace](./marketplace.md) zum Browsen/Installieren.

## Datenquelle & Schreibziel
Liest/schreibt die MCP-Konfiguration des Agenten über `core/mcp` (Snapshot
vorher).

## Verwandte Seiten
[Marketplace](./marketplace.md) · [Discover](./discover.md) ·
[Doctor](./doctor.md)
