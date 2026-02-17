# OpenGoat: Architecture Context

This document is the current architecture reference for OpenGoat.

## 1) Product Definition

OpenGoat is a CLI-first organization runtime.

Current policy:

- `ceo` is always bound to OpenClaw
- every agent has a runtime provider binding (`runtime.provider.id`)
- default provider binding is `openclaw` unless explicitly changed
- `ceo` is the immutable default manager (head of organization)
- organizations are hierarchical (`reportsTo`)
- managers act through skills, not hardcoded control-flow logic

## 2) Core Rules

1. `ceo` is always the default entry agent.
2. `ceo` cannot be deleted.
3. OpenGoat is source of truth for which agents exist.
4. creating/deleting an OpenGoat agent syncs create/delete in OpenClaw.
5. managers only manage direct reportees by org definition.
6. sessions are preserved per agent + session key/id.
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

- `ceo`: `type=manager`, `reportsTo=null`, assigned `og-boards` skill
- other agents: `type=individual`, `reportsTo=ceo`

## 4) Manager Runtime Model

OpenGoat runs the selected agent directly through OpenClaw.

Important change:

- OpenGoat no longer runs an internal planner/delegation loop.
- manager behavior (including how to delegate) is expressed by skills + prompts + org metadata.

`route` remains a dry-run helper for suggested direct-report routing only.

## 5) Skills

Role skills are provider-aware.

Assignment model:

- OpenGoat stores assignment metadata per agent
- OpenGoat installs role skills into provider-specific workspace directories:
  - `openclaw`: `skills/`
  - `claude-code`: `.claude/skills/`
  - `codex`: `.agents/skills/`
  - `cursor`: `.cursor/skills/`
  - `opencode`: `.opencode/skills/`
  - `gemini-cli`: `.gemini/skills/`

Agent runtime config stores assignment under `runtime.skills.assigned`.

Role skills remain mutually exclusive per agent:

- managers: `og-boards`
- individuals: `og-boards`

## 6) OpenClaw Integration

OpenGoat integrates OpenClaw for:

- CEO/runtime execution when agent provider is `openclaw`
- agent create/delete sync for OpenClaw-managed agents
- onboarding/auth passthrough where needed

Onboarding (`opengoat onboard`) only configures OpenClaw gateway mode:

- `local`
- `external` (+ URL + token)

## 7) Provider Commands

`provider` commands in OpenGoat are runtime provider controls:

- `opengoat provider list`
- `opengoat agent provider get <agent-id>`
- `opengoat agent provider set <agent-id> <provider-id>`

## 8) Sessions

Session invariants:

- session binds to agent + session key/id
- OpenGoat derives OpenClaw session key `agent:<agent-id>:<opengoat-session-id>` for every run in the session
- runtime invocation policy is provider-driven:
  - `openclaw`: provider-default invocation (OpenGoat does not override cwd/path)
  - non-`openclaw` providers: use the agent workspace path

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
6. sessions preserve continuity by agent + session key/id.
7. session ids map 1:1 to OpenClaw session keys (`agent:<agent-id>:<session-id>`) during runs.
8. run traces are persisted under `runs/`.

## 13) Extensibility

Architecture keeps adapter boundaries so new runtimes can be added by
registering provider modules, without changing orchestration/session flow.

Built-in provider modules are registered in one place:
`packages/core/src/core/providers/providers/registry.ts`.
