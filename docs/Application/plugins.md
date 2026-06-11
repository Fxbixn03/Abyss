# Plugins

> Route: `/plugins` · Gruppe: **System** · Komponente:
> [`PluginsPage.tsx`](../../src/features/plugins/pages/PluginsPage.tsx)

**Zweck:** Verwaltung von **Plugins und Plugin-Marketplaces** für Claude Code.

## Agenten-Verfügbarkeit
**Nur Claude Code.** Andere Agenten: „{agent} has no plugins – Plugin &
marketplace management is specific to Claude Code. Switch to Claude to configure
it.“ Ohne Config-Ort: „No config location set“.

## Was die Seite zeigt / kann
- Installierte Plugins anzeigen und verwalten.
- Plugin-Marketplaces konfigurieren.

## Datenquelle & Schreibziel
Liest/schreibt die Plugin-Konfiguration von Claude über `core/` (Snapshot
vorher).

## Abgrenzung
- **Plugins:** Claude-Plugin-/Marketplace-Verwaltung.
- [Marketplace](./marketplace.md): MCP-Server browsen/installieren (agentenübergreifend).

## Verwandte Seiten
[Marketplace](./marketplace.md) · [MCP](./mcp.md) · [Spinner](./spinner.md)
