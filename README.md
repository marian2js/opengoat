# OpenGoat

OpenGoat is a high-level agent orchestrator foundation with a CLI entrypoint today and a modular runtime design for future server and Electron surfaces.

## Architecture

The codebase is split into layers to keep product surfaces decoupled from orchestration logic:

- `src/core`: domain models, templates, ports, and application services.
- `src/core/providers`: pluggable provider registry + provider implementations.
- `src/core/providers/providers/<provider-id>`: self-contained provider modules and tests.
- `src/platform/node`: Node-specific adapters (filesystem and OS path resolution).
- `src/apps/cli`: CLI command routing and text output only.

This keeps the core reusable for a future HTTP server, desktop shell, or other runtime.

## Current capabilities

- `opengoat init` (or just `opengoat`) bootstraps `~/.opengoat`.
- Creates default `orchestrator` agent workspace:
  - `~/.opengoat/workspaces/orchestrator/AGENTS.md`
- Creates per-agent internal config:
  - `~/.opengoat/agents/orchestrator/`
- Uses only `.md` and `.json` files for configuration/state artifacts.
- Supports custom home root with `OPENGOAT_HOME`.
- `orchestrator` is the immutable default agent for inbound message routing.
- Every agent has exactly one assigned provider (`~/.opengoat/agents/<agent>/config.json`).
- Built-in providers: `codex`, `claude`, `cursor`, `openclaw`, `openai`, `openrouter`.
  - Each provider lives in its own folder with code + tests.
  - New providers are auto-discovered from provider folders (no central registration edits).

## Commands

- `./bin/opengoat` or `./bin/opengoat init`
- `./bin/opengoat agent create <name>`
- `./bin/opengoat agent list`
- `./bin/opengoat provider list`
- `./bin/opengoat agent provider get <agent-id>`
- `./bin/opengoat agent provider set <agent-id> <provider-id>`
- `./bin/opengoat agent run <agent-id> --message <text> [--model <model>] [-- <provider-args>]`

## OpenAI Provider

`openai` is an API provider (no CLI required).

- Required auth: `OPENAI_API_KEY` (or `OPENGOAT_OPENAI_API_KEY`)
- Default endpoint: `https://api.openai.com/v1/responses`
- Optional model override: `OPENGOAT_OPENAI_MODEL`
- OpenAI-compatible base URL support:
  - `OPENGOAT_OPENAI_BASE_URL` (for example `https://your-gateway.example/v1`)
  - `OPENGOAT_OPENAI_ENDPOINT_PATH` (for example `/responses` or `/chat/completions`)
  - `OPENGOAT_OPENAI_ENDPOINT` can override the full URL directly.

## Development

```bash
npm install
npm run build
npm test
npm run start -- init
```
