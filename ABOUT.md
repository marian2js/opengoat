# OpenGoat: Architecture Context

This document is the current architecture reference for OpenGoat.

## 1) Product Definition

OpenGoat is a CLI-first organization runtime.

Current policy:

- every OpenGoat agent is an OpenClaw agent
- `ceo` is the immutable default manager (head of organization)
- organizations are hierarchical (`reportsTo`)
- managers act through skills, not hardcoded control-flow logic

## 2) Core Rules

1. `ceo` is always the default entry agent.
2. `ceo` cannot be deleted.
3. OpenGoat is source of truth for which agents exist.
4. creating/deleting an OpenGoat agent syncs create/delete in OpenClaw.
5. managers only manage direct reportees by org definition.
6. sessions are preserved and tied to project path.
7. each OpenGoat session maps 1:1 to an OpenClaw session key.
8. agents can assign tasks only to themselves or their reportees (direct or indirect).
9. agents can update their own tasks and tasks of their reportees (direct or indirect).

## 3) Agent Model

Agent metadata is stored in `agents/<agent-id>/config.json`.

Canonical fields:

- `id`
- `displayName`
- `description`
- `organization.type: manager | individual`
- `organization.reportsTo: <agent-id> | null`
- `organization.discoverable`
- `organization.tags`
- `organization.priority`
- `runtime.skills.assigned`

Defaults:

- `ceo`: `type=manager`, `reportsTo=null`, assigned `og-board-manager` skill
- other agents: `type=individual`, `reportsTo=ceo`

## 4) Manager Runtime Model

OpenGoat runs the selected agent directly through OpenClaw.

Important change:

- OpenGoat no longer runs an internal planner/delegation loop.
- manager behavior (including how to delegate) is expressed by skills + prompts + org metadata.

`route` remains a dry-run helper for suggested direct-report routing only.

## 5) Skills

OpenClaw is the skills runtime authority.

Assignment model:

- OpenClaw loads bundled skills, managed skills (`~/.openclaw/skills`), and workspace `skills/`
- OpenGoat stores assignment metadata per agent

Agent runtime config stores assignment under `runtime.skills.assigned`.

OpenGoat pre-installs role skills in each agent workspace so OpenClaw can resolve them:

- managers: `og-board-manager`
- individuals: `og-board-individual`

Role skills are mutually exclusive per agent. OpenGoat does not install role
skills into OpenClaw shared managed skills.

`ceo` receives manager role skills by default under `workspaces/ceo/skills/`.

## 6) OpenClaw Integration

OpenGoat integrates OpenClaw for:

- agent execution
- agent create/delete sync
- onboarding/auth passthrough where needed

Onboarding (`opengoat onboard`) only configures OpenClaw gateway mode:

- `local`
- `external` (+ URL + token)

## 7) Provider Commands

`provider` commands in OpenGoat are passthrough wrappers:

- `opengoat provider list`
- `opengoat agent provider get <agent-id>`
- `opengoat agent provider set <agent-id> <provider-id>`

No custom multi-provider business logic is implemented in OpenGoat core.

## 8) Sessions

Session invariants:

- session binds to agent + session key/id + project path
- if the same session key is reused with a different path, OpenGoat rotates to a new session id
- if a follow-up run omits project path, OpenGoat reuses the stored project path for that session key
- OpenGoat derives OpenClaw session key `agent:<agent-id>:<opengoat-session-id>` for every run in the session
- runtime invocation reuses session project path for cwd and injects project context when workspace and project paths differ

Storage:

- `agents/<agent-id>/sessions/` for transcripts + session store
- `runs/` for run traces

## 9) Filesystem Layout

OpenGoat home default: `~/.opengoat`

Main structure:

- `config.json`
- `agents.json`
- `workspaces/` (OpenClaw workspace paths)
- `organization/` (organization-level markdown defaults copied from templates on startup)
- `agents/`
- `skills/` (optional compatibility store; created on first `opengoat skill install`)
- `providers/` (OpenClaw runtime connectivity config)
- `runs/`

OpenClaw owns workspace bootstrap markdown semantics.

OpenGoat pre-seeds `workspaces/ceo/ROLE.md` and replaces `BOOTSTRAP.md`
for the default manager after OpenClaw bootstrap.
OpenGoat also pre-seeds `organization/*.md` from `packages/core/src/core/templates/assets/organization/`.

## 10) Module Layout

Core modules:

- `core/opengoat` facade (`OpenGoatService`)
- `core/bootstrap`
- `core/agents`
- `core/orchestration` (manager runtime service + routing helper; legacy module name)
- `core/sessions`
- `core/skills`
- `core/providers` (OpenClaw runtime adapter)
- `core/acp`

CLI module:

- `packages/cli/src/cli`

Optional UI extension module:

- `packages/ui/src/server` (Fastify API + single-port host)
- `packages/ui/src/client` (React/Vite app with sidebar management UI)

## 11) Legacy Removed

- plugin system
- OpenGoat-side multi-provider runtime implementations
- internal AI planner/delegation loop
- onboarding provider selection flow

## 12) Rebuild Checklist

If rebuilding from scratch, preserve these behaviors:

1. bootstrap creates `ceo`, core OpenGoat state, and pre-seeded `ceo` workspace markdown (`ROLE.md`).
2. `agent create` creates local state and syncs OpenClaw create.
3. `agent delete` syncs OpenClaw delete and removes local state.
4. `ceo` is undeletable.
5. onboarding only configures OpenClaw local/external gateway.
6. sessions enforce project-path safety/rotation.
7. session ids map 1:1 to OpenClaw session keys (`agent:<agent-id>:<session-id>`) during runs.
8. run traces are persisted under `runs/`.

## 13) Extensibility

Architecture keeps adapter boundaries so non-OpenClaw runtimes can be added later.

Current implementation intentionally supports only OpenClaw.
