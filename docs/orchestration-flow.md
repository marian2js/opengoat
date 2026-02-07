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
  - `/Users/marian2js/workspace/opengoat/src/core/orchestration/application/orchestration.service.ts`
- Planner prompt + decision parsing:
  - `/Users/marian2js/workspace/opengoat/src/core/orchestration/application/orchestration-planner.service.ts`
- Session lifecycle + transcripts:
  - `/Users/marian2js/workspace/opengoat/src/core/sessions/application/session.service.ts`
- Provider invocation + system prompt build:
  - `/Users/marian2js/workspace/opengoat/src/core/providers/application/provider.service.ts`

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
- final output

## Scenario Testing

Scenario model:

- `/Users/marian2js/workspace/opengoat/src/core/scenarios/domain/scenario.ts`

Runner:

- `/Users/marian2js/workspace/opengoat/src/core/scenarios/application/scenario-runner.service.ts`

CLI:

- `opengoat scenario run --file <scenario.json> --mode live|scripted`

Modes:

- `live`: uses currently configured providers/agents.
- `scripted`: deterministic provider behavior from scenario file.

This allows fast deterministic tests and realistic integration tests with real providers.

## Recommended Contributor Workflow

1. Add or update agent metadata in `AGENTS.md`.
2. Run scripted scenarios for deterministic regression checks.
3. Run live scenarios against a sandbox repo for real-provider validation.
4. Inspect `runs/<run-id>.json` when debugging orchestration decisions.
