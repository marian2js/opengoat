# OpenGoat ACP Integration

This document explains OpenGoat Agent Client Protocol (ACP) support.

## What ACP Is

ACP is a protocol for connecting an AI agent runtime to clients (editors/IDEs) over JSON-RPC.

- client side: editor/IDE
- agent side: OpenGoat
- transport: stdio NDJSON framing

Reference: [Agent Client Protocol](https://agentclientprotocol.com/get-started/introduction)

## OpenGoat Context

OpenGoat remains a manager runtime with ACP surface, now OpenClaw-first:

- default entry agent resolves from `OPENGOAT_DEFAULT_AGENT`, then `config.defaultAgent`, then `ceo`
- agent execution runtime is OpenClaw
- direct agent invocation + session semantics are preserved

ACP gives OpenGoat a stable integration contract for external tooling without custom editor-specific glue.

## Implementation

Core:

- `packages/core/src/core/acp/application/acp-agent.ts`
- `packages/core/src/core/acp/application/session-store.ts`
- `packages/core/src/core/acp/domain/meta.ts`

Node transport:

- `packages/core/src/platform/node/acp-server.ts`

CLI command:

- `packages/cli/src/cli/commands/acp.command.ts`

## Supported Flows

- `initialize`
- `session/new`
- `session/load`
- `session/resume`
- `session/list`
- `session/prompt`
- `session/cancel`

`session/prompt` maps into `OpenGoatService.runAgent(...)` and streams assistant updates back through ACP session events.

## OpenGoat `_meta` Aliases

Accepted aliases in request `_meta`:

- agent selection: `agentId`, `agent`, `targetAgent`
- session key/ref: `sessionKey`, `sessionRef`, `session`
- force new session: `forceNewSession`, `newSession`
- disable session: `disableSession`, `noSession`

## Run

```bash
./bin/opengoat acp --help
./bin/opengoat acp --agent ceo --verbose
```
