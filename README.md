<h1 align="center">OpenGoat</h1>
<p align="center"><strong>Build AI organizations on top of OpenClaw.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/opengoat"><img src="https://img.shields.io/npm/v/opengoat?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/marian2js/opengoat/actions"><img src="https://img.shields.io/github/actions/workflow/status/marian2js/opengoat/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square" alt="Node >= 20.11" />
</p>

OpenGoat is a CLI for running AI teams as organizations, not agent spaghetti.

You define who reports to whom, assign skills, and run work through real roles.  
OpenGoat keeps your org structure as source-of-truth and syncs agent lifecycle to OpenClaw.

## Why OpenGoat

- Organization-first: model managers and reportees with clear hierarchy.
- OpenClaw-native: every OpenGoat agent maps 1:1 to an OpenClaw agent.
- Skill-driven behavior: coordination lives in skills (for example, `board-manager`), not hardcoded orchestration loops.
- Session continuity: each OpenGoat session maps 1:1 to one OpenClaw session id.

## What You Get

- `ceo` as the default head of organization (CEO entry point).
- Hierarchical teams via `reportsTo`.
- OpenClaw-owned skills with per-agent role-skill assignment metadata.
- CLI-first workflows for create, run, restructure, and audit sessions.
- Manager default boards: every manager has a non-deletable default board.
- Task default routing: manager task creation without `<board-id>` uses that manager default board.
- CEO workspace pre-seeded with `AGENTS.md` + `SOUL.md` to skip first-run OpenClaw bootstrap prompts.

## Install

Runtime: Node `>=20.11`.

```bash
npm i -g openclaw@latest opengoat@latest
```

## 2-Minute Start

```bash
# 1) Initialize OpenGoat home (~/.opengoat)
opengoat init

# 2) Connect to OpenClaw (local runtime)
opengoat onboard --local --non-interactive

# 3) Talk to the default organization head (ceo)
opengoat agent --message "Set up a CTO and two engineers for this project."
```

Use an external OpenClaw runtime:

```bash
opengoat onboard --external \
  --gateway-url ws://host:18789 \
  --gateway-token <token> \
  --non-interactive
```

## Organization Workflow

```bash
# Create roles
opengoat agent create "CTO" --manager --reports-to ceo --skill board-manager
opengoat agent create "Engineer" --individual --reports-to cto --skill coding

# If --reports-to is omitted, it defaults to ceo
opengoat agent create "Designer" --individual

# Run work through any role
opengoat agent cto --message "Plan the Q2 engineering roadmap."

# Restructure reporting lines
opengoat agent set-manager engineer ceo

# Inspect structure
opengoat agent list
```

## Skills

Skills are owned by OpenClaw (bundled + `~/.openclaw/skills` + workspace-local `skills/`).

On bootstrap, OpenGoat pre-installs role skills in agent workspaces:

- managers: `board-manager`
- individuals: `board-individual`

Role skills are mutually exclusive per agent. OpenGoat does not install these role
skills into OpenClaw shared managed skills.

For `ceo`, this is written under `workspaces/ceo/skills/`.

OpenGoat keeps per-agent skill assignment metadata and includes compatibility install/list commands:

```bash
opengoat skill install board-manager --from /path/to/skill
opengoat skill install jira-tools --from /path/to/skill
opengoat skill list
```

## Sessions

Sessions are first-class and preserved across runs.

- same session key + same project path -> same OpenClaw session id
- same session key + different project path -> new session id (safety rotation)
- when a follow-up run omits `--project-path`, OpenGoat reuses the stored project path for that session key

Useful commands:

```bash
opengoat session list
opengoat session history --agent ceo
opengoat session rename --agent ceo --title "Planning"
opengoat session reset --agent ceo
```

## Docker

Build and run OpenGoat with OpenClaw in one image:

```bash
docker build -t opengoat:latest .
docker run --rm -p 19123:19123 -v opengoat-data:/data/opengoat opengoat:latest

# CLI in container
docker run --rm -v opengoat-data:/data/opengoat opengoat:latest cli --help

# Verify bundled OpenClaw
docker run --rm opengoat:latest openclaw --version
```

Compose:

```bash
docker compose up --build
docker compose run --rm opengoat cli --help
```

## Documentation

- [OpenClaw Getting Started](https://docs.openclaw.ai/start/getting-started)
- [OpenClaw Agents](https://docs.openclaw.ai/cli/agents)
- [OpenClaw Skills](https://docs.openclaw.ai/skills/introduction)
- `/docs/organization-runtime.md`
- `/docs/acp.md`
- `/docs/docker.md`

## For Contributors

Contributor-facing details live in:

- `ABOUT.md` (architecture context)
- `CONTRIBUTING.md` (workflow and standards)
