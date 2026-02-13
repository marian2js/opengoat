<h1 align="center">OpenGoat</h1>
<p align="center"><strong>Build organizations of OpenClaw agents that coordinate work across Codex, Claude Code, Cursor, Lovable, and more.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/opengoat"><img src="https://img.shields.io/npm/v/opengoat?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/marian2js/opengoat/actions"><img src="https://img.shields.io/github/actions/workflow/status/marian2js/opengoat/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square" alt="Node >= 20.11" />
</p>

OpenGoat is for teams that want AI workers to act like a real company, not a pile of disconnected chats.

Use the UI to create projects, open sessions, and run work through role-based agents (CEO, managers, contributors). Use the CLI when you want scripting, automation, and deeper operational control.

[Start With UI](#start-with-ui-recommended) · [CLI Quick Start](#cli-quick-start) · [Workflows](#typical-workflows) · [Docs](#learn-more)

## Why OpenGoat

- Clear ownership: each agent has a role and manager.
- Better coordination: planning and execution can happen through different roles.
- Safer project work: sessions stay anchored to project paths.
- Works with your stack: built on OpenClaw and designed to coordinate with modern coding agents.

## Start With UI (Recommended)

For most users, the UI is the best experience.

### Option A: Docker (fastest UI path)

```bash
docker build -t opengoat:latest .
docker run --rm -p 19123:19123 -v opengoat-data:/data/opengoat opengoat:latest
```

Then open `http://127.0.0.1:19123`.

### Option B: Run UI from source

```bash
pnpm install
pnpm --filter @opengoat/ui dev
```

Then open `http://127.0.0.1:19123`.

## UI-First Workflow

1. Add a project (repository path).
2. Create or open a session for that project.
3. Message your CEO or another role from the session.
4. Track progress in boards/tasks from the same interface.
5. Open additional sessions per project stream when needed.

## CLI Quick Start

Runtime: Node `>=20.11`.

```bash
npm i -g openclaw@latest opengoat@latest

opengoat init
opengoat onboard --local --non-interactive
opengoat agent --message "Set up a CTO and two engineers for this project."
```

Use an external OpenClaw gateway:

```bash
opengoat onboard --external \
  --gateway-url ws://host:18789 \
  --gateway-token <token> \
  --non-interactive
```

## Typical Workflows

### Build the organization

```bash
opengoat agent create "CTO" --manager --reports-to ceo --skill board-manager
opengoat agent create "Engineer" --individual --reports-to cto --skill coding
opengoat agent create "Designer" --individual --reports-to cto
opengoat agent list
```

### Run role-based work

```bash
opengoat agent cto --message "Plan the Q2 engineering roadmap and split it into streams."
opengoat agent engineer --message "Implement the auth middleware for this sprint."
```

### Keep project sessions scoped

```bash
opengoat agent ceo \
  --session saaslib-planning \
  --project-path /Users/you/workspace/saaslib \
  --message "Create a release checklist for v1.2"

opengoat agent ceo \
  --session saaslib-planning \
  --message "Now draft the changelog"
```

### Operate with boards and tasks

```bash
opengoat board create "Platform"
opengoat task create --title "Ship auth" --description "Finish middleware + tests" --owner cto --assign engineer
opengoat task list --ass engineer
opengoat task status <task-id> doing
```

## Skills

```bash
opengoat skill install board-manager --from /path/to/skill
opengoat skill install jira-tools --from /path/to/skill
opengoat skill list --agent ceo
```

## Learn More

- [OpenClaw Getting Started](https://docs.openclaw.ai/start/getting-started)
- [OpenClaw Agents](https://docs.openclaw.ai/cli/agents)
- [OpenClaw Skills](https://docs.openclaw.ai/skills/introduction)
- `/docs/organization-runtime.md`
- `/docs/acp.md`
- `/docs/docker.md`
- `/ABOUT.md`
- `/CONTRIBUTING.md`
