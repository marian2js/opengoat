# OpenGoat Orchestration Flow

This document explains the current orchestration architecture in OpenGoat, including AI-driven delegation, sessions, artifact-based coordination, and scenario testing.

## Agent Runtime Types

OpenGoat supports two runtime types for agent execution:

- Internal agents:
  - receive full OpenGoat workspace context injection (`AGENTS.md`, `CONTEXT.md`, etc.)
  - default working directory is `~/.opengoat/workspaces/<agent-id>` (unless `--cwd` is explicitly set)
- External agents:
  - do not receive OpenGoat workspace context injection
  - execute in the caller project directory (`process.cwd()`) by default
  - are intended for tool-style providers (OpenCode, Cursor, Gemini CLI, etc.)

Path concepts:

- Workspace path:
  - durable agent-owned location under `~/.opengoat/workspaces/<agent-id>`
  - used by OpenGoat for persistent agent context/state
- Working path:
  - project execution path where work happens
  - defaults to the process cwd where `opengoat` is invoked (or explicit `--cwd`)
  - tracked per OpenGoat session

Resolution model:

- `orchestrator` defaults to internal.
- Non-orchestrator agents default to:
  - internal for HTTP/API providers (OpenAI, Grok, OpenRouter, etc.)
  - external for CLI/tool providers
- This can be overridden per-agent in `~/.opengoat/agents/<agent-id>/config.json` with:
  - `runtime.workspaceAccess: "internal" | "external" | "auto"`

## Goals

- Keep agent setup minimal:
  - `name`
  - `description`
  - `provider`
  - optional `discoverable` (default `true`)
- Let the orchestrator decide the flow dynamically with AI.
- Support both:
  - direct agent-to-agent communication
  - markdown artifact coordination
- Persist full execution state for debugging and replay.

## Core Components

- Orchestration runtime:
  - `./packages/core/src/core/orchestration/application/orchestration.service.ts`
- Planner prompt + decision parsing:
  - `./packages/core/src/core/orchestration/application/orchestration-planner.service.ts`
- Session lifecycle + transcripts:
  - `./packages/core/src/core/sessions/application/session.service.ts`
- Provider invocation + system prompt build:
  - `./packages/core/src/core/providers/application/provider.service.ts`
- Internal HTTP LLM runtime (Vercel AI SDK):
  - `./packages/core/src/core/llm/application/vercel-ai-text-runtime.ts`

## High-Level Runtime

1. User sends a message to `orchestrator`.
2. Orchestrator enters an AI decision loop (`max steps` + `max delegation` guards).
3. On each loop step:

- Build planner prompt with:
  - available agents from `AGENTS.md` metadata (`discoverable: true` and `delegation.canReceive: true`)
  - shared notes from prior steps
  - recent events
- Ask orchestrator provider for next action.
- Parse strict JSON action.

4. Supported action types:

- `delegate_to_agent`
- `read_workspace_file`
- `write_workspace_file`
- `install_skill`
- `respond_user`
- `finish`

5. Delegation mode can be:

- `direct`
- `artifacts`
- `hybrid` (direct + artifacts)

6. All steps are logged into a run trace and session graph.

## Communication Modes

### Direct

Orchestrator invokes the target agent provider with a delegation message.

### Artifacts

Orchestrator writes markdown handoff files under:

- `~/.opengoat/sessions/<run-id>/`

Then target response is captured back into markdown files.

Important for external/tool agents:

- OpenGoat may still use artifact mode internally.
- Internal artifact filesystem paths are not disclosed to external providers.
- External providers receive the delegation instructions, shared notes, and expected output, but not internal coordination paths.

### Hybrid

Combines direct invocation and markdown handoff artifacts.

## Skills

Skill directories:

- Managed: `~/.opengoat/skills/<skill-id>/SKILL.md`
- Per-agent workspace: `~/.opengoat/workspaces/<agent-id>/skills/<skill-id>/SKILL.md`

Skill scopes:

- Global skills:
  - stored in `~/.opengoat/skills`
  - reusable defaults across agents
- Agent-level skills:
  - stored in `~/.opengoat/workspaces/<agent-id>/skills`
  - highest precedence for that agent

Precedence:

- workspace skill overrides plugin/managed skill with the same id.
- plugin skill overrides managed skill with the same id.

Runtime behavior:

1. OpenGoat resolves merged skills for the running agent.
2. A bounded skills section is injected into the system prompt.
3. Agents can self-install/update by creating `skills/<skill-id>/SKILL.md` in their workspace.
4. Orchestrator can install skills via `install_skill` action during orchestration.

OpenClaw-inspired prompt gating:

- Skills with frontmatter `disable-model-invocation: true` remain installed and listable.
- Those skills are excluded from model prompt injection, matching OpenClaw behavior.

Orchestrator loading model:

- At orchestration loop start, OpenGoat resolves orchestrator skills once (snapshot style).
- That snapshot is reused for every planner step in the run.
- For internal HTTP providers (OpenAI/OpenRouter/Grok), planner/model execution goes through the shared Vercel AI SDK runtime.

Plugin sources:

- OpenClaw-compatible plugins installed through `opengoat plugin ...` are stored in
  `~/.opengoat/openclaw-compat`.
- OpenGoat auto-detects plugin `skills` dirs from `openclaw.plugin.json` (or default `<plugin>/skills`).
- These plugin skill dirs are injected into the same merged skill resolution path used by providers.

