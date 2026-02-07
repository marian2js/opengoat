# OpenGoat

OpenGoat is a high-level agent orchestrator foundation with a CLI entrypoint today and a modular runtime design for future server and Electron surfaces.

## Architecture

The codebase is split into layers to keep product surfaces decoupled from orchestration logic:

- `src/core/agents`: agent lifecycle domain (`AgentService`).
- `src/core/bootstrap`: filesystem bootstrap domain (`BootstrapService`).
- `src/core/providers`: provider domain (`ProviderService`, registry, implementations).
- `src/core/plugins`: OpenClaw-compatible plugin domain (`PluginService`).
- `src/core/acp`: Agent Client Protocol domain (ACP agent adapter + session mapping).
- `src/core/orchestration`: routing + orchestration runtime (`RoutingService`, `OrchestrationService`).
- `src/core/sessions`: session store/transcript lifecycle (reset, pruning, compaction, history).
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
- Every agent has skill support:
  - managed skills: `~/.opengoat/skills/<skill-id>/SKILL.md`
  - workspace skills: `~/.opengoat/workspaces/<agent-id>/skills/<skill-id>/SKILL.md`
  - plugin skills: auto-loaded from installed OpenClaw-compatible plugins
  - workspace skills override managed skills with the same id.
- Agent metadata lives in front matter at `AGENTS.md` (`id`, `name`, `description`, `provider`, `tags`, `delegation`, `priority`) and is used for routing decisions.
- On every `agent run`, OpenGoat loads configured workspace bootstrap files, injects them into a generated system prompt with missing-file markers + truncation protection, and runs the provider with the agent workspace as default `cwd`.
- OpenGoat also injects a bounded skills section into the system prompt, including skill metadata and SKILL.md content.
- Every agent run writes a trace JSON file at `~/.opengoat/runs/<run-id>.json` containing entry agent, routing decision, and provider execution output.
- Orchestrator runs an AI-driven delegation loop with action types (`delegate_to_agent`, `read_workspace_file`, `write_workspace_file`, `respond_user`, `finish`) and configurable communication mode (`direct`, `artifacts`, `hybrid`).
- Orchestrator can also execute `install_skill` actions to install skills for target agents during orchestration.
- OpenClaw-compatible plugin runtime:
  - Uses OpenClaw CLI under isolated state at `~/.opengoat/openclaw-compat`.
  - Supports install/list/info/enable/disable/doctor through OpenGoat CLI.
  - Plugin skill folders are auto-discovered and merged into agent skill context.
- ACP (Agent Client Protocol) server support:
  - Runs OpenGoat as an ACP agent over stdio for editor/IDE integration.
  - Exposes session creation/loading/listing and prompt execution via OpenGoat orchestration.
  - Supports ACP session modes mapped to OpenGoat agents.
  - Supports cancellation with protocol-compliant `cancelled` stop reason.
- Sessions are persisted per agent under `~/.opengoat/agents/<agent-id>/sessions/`:
  - `sessions.json` (session store map keyed by session key)
  - `<session-id>.jsonl` (transcript events)
- Main direct-chat key defaults to `agent:<agent-id>:main`.
- Agent runtime session config lives in `~/.opengoat/agents/<agent-id>/config.json` (`runtime.sessions`):
  - reset policy (`daily`/`idle`)
  - context pruning
  - transcript compaction
- Session context is injected into the system prompt on each run.
- Built-in providers: `codex`, `claude`, `cursor`, `gemini`, `grok`, `openclaw`, `opencode`, `openai`, `openrouter`.
- OpenClaw-compat provider set:
  - `openclaw-<provider-id>` providers are auto-registered for OpenClaw model providers (for example `openclaw-openai`, `openclaw-openai-codex`, `openclaw-anthropic`, `openclaw-openrouter`, `openclaw-vercel-ai-gateway`, `openclaw-xai`, `openclaw-zai`).
  - Compatibility providers invoke `openclaw agent --model <provider/model>` internally, so OpenGoat can use OpenClaw OAuth/auth-provider flows without adding provider-specific logic across the app.
  - Model override env:
    - global: `OPENGOAT_OPENCLAW_MODEL`
    - provider-specific: `OPENGOAT_OPENCLAW_<PROVIDER_ID>_MODEL` (example: `OPENGOAT_OPENCLAW_OPENAI_MODEL`)
  - Each provider lives in its own folder with code + tests.
  - New providers are auto-discovered from provider folders (no central registration edits).
  - `onboard` uses provider-declared onboarding metadata to collect required credentials/settings.
  - Provider settings persist at `~/.opengoat/providers/<provider-id>/config.json` and are auto-loaded at runtime.

