<h1 align="center">OpenGoat</h1>
<p align="center"><strong>Build AI Autonomous Organizations of OpenClaw Agents.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/opengoat"><img src="https://img.shields.io/npm/v/opengoat?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/marian2js/opengoat/actions"><img src="https://img.shields.io/github/actions/workflow/status/marian2js/opengoat/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square" alt="Node >= 20.11" />
  <a href="https://discord.gg/JWGqXJMwYE"><img src="https://img.shields.io/badge/discord-7289DA?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
</p>

**OpenGoat** allows you to build herarchical organizations of AI agents that coordinate work across multiple tools, including Claude Code, Codex, Cursor, Lovable, and more.

[![OpenGoat UI](/assets/org-example.png)](https://opengoat.ai)

---

## Installation

```bash
# Install OpenClaw and OpenGoat
npm i -g openclaw opengoat

# Setup OpenClaw
openclaw onboard

# Start OpenGoat
opengoat start
```

That's it. Open `http://127.0.0.1:19123` and start messaging the CEO. He will take care of the rest.

### Alternative: Docker

```bash
docker build -t opengoat:latest .
docker run --rm -p 19123:19123 -v opengoat-data:/data/opengoat opengoat:latest
```

Then open `http://127.0.0.1:19123`.

### From Source (without global npm install)

```bash
pnpm install
pnpm build
./bin/opengoat --help
```

When agents execute commands from their OpenGoat workspace, use the workspace shim:

```bash
sh ./opengoat agent list
sh ./opengoat agent info ceo
```

### CLI Quick Start (Optional)

Runtime: Node `>=20.11`.

```bash
npm i -g openclaw opengoat
openclaw onboard
opengoat init
opengoat agent --message "Set up a CTO and two engineers for this project."
```

Run the production UI server from the CLI:

```bash
opengoat start
```

Restart a running UI server:

```bash
opengoat restart
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
opengoat agent create "CTO" --manager --reports-to ceo --skill og-boards
opengoat agent create "Engineer" --individual --reports-to cto --skill coding
opengoat agent create "Designer" --individual --reports-to cto
opengoat agent list
```

### Run role-based work

```bash
opengoat agent cto --message "Plan the Q2 engineering roadmap and split it into streams."
opengoat agent engineer --message "Implement the auth middleware for this sprint."
```

### Keep session continuity

```bash
opengoat agent ceo \
  --session saaslib-planning \
  --message "Create a release checklist for v1.2"

opengoat agent ceo \
  --session saaslib-planning \
  --message "Now draft the changelog"
```

### Operate with tasks

```bash
opengoat task create --title "Ship auth" --description "Finish middleware + tests" --owner cto --assign engineer
opengoat task list --as engineer
opengoat task status <task-id> doing
```

## Skills

```bash
opengoat skill install og-boards --from /path/to/skill
opengoat skill install jira-tools --from /path/to/skill
opengoat skill list --agent ceo
```

# License

MIT
