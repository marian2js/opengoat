# Changelog

## 2026.2.18-2

- Publish the missed npm release after `v2026.2.18` was tagged on GitHub without a changeset, which caused the release workflow to skip npm publish.

## 2026.2.18

- Ship a cross-cutting runtime hardening release across core, CLI, providers, and UI.
- Enforce manager governance rules: only OpenClaw-backed agents can be assigned as `reportsTo` managers (service + UI/API validation), and inactive-agent cron alerts are now aggregated into one message per manager per run.
- Improve provider runtime behavior: OpenClaw slash commands now execute through gateway `chat.send` with programmatic response polling; non-OpenClaw providers now enforce no-approval/full-access autonomy defaults; Codex uses resume-compatible autonomy flags.
- Improve session and onboarding ergonomics: new sessions auto-title from the first user message, `onboard --non-interactive --external` now fails fast when missing gateway credentials, and `init` skips runtime-default sync for faster startup.
- Strengthen internet-facing UI security controls: login attempt limits are isolated by forwarded client IP behind trusted proxies, logout no longer resets unauthenticated failed-attempt counters, forwarded-proto spoofing is rejected for untrusted clients, and authenticated CORS policy is tightened.
- Upgrade UI behavior and clarity: settings moved to a dedicated page, authentication credential fields hide when auth is disabled, chat input remains editable while streaming, sidebar version/settings layout is aligned, provider-specific run-status messages are surfaced, OpenClaw live telemetry polling only runs for OpenClaw invocations, and markdown code block contrast is improved on dark backgrounds.
- Improve operational guidance and Docker defaults: role guidance now points agents to repo paths under `~/.opengoat/workspaces/<agent-id>/<repo>`, and Docker compose/runtime settings were updated for Codex reliability and home-directory resolution.

## 2026.2.17-2

- Ship the agent profile release and sidebar organization UX hardening: add `/agents/<id>` profile routing + API-backed editing for identity and organization metadata; enforce provider/assigned-skills as read-only in the profile UI to match runtime constraints; fix case-insensitive profile resolution and org chart initial framing; improve sidebar drag-and-drop accuracy with reliable drop-line targeting, gap-friendly container drop zones, and reduced visual drag noise; persist custom sidebar organization across refresh; and align OpenClaw role-skill assignment to role-specific board skills.

## 2026.2.17

- Release the latest runtime and dashboard updates, including provider runtime registry/policies with new CLI providers (Codex, Cursor, OpenCode, Gemini), organization workspace/session behavior improvements, and major dashboard/sidebar UX updates (session routing, org chart totals, persistent drag-and-drop ordering, and clearer working-state labels).

## 2026.2.15

- Make task cron automation notifications run without persisted sessions, so inactive-reportee reminders no longer create lasting chat threads in the UI.

## 2026.2.14-3

- Fix organization bootstrap seeding to include nested template files such as `organization/wiki/index.md`.

## 2026.2.14-2

- Release follow-up for February 14, 2026:

- include UI runtime dependencies in the published `opengoat` package so `opengoat start` works in global installs
- add packed-tarball smoke checks in CI/release to validate publish artifacts before npm publish

## 2026.2.14

- Release the latest scheduler and settings updates, including explicit cron controls, improved settings UX labels, and cron/inactivity notification decoupling.

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
