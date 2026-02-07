# OpenGoat Orchestration Flow

This document explains the current orchestration architecture in OpenGoat, including AI-driven delegation, sessions, artifact-based coordination, and scenario testing.

## Goals

- Keep agent setup minimal:
  - `name`
  - `description`
  - `provider`
- Let the orchestrator decide the flow dynamically with AI.
- Support both:
  - direct agent-to-agent communication
  - markdown artifact coordination
- Persist full execution state for debugging and replay.

## Core Components

- Orchestration runtime:
  - `./src/core/orchestration/application/orchestration.service.ts`
- Planner prompt + decision parsing:
  - `./src/core/orchestration/application/orchestration-planner.service.ts`
- Session lifecycle + transcripts:
  - `./src/core/sessions/application/session.service.ts`
- Provider invocation + system prompt build:
  - `./src/core/providers/application/provider.service.ts`

## High-Level Runtime

1. User sends a message to `orchestrator`.
2. Orchestrator enters an AI decision loop (`max steps` + `max delegation` guards).
3. On each loop step:

- Build planner prompt with:
  - available agents from `AGENTS.md` metadata
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

- `~/.opengoat/workspaces/orchestrator/coordination/<run-id>/`

Then target response is captured back into markdown files.

### Hybrid

Combines direct invocation and markdown handoff artifacts.

## Skills

Skill directories:

- Managed: `~/.opengoat/skills/<skill-id>/SKILL.md`
- Per-agent workspace: `~/.opengoat/workspaces/<agent-id>/skills/<skill-id>/SKILL.md`

Precedence:

- workspace skill overrides plugin/managed skill with the same id.
- plugin skill overrides managed skill with the same id.

Runtime behavior:

1. OpenGoat resolves merged skills for the running agent.
2. A bounded skills section is injected into the system prompt.
3. Agents can self-install/update by creating `skills/<skill-id>/SKILL.md` in their workspace.
4. Orchestrator can install skills via `install_skill` action during orchestration.

Plugin sources:

- OpenClaw-compatible plugins installed through `opengoat plugin ...` are stored in
  `~/.opengoat/openclaw-compat`.
- OpenGoat auto-detects plugin `skills` dirs from `openclaw.plugin.json` (or default `<plugin>/skills`).
- These plugin skill dirs are injected into the same merged skill resolution path used by providers.

## Sessions

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
- final output

## Scenario Testing

Scenario model:

- `./src/core/scenarios/domain/scenario.ts`

Runner:

- `./src/core/scenarios/application/scenario-runner.service.ts`

CLI:

- `opengoat scenario run --file <scenario.json> --mode live|scripted`

Modes:

- `live`: uses currently configured providers/agents.
- `scripted`: deterministic provider behavior from scenario file.

This allows fast deterministic tests and realistic integration tests with real providers.

## ACP Integration

OpenGoat exposes its orchestration runtime through ACP so editor clients can drive sessions through a standard protocol.

- ACP adapter: `./src/core/acp/application/acp-agent.ts`
- Node stdio server: `./src/platform/node/acp-server.ts`
- CLI entrypoint: `opengoat acp`

ACP prompt turns map to `OpenGoatService.runAgent(...)`, so the same orchestrator behavior is reused without a separate execution path.

## Recommended Contributor Workflow

1. Add or update agent metadata in `AGENTS.md`.
2. Run scripted scenarios for deterministic regression checks.
3. Run live scenarios against a sandbox repo for real-provider validation.
4. Inspect `runs/<run-id>.json` when debugging orchestration decisions.
