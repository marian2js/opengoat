# OpenGoat

OpenGoat is a high-level agent orchestrator foundation with a CLI entrypoint today and a modular runtime design for future server and Electron surfaces.

## Architecture

The codebase is split into layers to keep product surfaces decoupled from orchestration logic:

- `src/core/agents`: agent lifecycle domain (`AgentService`).
- `src/core/bootstrap`: filesystem bootstrap domain (`BootstrapService`).
- `src/core/providers`: provider domain (`ProviderService`, registry, implementations).
- `src/core/orchestration`: routing + orchestration runtime (`RoutingService`, `OrchestrationService`).
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
- CLI automatically loads environment variables from `.env` in the current working directory.
- `orchestrator` is the immutable default agent for inbound message routing.
- Every agent has exactly one assigned provider (`~/.opengoat/agents/<agent>/config.json`).
- Agent metadata lives in front matter at `AGENTS.md` (`id`, `name`, `description`, `provider`, `tags`, `delegation`, `priority`) and is used for routing decisions.
- On every `agent run`, OpenGoat loads configured workspace bootstrap files, injects them into a generated system prompt with missing-file markers + truncation protection, and runs the provider with the agent workspace as default `cwd`.
- Every agent run writes a trace JSON file at `~/.opengoat/runs/<run-id>.json` containing entry agent, routing decision, and provider execution output.
- Built-in providers: `codex`, `claude`, `cursor`, `gemini`, `grok`, `openclaw`, `openai`, `openrouter`.
  - Each provider lives in its own folder with code + tests.
  - New providers are auto-discovered from provider folders (no central registration edits).
  - `onboard` uses provider-declared onboarding metadata to collect required credentials/settings.
  - Provider settings persist at `~/.opengoat/providers/<provider-id>/config.json` and are auto-loaded at runtime.

## Commands

- `./bin/opengoat` or `./bin/opengoat init`
- `./bin/opengoat onboard`
- `./bin/opengoat agent --message "<text>"` (defaults to `orchestrator`)
- `./bin/opengoat agent <agent-id> --message "<text>"`
- `./bin/opengoat agent create <name>`
- `./bin/opengoat agent list`
- `./bin/opengoat provider list`
- `./bin/opengoat route --message "<text>" [--agent <id>] [--json]`
- `./bin/opengoat agent provider get <agent-id>`
- `./bin/opengoat agent provider set <agent-id> <provider-id>`
- `./bin/opengoat agent run <agent-id> --message <text> [--model <model>] [-- <provider-args>]`

## OpenAI Provider

`openai` is an API provider (no CLI required).

- Required auth: `OPENAI_API_KEY`
- Default endpoint: `https://api.openai.com/v1/responses`
- Optional model override: `OPENAI_MODEL`
- OpenAI-compatible base URL support:
  - `OPENAI_BASE_URL` (for example `https://your-gateway.example/v1`)
  - `OPENAI_ENDPOINT_PATH` (for example `/responses` or `/chat/completions`)
  - `OPENAI_ENDPOINT` can override the full URL directly.

## Gemini Provider

`gemini` is a CLI provider.

- Command: `gemini`
- Non-interactive execution: `--prompt <text>`
- Optional command override: `GEMINI_CMD`
- Optional default model: `GEMINI_MODEL`

## Grok Provider

`grok` is an API provider (no CLI required).

- Required auth: `XAI_API_KEY`
- Default endpoint: `https://api.x.ai/v1/responses`
- Optional model override: `GROK_MODEL`
- Endpoint controls:
  - `GROK_BASE_URL`
  - `GROK_ENDPOINT_PATH`
  - `GROK_ENDPOINT`
  - `GROK_API_STYLE` (`responses` or `chat`)

## Development

```bash
npm install
npm run build
npm test
npm run start -- init
```
