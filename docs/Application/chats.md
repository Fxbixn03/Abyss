# Chats

> Route: `/chats` · Gruppe: **Runtime** · Komponente:
> [`ChatsPage.tsx`](../../src/features/chats/pages/ChatsPage.tsx)

**Zweck:** Live-Lesen und -Schreiben von **Chat-Verläufen** mit dem Agenten.
Zeigt vorhandene Unterhaltungen und erlaubt – wo unterstützt – Live-Chat.

## Agenten-Verfügbarkeit
Nur Agenten mit Chat-Sektion in der Sidebar: **Claude Code** und **OpenAI
Codex** (siehe deren Adapter, „Chats“). Andere Agenten: „{agent} has no chats –
Switch to an agent that supports chat history and live chat.“

## Was die Seite zeigt / kann
- Liste der Chats/Unterhaltungen des Agenten.
- Inspektion einzelner Verläufe; bei unterstützten Agenten Live-Chat (Streaming
  über IPC).

## Datenquelle
Liest die On-Disk-Chat-/Session-Daten des Agenten über `core/`. Live-Chat nutzt
den Chat-Runtime-Stream (siehe Memory „Abyss chat feature“).

## Verwandte Seiten
[Sessions](./sessions.md) · [Insights](./insights.md) ·
[Context](./context.md)
