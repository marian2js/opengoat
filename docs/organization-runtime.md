# OpenGoat Organization Runtime

This document describes the current organization-first runtime model.

## Runtime Premise

- all OpenGoat agents are OpenClaw agents
- `goat` is the default manager (head/CEO)
- hierarchy is explicit in agent metadata
- manager behavior is skill-driven (`manager` skill)
- OpenClaw owns workspace bootstrap semantics; OpenGoat pre-seeds `goat` `AGENTS.md` + `SOUL.md` and removes `BOOTSTRAP.md`

## Execution Flow

For `opengoat agent ...`:

1. resolve target agent (fallback to `goat` if missing)
2. prepare/resolve the agent session id
3. invoke that OpenClaw agent directly with `--session-id <opengoat-session-id>`
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

Skills are delegated to OpenClaw.

- OpenClaw loads bundled skills, managed skills (`~/.openclaw/skills`), and workspace-local `skills/`
- OpenGoat stores per-agent skill assignment metadata
- manager capability is represented by assigned `manager` skill

## Sessions

Session behavior:

- continuity per agent/session key
- tied to working path
- same key + different path rotates to a new session id
- OpenGoat session id is the OpenClaw session id for that session (1:1 mapping)

Storage:

- session transcripts: `agents/<agent-id>/sessions/`
- run traces: `runs/`

## Key Files

- manager runtime service: `packages/core/src/core/orchestration/application/orchestration.service.ts`
- routing helper: `packages/core/src/core/orchestration/application/routing.service.ts`
- agent manifest derivation: `packages/core/src/core/agents/application/agent-manifest.service.ts`
- skill resolution/install: `packages/core/src/core/skills/application/skill.service.ts`
- session lifecycle: `packages/core/src/core/sessions/application/session.service.ts`
