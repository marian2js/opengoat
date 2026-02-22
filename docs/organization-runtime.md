# OpenGoat Organization Runtime

This document describes the current organization-first runtime model.

## Runtime Premise

- `ceo` is always an OpenClaw agent
- each agent has a provider binding (`runtime.provider.id`)
- default provider is `openclaw` unless overridden per agent
- `ceo` is the root manager (head/CEO)
- default entry agent resolves from `OPENGOAT_DEFAULT_AGENT`, then `config.defaultAgent`, then `ceo`
- hierarchy is explicit in agent metadata
- manager behavior is skill-driven (provider-specific role skills)
- OpenClaw owns workspace bootstrap semantics; OpenGoat pre-seeds `ceo` `ROLE.md` and replaces `BOOTSTRAP.md` after OpenClaw bootstrap
- OpenGoat also creates `~/.opengoat/organization` and seeds default organization `.md` files there on startup
- task assignment is constrained to self or reportees (direct or indirect)
- task updates are constrained to self-owned/self-assigned tasks or reportee tasks (direct or indirect)

## Execution Flow

For `opengoat agent ...`:

1. resolve target agent (fallback to configured default entry agent)
2. prepare/resolve the agent session id
3. invoke the bound provider for the target agent
4. record assistant reply into session transcript
5. persist run trace (`runs/<run-id>.json`)

OpenGoat does not run an internal delegation/planner loop.

## Organization Hierarchy

Hierarchy lives in `agents/<agent-id>/config.json`:

- `organization.type: manager | individual`
- `organization.reportsTo: <agent-id> | null`

OpenGoat maintains this hierarchy as source-of-truth and syncs agent lifecycle with OpenClaw.

Restructure reporting with:

- `opengoat agent set-manager <agent-id> <manager-id|none>`

## Routing Helper (`opengoat route`)

`route` is a dry-run helper only.

- it checks whether entry agent has manager capability
- it scores only direct reportees
- it returns a suggested target agent + rewritten delegation message

It does not execute delegated calls.

## Skills

Role skill materialization is provider-aware.

- OpenGoat stores per-agent skill assignment metadata
- manager capability is represented by provider-specific role skills
- role skills are workspace-installed and assignment-synced:
  - `openclaw`:
    - managers: `og-board-manager`
    - individuals: `og-board-individual`
  - non-`openclaw` providers:
    - managers: `og-boards`
    - individuals: `og-boards`
- provider-specific workspace directories:
  - `openclaw`: `skills/`
  - `claude-code`: `.claude/skills/`
  - `codex`: `.agents/skills/`
  - `copilot-cli`: `.copilot/skills/`
  - `cursor`: `.cursor/skills/`
  - `opencode`: `.opencode/skills/`
  - `gemini-cli`: `.gemini/skills/`
- role skills are mutually exclusive per agent

## Sessions

Session behavior:

- continuity per agent/session key
- OpenGoat session id maps to OpenClaw session key `agent:<agent-id>:<session-id>` (1:1 mapping)
- provider runtime policy controls cwd:
  - `openclaw`: provider-default invocation (OpenGoat does not override cwd/path)
  - non-`openclaw` providers: use agent workspace path

Storage:

- session transcripts: `agents/<agent-id>/sessions/`
- run traces: `runs/`

## Key Files

- manager runtime service: `packages/core/src/core/orchestration/application/orchestration.service.ts`
- routing helper: `packages/core/src/core/orchestration/application/routing.service.ts`
- agent manifest derivation: `packages/core/src/core/agents/application/agent-manifest.service.ts`
- skill resolution/install: `packages/core/src/core/skills/application/skill.service.ts`
- session lifecycle: `packages/core/src/core/sessions/application/session.service.ts`
