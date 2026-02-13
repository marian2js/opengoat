<h1 align="center">OpenGoat</h1>
<p align="center"><strong>Run AI teams with a real org chart.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/opengoat"><img src="https://img.shields.io/npm/v/opengoat?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/marian2js/opengoat/actions"><img src="https://img.shields.io/github/actions/workflow/status/marian2js/opengoat/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square" alt="Node >= 20.11" />
</p>

OpenGoat turns "one agent with a huge prompt" into an operating team.

You create a CEO, managers, and individual contributors. You define reporting lines once, then run real work through the right role. OpenGoat keeps sessions, project context, and task flow organized while using OpenClaw as the runtime.

[Getting Started](#quick-start-2-minutes) - [Examples](#a-typical-workflow) - [Docs](#learn-more)

## Why OpenGoat

- Work like a company, not a chat thread: route decisions through leaders, execution through contributors.
- Keep projects separated: sessions stay tied to the intended project path.
- Scale without chaos: assign roles, skills, and ownership explicitly.
- Stay CLI-native: scriptable workflows for local usage, CI, and automation.

## Install

Runtime: Node `>=20.11`.

```bash
npm i -g openclaw@latest opengoat@latest
```

## Quick Start (2 Minutes)

```bash
# 1) Initialize OpenGoat home (~/.opengoat)
opengoat init

# 2) Connect OpenGoat to OpenClaw
opengoat onboard --local --non-interactive

# 3) Start with the default leader (ceo)
opengoat agent --message "Set up a CTO and two engineers for this project."
```

Use an external OpenClaw gateway:

```bash
opengoat onboard --external \
  --gateway-url ws://host:18789 \
  --gateway-token <token> \
  --non-interactive
```

## A Typical Workflow

```bash
# Build your org
opengoat agent create "CTO" --manager --reports-to ceo --skill board-manager
opengoat agent create "Engineer" --individual --reports-to cto --skill coding
opengoat agent create "Designer" --individual --reports-to cto

# Ask leadership for planning
opengoat agent cto --message "Plan the Q2 engineering roadmap and split it into streams."

# Run direct execution through a role
opengoat agent engineer --message "Implement the auth middleware for this sprint."

# Evolve structure as the team changes
opengoat agent set-manager designer ceo

# Inspect current organization
opengoat agent list
```

## Project Sessions (No Cross-Repo Drift)

Use session keys plus project paths to keep work scoped to the right repository.

```bash
# Start a named session for a specific project
opengoat agent ceo \
  --session saaslib-planning \
  --project-path /Users/you/workspace/saaslib \
  --message "Create a release checklist for v1.2"

# Continue the same session later
opengoat agent ceo \
  --session saaslib-planning \
  --message "Now draft the changelog"
```

Helpful session commands:

```bash
opengoat session list
opengoat session history --agent ceo
opengoat session rename --agent ceo --title "SaaSLib Planning"
opengoat session reset --agent ceo --session saaslib-planning
```

## Boards And Tasks

```bash
# Board lifecycle
opengoat board create "Platform"
opengoat board list

# Task lifecycle
opengoat task create --title "Ship auth" --description "Finish middleware + tests" --owner cto --assign engineer
opengoat task list --ass engineer
opengoat task status <task-id> doing
opengoat task worklog add <task-id> "Implemented middleware and added coverage"
```

## Skills

OpenGoat works with OpenClaw skills and keeps role assignments practical for team operation.

```bash
opengoat skill install board-manager --from /path/to/skill
opengoat skill install jira-tools --from /path/to/skill
opengoat skill list --agent ceo
```

## Docker

```bash
docker build -t opengoat:latest .
docker run --rm -p 19123:19123 -v opengoat-data:/data/opengoat opengoat:latest

# CLI in container
docker run --rm -v opengoat-data:/data/opengoat opengoat:latest cli --help
```

## Learn More

User docs and references:

- [OpenClaw Getting Started](https://docs.openclaw.ai/start/getting-started)
- [OpenClaw Agents](https://docs.openclaw.ai/cli/agents)
- [OpenClaw Skills](https://docs.openclaw.ai/skills/introduction)

Project docs:

- `/docs/organization-runtime.md`
- `/docs/acp.md`
- `/docs/docker.md`

Contributor and architecture docs:

- `/ABOUT.md`
- `/CONTRIBUTING.md`
