# OpenGoat

OpenGoat is a high-level agent orchestrator foundation with a CLI entrypoint today and a modular runtime design for future server and Electron surfaces.

## Architecture

The codebase is split into layers to keep product surfaces decoupled from orchestration logic:

- `src/core/agents`: agent lifecycle domain (`AgentService`).
- `src/core/bootstrap`: filesystem bootstrap domain (`BootstrapService`).
- `src/core/providers`: provider domain (`ProviderService`, registry, implementations).
- `src/core/opengoat`: orchestration facade used by app surfaces (`OpenGoatService`).
- `src/core/domain`, `src/core/templates`, `src/core/ports`: shared contracts and rendering helpers.
- `src/core/providers/providers/<provider-id>`: self-contained provider modules and tests.
- `src/platform/node`: Node-specific adapters (filesystem and OS path resolution).
- `src/apps/cli`: CLI command routing and text output only.

This keeps the core reusable for a future HTTP server, desktop shell, or other runtime.

## Current capabilities

- `opengoat init` (or just `opengoat`) bootstraps `~/.opengoat`.
- Creates default `orchestrator` agent workspace:
  - `~/.opengoat/workspaces/orchestrator/AGENTS.md`
- Seeds workspace bootstrap files (if missing):
  - `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `CONTEXT.md`
  - `BOOTSTRAP.md` only for brand-new workspaces (first-run ritual marker)
- Creates per-agent internal config:
  - `~/.opengoat/agents/orchestrator/`
- Uses only `.md` and `.json` files for configuration/state artifacts.
- Supports custom home root with `OPENGOAT_HOME`.
- `orchestrator` is the immutable default agent for inbound message routing.
- Every agent has exactly one assigned provider (`~/.opengoat/agents/<agent>/config.json`).
- On every `agent run`, OpenGoat loads configured workspace bootstrap files, injects them into a generated system prompt with missing-file markers + truncation protection, and runs the provider with the agent workspace as default `cwd`.
- Built-in providers: `codex`, `claude`, `cursor`, `grok`, `openclaw`, `openai`, `openrouter`.
  - Each provider lives in its own folder with code + tests.
  - New providers are auto-discovered from provider folders (no central registration edits).

## Commands

- `./bin/opengoat` or `./bin/opengoat init`
- `./bin/opengoat agent --message "<text>"` (defaults to `orchestrator`)
- `./bin/opengoat agent <agent-id> --message "<text>"`
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

## Grok Provider

`grok` is an API provider (no CLI required).

- Required auth: `XAI_API_KEY` (or `OPENGOAT_GROK_API_KEY`)
- Default endpoint: `https://api.x.ai/v1/responses`
- Optional model override: `OPENGOAT_GROK_MODEL`
- Endpoint controls:
  - `OPENGOAT_GROK_BASE_URL`
  - `OPENGOAT_GROK_ENDPOINT_PATH`
  - `OPENGOAT_GROK_ENDPOINT`
  - `OPENGOAT_GROK_API_STYLE` (`responses` or `chat`)

## Development

```bash
npm install
npm run build
npm test
npm run start -- init
```
