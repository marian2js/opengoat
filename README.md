# OpenGoat

OpenGoat is an open-source **agent orchestrator**.

You talk to one default agent (`orchestrator`), and it decides how to coordinate specialized agents across providers such as **Cursor, Claude Code, Codex, OpenCode, OpenClaw**, and other CLI/API-compatible providers (including custom integrations).

## Why OpenGoat

Most agent tools optimize for one model or one interface.  
OpenGoat optimizes for **coordination**:

- one entry point for the user
- many specialized agents behind it
- provider-agnostic execution
- traceable decisions and side effects
- session continuity across long-running work

## What It Does

- Maintains a default `orchestrator` agent (always the primary entry point).
- Routes/delegates work to other agents using AI, not hardcoded pipelines.
- Supports both:
  - direct agent-to-agent communication
  - artifact-based coordination
- Tracks OpenGoat sessions and provider-native sessions separately.
- Captures working-tree side effects for each run (Git-based).
- Supports skills per agent and OpenClaw-compatible plugins.
- Exposes ACP (Agent Client Protocol) for editor/IDE integrations.

## Core Mental Model

- **Workspace path**: durable agent-owned context (`~/.opengoat/workspaces/<agent-id>`).
- **Working path**: project path where the agent operates (defaults to where you run `opengoat`, or `--cwd`).
- **Run**: one invocation (`opengoat agent ...`).
- **Session**: continuity across runs.

## Quick Start

Requirements:
- Node.js `>= 20.11.0`

```bash
npm install
npm run build

# Initialize OpenGoat home (~/.opengoat by default)
./bin/opengoat init

# Configure providers/credentials interactively
./bin/opengoat onboard

# Talk to orchestrator (default)
./bin/opengoat agent --message "Build a plan for adding OAuth login"
```

Run against a specific project:

```bash
# Uses current directory as working path by default
cd /path/to/your/project
../opengoat/bin/opengoat agent --message "Implement this feature"

# Or set explicitly
../opengoat/bin/opengoat agent --message "Implement this feature" --cwd /path/to/your/project
```

## Common Commands

```bash
./bin/opengoat init
./bin/opengoat onboard
./bin/opengoat agent --message "<text>"
./bin/opengoat agent <agent-id> --message "<text>"
./bin/opengoat agent create "<name>"
./bin/opengoat agent list
./bin/opengoat provider list
./bin/opengoat route --message "<text>"
./bin/opengoat session list
./bin/opengoat skill list --agent <agent-id>
./bin/opengoat plugin list
./bin/opengoat acp --help
```

## Architecture (High Level)

OpenGoat is domain-structured for long-term maintainability:

- `src/core/orchestration`: planner loop, delegation runtime, routing
- `src/core/providers`: provider contracts, registry, provider modules
- `src/core/sessions`: session lifecycle, pruning, compaction, history
- `src/core/agents`: agent creation + manifests (`AGENTS.md`)
- `src/core/skills`: skill resolution/install/injection
- `src/core/plugins`: OpenClaw-compatible plugin support
- `src/core/acp`: ACP integration
- `src/apps/cli`: CLI surface

## Providers

OpenGoat supports both:

- **HTTP/API providers** (for example OpenAI/Grok/OpenRouter)
- **CLI providers** (for example Cursor/OpenCode/OpenClaw/Codex/Claude CLI-style tools)

You can add new providers without changing the whole app by adding provider modules under:
- `src/core/providers/providers/<provider-id>/`

## Documentation

- Deep architecture and orchestration details: `docs/orchestration-flow.md`
- ACP integration details: `docs/acp.md`
- Full project context/spec: `about.md`

## Contributing

Contributions are welcome.  
Please read:
- `CONTRIBUTING.md`

## License

MIT (`LICENSE`)
