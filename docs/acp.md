# OpenGoat ACP Integration

This document explains OpenGoat's Agent Client Protocol (ACP) integration.

## What ACP Is

ACP is a protocol for connecting an AI coding agent to a client (typically an editor/IDE) over JSON-RPC.

- Client side: editor/IDE
- Agent side: OpenGoat
- Transport: stdio stream (NDJSON framing)

Reference: [Agent Client Protocol](https://agentclientprotocol.com/get-started/introduction)

## Why ACP Matters for OpenGoat

OpenGoat is an orchestrator that can route work across multiple agents and providers. ACP gives it:

- a standard integration point for external clients
- reusable session semantics (`new`, `load`, `list`, `resume`)
- consistent cancel/prompt behavior across tools
- less custom glue code per editor integration

## Implementation Overview

### Core

- ACP adapter:
  - `/Users/marian2js/workspace/opengoat/src/core/acp/application/acp-agent.ts`
- ACP session store:
  - `/Users/marian2js/workspace/opengoat/src/core/acp/application/session-store.ts`
- ACP metadata parsing:
  - `/Users/marian2js/workspace/opengoat/src/core/acp/domain/meta.ts`

### Transport

- Node stdio server wiring:
  - `/Users/marian2js/workspace/opengoat/src/platform/node/acp-server.ts`

### CLI

- ACP entry command:
  - `/Users/marian2js/workspace/opengoat/src/apps/cli/commands/acp.command.ts`

## Supported Protocol Flow

### `initialize`

Advertises:

- `loadSession` capability
- `session.list` and `session.resume` capabilities
- prompt capabilities for text/resource/image content

### `session/new`

Creates an ACP session mapped to:

- target OpenGoat agent
- OpenGoat session reference key
- working directory context

Returns session mode state where available modes are mapped from OpenGoat agents.

### `session/load` and `session/resume`

- Re-associates an ACP session with an OpenGoat session reference.
- `load` replays recent session history as ACP session updates.
- `resume` reconnects without replay.

### `session/list`

Lists OpenGoat sessions for the selected/default agent and exposes ACP session info objects.

### `session/prompt`

Extracts text/resource content from ACP prompt blocks and executes:

- `OpenGoatService.runAgent(...)`

with mapped ACP session metadata:

- `agentId`
- `sessionKey`
- `forceNewSession`
- `disableSession`

Emits assistant output via `session/update` (`agent_message_chunk`) and returns ACP stop reason.

### `session/cancel`

Supports protocol-level cancellation:

- active prompt is marked cancelled
- prompt request resolves with `stopReason: "cancelled"`

## OpenGoat-Specific `_meta` Keys

The ACP adapter accepts the following aliases in request `_meta`:

- agent selection: `agentId`, `agent`, `targetAgent`
- session key/ref: `sessionKey`, `sessionRef`, `session`
- force new session: `forceNewSession`, `newSession`
- disable session: `disableSession`, `noSession`

## Running

```bash
./bin/opengoat acp --help
./bin/opengoat acp --agent orchestrator --verbose
```

Use stdio from an ACP-capable client/editor to connect.
