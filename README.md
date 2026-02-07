<h1 align="center">OpenGoat</h1>
<p align="center"><strong>The open-source agent orchestrator.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/opengoat"><img src="https://img.shields.io/npm/v/opengoat?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/marian2js/opengoat/actions"><img src="https://img.shields.io/github/actions/workflow/status/marian2js/opengoat/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square" alt="Node >= 20.11" />
</p>

<p align="center">
  Connect and coordinate AI agents across <strong>OpenClaw</strong>, <strong>Claude Code</strong>, <strong>Codex</strong>, <strong>Cursor</strong>, <strong>OpenCode</strong>, and even with apps like Lovable and v0 🐐 🐐 🐐.
</p>

---

## Why OpenGoat

Most AI coding tools lock you into one model, one interface, one workflow. OpenGoat takes a different approach: **one orchestrator, many agents, any provider.**

- **Provider-agnostic** &mdash; mix CLI tools (Cursor, Claude Code, Codex) with HTTP APIs (OpenAI, Gemini, Grok) in the same workflow
- **AI-driven routing** &mdash; the orchestrator decides which agent handles what, no hardcoded pipelines
- **Session continuity** &mdash; pick up where you left off across runs with persistent transcripts and history
- **Side-effect tracking** &mdash; every run captures Git working-tree changes so the orchestrator can reason about what happened
- **Extensible** &mdash; add providers, skills, and OpenClaw-compatible plugins without touching core code
- **IDE-ready** &mdash; built-in ACP (Agent Client Protocol) support for editor integrations

## How it works

```
                                You
                                 │
                                 ▼
                       ┌──────────────────┐
                       │   Orchestrator   │  ← AI planner loop
                       └────────┬─────────┘
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
              ▼                 ▼                  ▼
    ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │  CLI Providers   │ │  LLM Providers   │ │ External Sources │
    └──────────────────┘ └──────────────────┘ └──────────────────┘
      Claude Code          OpenAI                Lovable
      Codex                Gemini                v0
      Cursor               Grok                  OpenClaw
      OpenCode             OpenRouter
      OpenClaw
```

1. You send a message to the **orchestrator** (the default entry agent).
2. The orchestrator's AI planner decides whether to answer directly, delegate to specialized agents, coordinate through artifacts, or install skills.
3. Delegated agents run through their bound provider (CLI or HTTP).
4. Side effects are captured via `git status` diffs and fed back into the planner for subsequent decisions.
5. Everything is traced: routing decisions, delegation calls, artifact I/O, session history.

## Quick start

```bash
npm i -g opengoat

opengoat init                           # initialize ~/.opengoat
opengoat onboard                        # configure providers interactively
opengoat agent --message "Refactor the auth module"
```

Run against a specific project:

```bash
cd /path/to/your/project
opengoat agent --message "Add unit tests for the API layer"

# or explicitly
opengoat agent --message "Add unit tests" --cwd /path/to/your/project
```

<details>
<summary><strong>Install from source</strong></summary>

```bash
git clone https://github.com/marian2js/opengoat.git
cd opengoat
npm install
npm run build

./bin/opengoat init
./bin/opengoat onboard
./bin/opengoat agent --message "Hello from source"
```

Requires Node.js >= 20.11.0.

</details>

## Providers

OpenGoat ships with 10 built-in providers. Adding your own is a single folder under `src/core/providers/providers/`.

| Provider          | Type | What it connects to               |
| ----------------- | ---- | --------------------------------- |
| `claude`          | CLI  | Anthropic Claude Code             |
| `cursor`          | CLI  | Cursor IDE                        |
| `codex`           | CLI  | OpenAI Codex CLI                  |
| `opencode`        | CLI  | OpenCode                          |
| `openclaw`        | CLI  | OpenClaw                          |
| `openai`          | HTTP | OpenAI API                        |
| `gemini`          | HTTP | Google Gemini API                 |
| `grok`            | HTTP | xAI Grok API                      |
| `openrouter`      | HTTP | OpenRouter (multi-model gateway)  |
| `openclaw-compat` | HTTP | OpenClaw-compatible model catalog |