## Commands

- `./bin/opengoat` or `./bin/opengoat init`
- `./bin/opengoat acp [--agent <id>] [--session-prefix <prefix>] [--history-limit <n>] [--verbose]`
- `./bin/opengoat onboard`
- `./bin/opengoat agent --message "<text>"` (defaults to `orchestrator`)
- `./bin/opengoat agent <agent-id> --message "<text>"`
- `./bin/opengoat agent --message "<text>" --session <key|id>`
- `./bin/opengoat agent --message "<text>" --new-session`
- `./bin/opengoat agent create <name>`
- `./bin/opengoat agent list`
- `./bin/opengoat provider list`
- `./bin/opengoat route --message "<text>" [--agent <id>] [--json]`
- `./bin/opengoat session list [--agent <id>] [--active-minutes <n>] [--json]`
- `./bin/opengoat session history [--agent <id>] [--session <key|id>] [--limit <n>] [--include-compaction]`
- `./bin/opengoat session reset [--agent <id>] [--session <key|id>]`
- `./bin/opengoat session compact [--agent <id>] [--session <key|id>]`
- `./bin/opengoat scenario run --file <scenario.json> [--mode live|scripted] [--json]`
- `./bin/opengoat skill list [--agent <id>] [--json]`
- `./bin/opengoat skill install <name> [--agent <id>] [--from <path>] [--description <text>] [--json]`
- `./bin/opengoat plugin list [--enabled] [--verbose] [--all] [--json]`
- `./bin/opengoat plugin install <spec> [--link] [--json]`
- `./bin/opengoat plugin info <plugin-id> [--json]`
- `./bin/opengoat plugin enable <plugin-id>`
- `./bin/opengoat plugin disable <plugin-id>`
- `./bin/opengoat plugin doctor [--json]`
- `./bin/opengoat agent provider get <agent-id>`
- `./bin/opengoat agent provider set <agent-id> <provider-id>`
- `./bin/opengoat agent run <agent-id> --message <text> [--session <key|id>] [--new-session|--no-session] [--model <model>] [-- <provider-args>]`

Detailed orchestration flow and scenario strategy:

- `/Users/marian2js/workspace/opengoat/docs/orchestration-flow.md`

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

## OpenCode Provider

`opencode` is a CLI provider.

- Command: `opencode`
- Non-interactive execution: `opencode run <message>`
- Optional command override: `OPENCODE_CMD`
- Optional default model: `OPENCODE_MODEL`
- Auth flow: `opencode auth login`

## Skills

- Install by CLI:
  - `./bin/opengoat skill install release-checklist --agent developer`
  - `./bin/opengoat skill install code-review --agent developer --from ~/skills/code-review`
- List installed skills:
  - `./bin/opengoat skill list --agent developer`
- Install by asking the orchestrator:
  - `./bin/opengoat agent --message "Install skill release-checklist for developer"`
  - The orchestrator can use `install_skill` actions to materialize the skill under the target agent workspace.

## Plugins (OpenClaw Compatible)

OpenGoat executes OpenClaw plugins through the OpenClaw CLI to preserve plugin runtime compatibility.

- Compatibility state root: `~/.opengoat/openclaw-compat`
- Plugin installs:
  - copied installs: `~/.opengoat/openclaw-compat/extensions`
  - linked installs: tracked in `~/.opengoat/openclaw-compat/openclaw.json`
- Command override:
  - default command: `openclaw`
  - optional override: `OPENGOAT_OPENCLAW_CMD`

Plugin-declared `skills` directories (and default `<plugin>/skills`) are automatically folded into the agent skills prompt.

## ACP (Agent Client Protocol)

ACP is a standard protocol for connecting coding agents to editor/IDE clients. In OpenGoat, ACP provides:

- one protocol surface for integrations instead of custom editor-specific bridges
- native session lifecycle interoperability (`new`, `load`, `list`, `resume`, `prompt`, `cancel`)
- compatibility with clients that already speak ACP

Run the ACP server:

- `./bin/opengoat acp`

Useful options:

- `--agent <id>`: default target agent for new ACP sessions
- `--session-prefix <prefix>`: prefix for generated session keys
- `--history-limit <n>`: max replayed history items on `session/load`
- `--verbose`: ACP server logs to stderr

Session metadata supported from ACP `_meta`:

- `agentId` / `agent` / `targetAgent`
- `sessionKey` / `sessionRef` / `session`
- `forceNewSession` / `newSession`
- `disableSession` / `noSession`

Implementation reference:

- `/Users/marian2js/workspace/opengoat/docs/acp.md`

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
