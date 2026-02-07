# OpenGoat: Full Project Context

This document captures the current product intent, architecture, runtime model, and implementation strategy of OpenGoat.

Use this as a blueprint to rebuild an equivalent project from scratch.

## 1) What OpenGoat Is

OpenGoat is an AI agent orchestration platform with a CLI-first interface.

Primary goal:

- The user talks to one default orchestrator agent (`orchestrator`).
- The orchestrator decides, using AI, whether to:
  - answer directly,
  - delegate work to specialized agents,
  - coordinate through artifacts,
  - install skills,
  - or finish.

The architecture is modular so the same core can support:

- CLI (today),
- desktop app (now bootstrapped in monorepo),
- server/API (future).

Repository/workspace tooling:

- `pnpm` workspace monorepo (`pnpm-workspace.yaml`, `packages/*`).

## 2) Product Purpose

OpenGoat exists to coordinate many agents and providers in one unified runtime.

It is designed for:

- multi-agent workflows,
- provider-agnostic execution (CLI tools + HTTP APIs),
- durable context via Markdown/JSON files,
- traceability of decisions and side effects.

## 3) Key Product Rules

1. `orchestrator` is always the default inbound agent.
2. Every agent has exactly one provider binding.
3. Agent metadata is minimal and markdown-driven (`AGENTS.md` front matter).
4. Workspace state is markdown/json-first.
5. External providers should not require or receive internal workspace paths.
6. Runs and sessions are distinct concepts.

## 4) Core Terminology

- Agent:

  - A logical worker with metadata, provider binding, and runtime state.

- Orchestrator:

  - The default entry agent.
  - Runs the AI planning/delegation loop.

- Workspace Path:

  - Durable agent-owned path: `~/.opengoat/workspaces/<agent-id>`.
  - Used for persistent agent context and artifacts owned by that agent.

- Working Path:

  - Execution/project path where changes happen.
  - Defaults to caller cwd (or explicit `--cwd`).
  - Bound to a session identity.

- Run:

  - One top-level invocation (e.g. `opengoat agent --message ...`).
  - Has `runId`.
  - Writes run trace in `~/.opengoat/runs/<run-id>.json`.
  - Writes transient orchestration artifacts under `~/.opengoat/sessions/<run-id>/`.

- Session (OpenGoat session):

  - Agent continuity across runs.
  - Stored under `~/.opengoat/agents/<agent-id>/sessions/`.
  - Keeps transcript/history, pruning, compaction.
  - One session id must map to one working path.

- Provider Session:

  - Provider-native conversation/thread ID (optional; provider-dependent).
  - Examples: Cursor chat id, OpenCode session id.

- Task Thread:
  - Orchestrator-level work thread (`taskKey`) that can reuse provider sessions.

## 5) High-Level Architecture

Code is domain-organized:

- `packages/core/src/core/opengoat`:

  - Facade API (`OpenGoatService`) used by app surfaces.

- `packages/core/src/core/bootstrap`:

  - Initializes OpenGoat home and seeds default orchestrator.

- `packages/core/src/core/agents`:

  - Agent lifecycle + manifest parsing.

- `packages/core/src/core/providers`:

  - Provider contract, registry, loader, service, implementations.

- `packages/core/src/core/orchestration`:

  - Routing + AI planner loop + delegation runtime.

- `packages/core/src/core/sessions`:

  - Session lifecycle, transcripts, pruning/compaction, history APIs.

- `packages/core/src/core/skills`:

  - Skill resolution/install and prompt injection.

- `packages/core/src/core/plugins`:

  - OpenClaw-compatible plugin lifecycle.

- `packages/core/src/core/acp`:

  - Agent Client Protocol integration.

- `packages/core/src/platform/node`:

  - Node adapters (filesystem, paths, command runner, logger, ACP server transport).

- `packages/cli/src/cli`:
  - CLI commands + routing + formatting only.
- `packages/electron`:
  - Electron desktop shell (Forge + React + Zustand + tRPC IPC), reusing core runtime.

Design intent:

- core domains are reusable outside CLI.
- platform adapters are replaceable.

## 6) Filesystem Model

OpenGoat home defaults to `~/.opengoat` (or `OPENGOAT_HOME`).

Top-level layout:

