# Changelog

## 2026.2.13

- Release CalVer 2026.2.13

## 2026.2.9

- Initial public release of OpenGoat

- OpenGoat CLI and Core packages
- Modular provider system supporting Claude, Cursor, OpenAI, Gemini, Grok, and more
- Agent Client Protocol (ACP) server for editor integration
- Session and agent management commands
- Interactive onboarding flow for provider setup
- CalVer-based release versioning

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-09

### Added
- **Electron Desktop App**:
  - Initial implementation with tRPC IPC and workbench state management.
  - Custom draggable title bar for macOS and dynamic window sizing.
  - New visual design system with updated colors, animations, and interactive UI effects.
  - Guided, multi-step onboarding flow for provider setup.
  - Dedicated panel for agent management (list, create, delete).
  - In-chat manager progress timeline and live activity display.
  - AI-specific UI components and streamlined chat panel layout with `useChat` integration.
  - Native application menu with project, session, and provider settings.
  - Sidebar improvements: project/session renaming, removal, and default "Home" project.
- **CLI Features**:
  - Support for connecting to remote OpenGoat Gateways.
  - `onboard` command for bootstrapping providers and agents with interactive prompts.
  - Guided authentication (OAuth) support for provider onboarding.
  - Interactive "back" navigation and provider filtering during onboarding.
  - Agent management commands: `agent-create`, `agent-delete`, `agent-list`.
  - Session management commands: `session-list`, `session-history`, `session-reset`, `session-compact`.
  - Structured logging with global `--log-level` and `--log-format` flags.
- **Core Services**:
  - Modular provider system supporting Claude, Cursor, OpenAI, Gemini, Grok, etc.
  - OpenClaw compatibility layer adding numerous external providers.
  - Agent Client Protocol (ACP) server for editor integration.
  - Skill management system for extending agent capabilities.
  - Plugin management system with CLI commands.
  - Scenario runner and orchestration planner.
  - Session persistence and working tree side-effect capture using Git status.
  - LLM text runtime abstraction (Vercel AI SDK compatible).
  - Support for external agent creation (Claude, OpenCode).
- **Testing**:
  - End-to-end tests for `onboard` CLI command.
  - End-to-end tests for Electron onboarding and agent management.
  - Comprehensive suite for manager flow and tRPC procedure fallback.

### Fixed
- Improved chat error summaries for provider failures.
- Resolved redundant manager planning steps.
- Fixed stalled delegations and enabled Gemini approvals.
- Hardened OpenAI-compatible runtime timeouts (reduced to 60s) and improved compatibility.
- Resolved build issues in monorepo structure and updated tRPC dependencies.
- Fixed macOS titlebar inset and sidebar behavior in Electron app.
- Corrected display line processing with `toVisualLines` helper.

### Changed
- **Architecture**: Restructured the project into a monorepo with `@opengoat/cli` and `@opengoat/core` packages.
- **Package Management**: Migrated from npm to pnpm with workspace configuration.
- **CLI Framework**: Replaced `node:readline` with `CliPrompter` framework using `@clack/prompts`.
- **Primary Entrypoint**: Designated `onboard` as the primary command for initial setup.
- **Release Process**: Implemented CalVer-based release process using Changesets and a custom versioning script.
- **Refactoring**: Modularized core services into dedicated domain directories and decoupled orchestration hooks from provider options.
