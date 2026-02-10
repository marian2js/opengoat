<h1 align="center">OpenGoat</h1>
<p align="center"><strong>The open-source OpenClaw-first agent organization runtime.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/opengoat"><img src="https://img.shields.io/npm/v/opengoat?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/marian2js/opengoat/actions"><img src="https://img.shields.io/github/actions/workflow/status/marian2js/opengoat/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square" alt="Node >= 20.11" />
</p>

---

## What OpenGoat Is

OpenGoat is a CLI-first organization layer where:

- every OpenGoat agent maps 1:1 to an OpenClaw agent
- `goat` is the default manager (head of organization)
- managers have direct reportees (`reportsTo` hierarchy)
- skills are centralized and assigned per agent

OpenGoat is source-of-truth for organization structure.
When you create/delete an OpenGoat agent, OpenGoat syncs create/delete in OpenClaw.

## Core Runtime Model

### 1. Organization Runtime (Skill-Driven)

OpenGoat does not run an internal delegation engine.

`opengoat agent ...` runs the selected OpenClaw agent directly.
Manager behavior is provided by the assigned `manager` skill and org metadata.

### 2. Hierarchy

Hierarchy is defined in `AGENTS.md` front matter:

- `type: manager | individual`
- `reportsTo: <agent-id> | null`

`goat` is the default top-level manager (`reportsTo: null`).

### 3. Skills

Skills live under `~/.opengoat/skills` and are assigned per agent.

- centralized install (`--global`)
- centralized install + assignment to one agent

Manager capability is a skill (`manager`), aligned with [Agent Skills](https://agentskills.io).

### 4. Sessions

Sessions are first-class and tied to:

- agent/session key
- working path (`cwd`)

OpenGoat rotates session ids when the same session key moves to a different working path.
For session-enabled runs, OpenGoat always invokes OpenClaw with `--session-id <opengoat-session-id>` so every message stays in the same OpenClaw session.

### 5. OpenClaw Gateway Onboarding

Onboarding configures OpenClaw connectivity only:

- `Local Gateway`
- `External Gateway`

No OpenGoat-side provider selection flow.

## Quick Start

```bash
npm i -g opengoat

opengoat init
opengoat onboard
opengoat agent --message "Plan and implement auth refactor"
```

## Docker

Build and run OpenGoat (UI + CLI) in Docker:

```bash
docker build -t opengoat:latest .

# launch UI (Fastify + React assets) on port 19123
docker run --rm -p 19123:19123 -v opengoat-data:/data/opengoat opengoat:latest

# run CLI inside the same image
docker run --rm -v opengoat-data:/data/opengoat opengoat:latest cli --help

# verify bundled OpenClaw binary (installed via npm @latest during image build)
docker run --rm opengoat:latest openclaw --version
```

Using Compose:

```bash
docker compose up --build
docker compose run --rm opengoat cli --help
```

### OpenClaw references

- [Getting Started](https://docs.openclaw.ai/start/getting-started)
- [CLI Onboarding](https://docs.openclaw.ai/cli/onboarding)
- [CLI Agents](https://docs.openclaw.ai/cli/agents)
- [Sub-agents](https://docs.openclaw.ai/agents/sub-agents)
- [Skills](https://docs.openclaw.ai/skills/introduction)

### Non-interactive onboarding examples

```bash
# local OpenClaw runtime
opengoat onboard --local --non-interactive

# external OpenClaw gateway
opengoat onboard --external \
  --gateway-url ws://host:18789 \
  --gateway-token <token> \
  --non-interactive
```

## CLI Reference

### Setup

```bash
opengoat init
opengoat onboard
```

### Agents

```bash
# default agent is goat
opengoat agent --message "Review this project structure"

# explicit target
opengoat agent developer --message "Implement feature X"

# explicit run subcommand
opengoat agent run developer --message "Implement feature X"

# create an individual contributor under goat
opengoat agent create "Developer" --individual --reports-to goat --skill coding --skill testing

# create a manager
opengoat agent create "Team Lead" --manager --reports-to goat --skill manager

# if --reports-to is omitted, new agents default to goat
opengoat agent create "QA Engineer" --individual

# restructure reporting lines
opengoat agent set-manager engineer cto
opengoat agent set-manager cto goat

# delete agent (also synced to OpenClaw)
opengoat agent delete developer
opengoat agent delete developer --force

# list agents
opengoat agent list
```

### Sessions

```bash
opengoat session list
opengoat session history --agent goat
opengoat session reset --agent goat
opengoat session compact --agent goat
opengoat session rename --agent goat --title "Planning"
opengoat session remove --agent goat
```

### Skills

```bash
# list assigned skills for goat
opengoat skill list

# list centralized catalog
opengoat skill list --global

# install + assign manager skill to goat
opengoat skill install manager --from /path/to/skill

# install centralized only
opengoat skill install jira-tools --global --from /path/to/skill
```

### Provider Passthroughs (to OpenClaw)

```bash
opengoat provider list
opengoat agent provider get <agent-id>
opengoat agent provider set <agent-id> <provider-id>
```

These commands do not implement custom provider logic in OpenGoat; they pass through to OpenClaw CLI.

### Other Commands

```bash
opengoat route --message "Who should handle API test coverage?"
opengoat scenario run --file ./scenario.json --mode live
opengoat acp
```

## Optional Gateway (Remote Control)

OpenGoat Gateway is optional and separate from OpenClaw runtime gateway connectivity.

See `docs/gateway.md`.

## Optional UI Extension

OpenGoat remains CLI-first. A separate optional extension package is available:

- `packages/ui` - React/Vite + Fastify management UI (single port, default `19123`)

Run it locally:

```bash
pnpm --filter @opengoat/ui dev
```
## Architecture Snapshot

```
packages/
├── core/
│   └── src/
│       ├── core/         # agents, manager runtime, sessions, skills, OpenClaw runtime adapter modules
│       ├── platform/     # node adapters (fs, paths, command runner, acp transport)
│       └── apps/runtime/ # shared runtime factory
├── cli/
│   └── src/cli/
└── ui/
    └── src/
        ├── server/       # Fastify API + single-port Vite/static hosting
        └── client/       # React UI (shadcn-style components)
```

## Breaking Changes From Legacy Model

- onboarding is OpenClaw gateway-only (`local` or `external`)
- OpenGoat no longer runs an internal AI planner loop
- all OpenGoat agents are OpenClaw agents
- manager behavior is skill-driven (`manager`)
- hierarchy is explicit (`type`, `reportsTo`)
- old multi-provider runtime implementations are removed
- plugin system is removed

## Documentation

- `docs/organization-runtime.md` - current manager/reportee runtime model (skill-driven)
- `docs/acp.md` - ACP integration
- `docs/docker.md` - container image/runtime usage
- `ABOUT.md` - full architecture context

## Contributing

See `CONTRIBUTING.md`.