## Sessions

Run vs Session:

- Run:
  - one top-level `opengoat agent ...` execution
  - identified by `runId`
  - transient run artifacts live under `~/.opengoat/sessions/<run-id>/`
- Session:
  - conversational continuity for an agent across runs
  - stored under `~/.opengoat/agents/<agent-id>/sessions/`
  - bound to one working path for its lifetime

Working path rule:

- Different sessions may use different working paths.
- The same session id cannot switch working paths.
- If a run targets the same session key but with a different working path, OpenGoat rotates to a new session id automatically.

Git bootstrap on session setup:

- During session preparation, OpenGoat checks whether the working path is a Git work tree.
- If not, OpenGoat initializes a repository (`git init`) in that working path.
- If Git tooling is unavailable, OpenGoat continues without failing session setup.

Each agent has isolated session storage:

- `~/.opengoat/agents/<agent-id>/sessions/sessions.json`
- `~/.opengoat/agents/<agent-id>/sessions/<session-id>.jsonl`

Session config is read from:

- `~/.opengoat/agents/<agent-id>/config.json`
  - `runtime.sessions.reset`
  - `runtime.sessions.pruning`
  - `runtime.sessions.compaction`

Per run, OpenGoat:

1. resolves session key/id
2. injects pruned session context into prompt
3. appends user/assistant messages to transcript
4. applies compaction when thresholds are reached

## Provider Sessions (New)

OpenGoat now tracks two distinct session layers:

- OpenGoat session:
  - internal transcript/session state managed by OpenGoat
  - key/id stored under `~/.opengoat/agents/<agent-id>/sessions/`
- Provider session:
  - provider-native conversation id (if provider supports it)
  - examples:
    - Cursor chat id (`--resume <chatId>`)
    - OpenCode session id (`--session <id>`)

Important:

- Provider session support is optional per provider.
- Providers that do not support provider sessions continue to work without changes.
- OpenGoat never requires provider sessions globally.

## Task Threads and Provider Session Routing

Delegation actions can include task-thread metadata:

- `taskKey`: stable thread id for related work
- `sessionPolicy`:
  - `new`: force a fresh task thread/session
  - `reuse`: reuse existing thread/session for that task key
  - `auto`: reuse when available, otherwise create new

OpenGoat maintains a per-run task-thread ledger:

- task key
- delegated agent
- provider id
- provider session id (when available)
- OpenGoat session key/id
- created/updated step
- last response summary

This ledger is injected into the planner prompt as `Known task threads` so orchestrator AI can decide:

- when to start new task threads
- when to route follow-ups to existing task threads
- which provider session id should receive a follow-up

## Example: Multi-Task + QA Feedback

1. Orchestrator delegates feature implementation task A to Developer with:
   - `taskKey=task-a`
   - `sessionPolicy=new`
2. OpenGoat starts a new provider session for that developer task and records it in the thread ledger.
3. QA reviews output and returns feedback.
4. Orchestrator sends follow-up to Developer with:
   - `taskKey=task-a`
   - `sessionPolicy=reuse`
5. OpenGoat routes that follow-up to the same provider session id that originally handled task A.

This enables flexible AI-driven orchestration while preserving continuity for each task thread.

## Safety Limits

Orchestration loop is bounded by:

- max orchestration steps
- max delegation steps
- invalid target checks
- fallback response when planner output is malformed

These safeguards prevent infinite loops and uncontrolled delegation chains.

## Trace and Observability

Each run writes:

- `~/.opengoat/runs/<run-id>.json`

Trace includes:

- routing metadata
- orchestration steps
- planner decisions
- delegation calls
- artifact reads/writes
- session graph (nodes/edges)
- provider session ids (when available)
- task thread ledger (`taskThreads`)
- per-invocation working tree side-effect summaries (when Git status is available)
- final output

Side-effect capture strategy:

- OpenGoat captures `git status --porcelain` before and after each agent invocation in the session working path.
- It computes a touched-path delta and records a compact summary in orchestration step logs.
- These summaries are fed back into shared orchestration notes so the planner can reason about recent filesystem effects.

## Scenario Testing

Scenario model:

- `./packages/core/src/core/scenarios/domain/scenario.ts`

Runner:

- `./packages/core/src/core/scenarios/application/scenario-runner.service.ts`

CLI:

- `opengoat scenario run --file <scenario.json> --mode live|scripted`

Modes:

- `live`: uses currently configured providers/agents.
- `scripted`: deterministic provider behavior from scenario file.

This allows fast deterministic tests and realistic integration tests with real providers.

## ACP Integration

OpenGoat exposes its orchestration runtime through ACP so editor clients can drive sessions through a standard protocol.

- ACP adapter: `./packages/core/src/core/acp/application/acp-agent.ts`
- Node stdio server: `./packages/core/src/platform/node/acp-server.ts`
- CLI entrypoint: `opengoat acp`

ACP prompt turns map to `OpenGoatService.runAgent(...)`, so the same orchestrator behavior is reused without a separate execution path.

## Recommended Contributor Workflow

1. Add or update agent metadata in `AGENTS.md`.
2. Run scripted scenarios for deterministic regression checks.
3. Run live scenarios against a sandbox repo for real-provider validation.
4. Inspect `runs/<run-id>.json` when debugging orchestration decisions.
