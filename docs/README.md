# Abyss documentation

Technical and day-to-day reference for Abyss. If you're just looking to see what
Abyss is, start with the [project README](../README.md).

## Contents

| Guide | What's inside |
| --- | --- |
| [Installation](installation.md) | Download for Linux & Windows, build from source, first run |
| [Usage](usage.md) | Working through each surface, where Abyss reads & writes on disk, the `abyss` CLI |
| [Architecture](architecture.md) | How Abyss is put together, extending it with new agents/themes, development commands, brand assets |

## Internals

| Guide | What's inside |
| --- | --- |
| [Architecture overview](Architecture.md) | The four layers, the typed IPC bridge, feature-first renderer, CLI entry point (with diagrams) |
| [Core modules](Core-Modules.md) | Per-file purpose and public API surface of every module in `core/` |
| [Agent lifecycle](Agent-Lifecycle.md) | Detect → load → validate → edit → snapshot → write → export/apply, and CLI ↔ GUI parity |

## See also

- [CLAUDE.md](../CLAUDE.md) — the full architecture deep-dive and contributor rules.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — workflow, invariants, and how to get a change merged.