**CLI providers** invoke external tools in your terminal. **HTTP providers** call model APIs directly. Both types are first-class citizens &mdash; the orchestrator picks the right agent regardless of provider type.

HTTP providers are implemented through a shared Vercel AI SDK runtime so orchestrator-facing capabilities can evolve consistently (tool calling, MCP integration, and structured generation).

## Core concepts

**Orchestrator** &mdash; The default entry agent. Every user message goes here first. An AI planner loop decides whether to answer, delegate, read/write artifacts, install skills, or finish.

**Agents** &mdash; Specialized workers defined in `AGENTS.md` front matter. Each agent has exactly one provider binding, metadata (tags, priority, delegation rules), and its own workspace.

**Sessions** &mdash; Continuity across runs. Transcripts are stored as JSONL, with automatic pruning and compaction. Sessions are bound to a working path &mdash; OpenGoat auto-rotates if the path changes.

**Skills** &mdash; Per-agent capabilities that inject context into the system prompt. Install managed skills globally or scope them to a workspace.

**Plugins** &mdash; OpenClaw-compatible plugin ecosystem. Install, enable, disable, and manage plugins through the CLI.

**ACP** &mdash; Agent Client Protocol over stdio for IDE/editor integration. Supports initialize, new, load, resume, list, prompt, and cancel flows.

## CLI reference

```bash
# Setup
opengoat onboard                           # interactive provider setup

# Agents
opengoat agent --message "<text>"          # talk to the orchestrator
opengoat agent <id> --message "<text>"     # talk to a specific agent
opengoat agent create "<name>"             # create a new agent
opengoat agent list                        # list all agents
opengoat route --message "<text>"          # preview routing decision

# Sessions
opengoat session list                      # list sessions
opengoat session history                   # view session transcript
opengoat session reset                     # reset a session
opengoat session compact                   # compact session context

# Providers & Skills
opengoat provider list                     # list available providers
opengoat skill list --agent <id>           # list skills for an agent
opengoat skill list --global               # list global managed skills
opengoat skill install <skill>             # install a workspace skill
opengoat skill install <skill> --global    # install a global skill

# Plugins (OpenClaw-compatible)
opengoat plugin list                       # list installed plugins
opengoat plugin install <plugin>           # install a plugin
opengoat plugin enable|disable <plugin>    # toggle plugins
opengoat plugin doctor                     # check plugin health

# Advanced
opengoat acp                               # start ACP server (stdio)
opengoat scenario run <name>               # run a test scenario
```

Global flags: `--log-level <silent|error|warn|info|debug>` &middot; `--log-format <pretty|json>`

## Architecture

OpenGoat is domain-structured for long-term maintainability. Core modules are reusable outside the CLI, and platform adapters are replaceable.

```
src/
├── core/
│   ├── orchestration/    # AI planner loop, delegation runtime, routing
│   ├── providers/        # Provider contracts, registry, auto-discovery
│   ├── sessions/         # Session lifecycle, transcripts, pruning
│   ├── agents/           # Agent creation, manifest parsing (AGENTS.md)
│   ├── skills/           # Skill resolution, install, prompt injection
│   ├── plugins/          # OpenClaw-compatible plugin lifecycle
│   ├── acp/              # Agent Client Protocol integration
│   ├── opengoat/         # Facade service (OpenGoatService)
│   ├── bootstrap/        # Home initialization, default orchestrator seeding
│   └── domain/           # Shared types and contracts
├── platform/
│   └── node/             # Node.js adapters (fs, paths, command runner)
└── apps/
    └── cli/              # CLI commands and formatting
```

## Documentation

| Document                                                   | Description                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`docs/orchestration-flow.md`](docs/orchestration-flow.md) | Deep dive into the orchestration runtime, agent types, and delegation modes |
| [`docs/acp.md`](docs/acp.md)                               | Agent Client Protocol integration details                                   |
| [`ABOUT.md`](ABOUT.md)                                     | Full project context, architecture spec, and rebuild blueprint              |

## Contributing

Contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting a pull request.

OpenGoat uses [Changesets](https://github.com/changesets/changesets) for release management and [CalVer](https://calver.org/) (YYYY.M.D) for versioning.

## License

[MIT](LICENSE)