- `config.json` (global config)
- `agents.json` (registered agent ids)
- `CONFIG.md` (human-readable home info)
- `workspaces/` (agent durable workspace files)
- `agents/` (agent internal machine config/state/session store)
- `skills/` (managed shared skills)
- `providers/` (provider env config)
- `sessions/` (transient per-run orchestration artifacts)
- `runs/` (run traces)

Per-agent:

- Workspace: `~/.opengoat/workspaces/<agent-id>/...`
- Internal config: `~/.opengoat/agents/<agent-id>/...`
- Session store: `~/.opengoat/agents/<agent-id>/sessions/sessions.json`
- Transcript files: `~/.opengoat/agents/<agent-id>/sessions/<session-id>.jsonl`

## 7) Agent Model

Agent metadata source of truth is `AGENTS.md` front matter:

- `id`
- `name`
- `description`
- `provider`
- `tags`
- `delegation.canReceive`
- `delegation.canDelegate`
- `priority`

Default behavior:

- `orchestrator` can delegate.
- other agents default to delegated specialists.

## 8) Provider Model

Provider type:

- `cli`
- `http`

Capabilities:

- `agent`
- `model`
- `auth`
- `passthrough`

Auto-discovery:

- providers are discovered from `packages/core/src/core/providers/providers/<provider-id>/index.ts`.
- each provider folder is self-contained (code + tests + onboarding metadata).

Runtime profile:

- agents resolve to `workspaceAccess`:
  - `internal` | `external` | `auto`.
- defaults:
  - orchestrator -> internal
  - non-orchestrator + HTTP provider -> internal
  - non-orchestrator + CLI provider -> external

Meaning:

- internal:
  - receives workspace bootstrap+skills context injection.
- external:
  - no internal workspace context injection.
  - invoked in working path context.

## 9) Session System

Session inputs:

- `sessionRef`
- `forceNewSession`
- `disableSession`
- `workingPath` (default cwd)

Session output:

- `sessionKey`
- `sessionId`
- `transcriptPath`
- `workspacePath`
- `workingPath`
- `isNewSession`

Important invariant:

- same session id cannot switch working path.
- if session key reused with different working path:
  - OpenGoat rotates to new session id automatically.

Session behavior:

- header + user/assistant messages in JSONL transcript.
- context injected each run from pruned transcript history.
- supports reset policy (`daily`/`idle`), pruning, compaction.

Git bootstrap during session init:

- on session preparation, OpenGoat checks whether working path is a Git work tree.
- if not, it attempts `git init --quiet`.
- if git tooling unavailable, session still works (non-fatal).

## 10) Orchestration Runtime

Entry:

- user message to orchestrator.

Loop:

- max-step + max-delegation bounded AI loop.
- planner prompt includes:
  - user message,
  - known agents,
  - shared notes,
  - recent events,
  - task-thread summaries.

Actions:

- `delegate_to_agent`
- `read_workspace_file`
- `write_workspace_file`
- `install_skill`
- `respond_user`
- `finish`

Delegation modes:

- `direct`
- `artifacts`
- `hybrid`

Task-thread support:

- `taskKey` and `sessionPolicy (auto|new|reuse)`
- enables provider-session reuse for follow-up feedback cycles.

## 11) Transient Artifacts vs Durable State

Transient run coordination:

- `~/.opengoat/sessions/<run-id>/...`

Durable agent-owned state:

- `~/.opengoat/workspaces/<agent-id>/...`

External agent rule:

- external providers should not depend on local internal path semantics.
- OpenGoat can still use internal artifacts for itself.

## 12) Side-Effect Tracking (Industry Baseline)

For each provider invocation, OpenGoat captures:

- pre-run `git status --porcelain`
- post-run `git status --porcelain`

Then computes:

- touched paths delta,
- summary (`Touched N path(s): ...` or no changes).

This is recorded in orchestration step logs and fed into planner shared notes so the orchestrator can reason about filesystem effects in subsequent decisions.

Why this approach:

- simple, deterministic, language/tool agnostic,
- widely used baseline for working-tree diff detection,
- low coupling to provider internals.

## 13) Traceability

Every run writes:

- `~/.opengoat/runs/<run-id>.json`

Trace includes:

- routing decision,
- execution result,
- orchestration steps,
- delegation calls,
- artifact IO,
- session graph,
- task threads,
- provider session ids,
- working-tree side-effect summaries.

## 14) Skills System

Skill sources:

- managed: `~/.opengoat/skills/<skill-id>/SKILL.md`
- workspace: `~/.opengoat/workspaces/<agent-id>/skills/<skill-id>/SKILL.md`
- plugin-derived skill dirs (OpenClaw-compatible plugins)

Resolution precedence:

- workspace > plugin > managed

Usage:

- bounded skills prompt injected into system prompt.
- orchestrator can install skills via action.
- users can install via CLI.

## 15) Plugin System (OpenClaw Compatibility)

OpenClaw-compatible plugin support:

- install/list/info/enable/disable/doctor.
- runtime state under `~/.opengoat/openclaw-compat`.
- plugin skills auto-integrate into skill resolution.

Compatibility goal:

- reuse OpenClaw plugin ecosystem with minimal reimplementation.

## 16) ACP Integration

OpenGoat implements ACP over stdio for editor integration:

- initialize/new/load/resume/list/prompt/cancel flows.
- ACP prompt calls route through same `OpenGoatService.runAgent(...)` path.
- supports metadata aliases for agent/session flags.

Reference docs:

- `docs/acp.md`

## 17) CLI Surface

Main commands:

- `opengoat init`
- `opengoat agent --message ...`
- `opengoat agent run ...`
- `opengoat route ...`
- `opengoat session ...`
- `opengoat skill ...`
- `opengoat plugin ...`
- `opengoat provider list`
- `opengoat onboard`
- `opengoat scenario run ...`
- `opengoat acp ...`

Global log controls:

- `--log-level <silent|error|warn|info|debug>`
- `--log-format <pretty|json>`

## 18) Configuration Philosophy

OpenGoat uses markdown/json-first state:

- machine-readable JSON for structured config/state,
- markdown for human-guided context and contracts.

This supports:

- inspection,
- reproducibility,
- easy versioning in source control.

## 19) Current Provider Landscape

Built-ins include:

- codex, claude, cursor, gemini, grok, openai, openrouter, opencode, openclaw

Also includes a broad native HTTP provider catalog (Anthropic, Bedrock, Groq, Mistral, Moonshot, MiniMax, Qwen, Vercel AI Gateway, and others).

Provider onboarding metadata defines:

- required env fields,
- auth flow hints.

## 20) Quality and Maintainability Standards

The project is structured for many contributors:

- domain-oriented modules,
- provider-per-folder isolation,
- centralized contracts in `core/ports` and `core/domain`,
- strong test coverage across core + CLI + scenarios + providers,
- non-destructive compatibility approach for plugins/providers.

Expected baseline workflow:

1. implement in the relevant domain module,
2. add/update tests near domain/provider,
3. run full test suite and build,
4. verify trace output for orchestration changes.

## 21) Suggested Rebuild Plan (If Starting Fresh)

Phase 1: Foundations

- filesystem home/path model
- bootstrap + default orchestrator
- agent lifecycle + metadata parsing

Phase 2: Provider substrate

- provider contract + registry + auto-loader
- one CLI provider + one HTTP provider
- onboarding/config persistence

Phase 3: Sessions

- per-agent session store/transcripts
- reset/prune/compact rules
- working-path invariant

Phase 4: Orchestration core

- routing + planner prompt
- delegation loop with safety limits
- trace persistence

Phase 5: Advanced orchestration

- task threads
- provider-session support
- side-effect tracking via git status

Phase 6: Extensibility

- skills
- plugin compatibility layer
- ACP integration

Phase 7: Product hardening

- scenario runner
- structured logging
- full e2e and regression suite

## 22) Non-Goals / Cautions

- Do not hardcode fixed workflows (e.g., PM -> Dev -> QA only).
- Keep orchestration decision-making AI-driven and metadata/context-based.
- Do not force external providers to rely on local internal paths.
- Keep orchestrator as immutable default inbound agent.

## 23) Where to Look in This Repository

- Product overview:
  - `README.md`
- Orchestration deep dive:
  - `docs/orchestration-flow.md`
- ACP deep dive:
  - `docs/acp.md`
- Core facade:
  - `packages/core/src/core/opengoat/application/opengoat.service.ts`
- Orchestration runtime:
  - `packages/core/src/core/orchestration/application/orchestration.service.ts`
- Session runtime:
  - `packages/core/src/core/sessions/application/session.service.ts`
- Provider runtime:
  - `packages/core/src/core/providers/application/provider.service.ts`
