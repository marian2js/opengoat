# OpenGoat Desktop (Electron)

## Scope

This package introduces the first desktop app surface for OpenGoat:

- Cross-platform target: macOS + Windows (Electron Forge makers)
- UI stack: React + Tailwind + shadcn-style component primitives
- State: Zustand
- Main/Renderer transport: tRPC over Electron IPC (`electron-trpc`)
- Chat interaction layer: AI SDK UI (`@ai-sdk/react` `useChat`) with a custom Electron `ChatTransport`

The CLI remains intact and desktop uses the same core runtime wiring (`OpenGoatService`).

## Monorepo Layout

- Root package: OpenGoat core + CLI (`opengoat`)
- Desktop package: `packages/electron` (`@opengoat/desktop`)

This is an incremental monorepo setup: desktop is isolated in its own workspace while reusing core code.

## Runtime Boundary

Shared runtime factory:

- `packages/core/src/apps/runtime/create-opengoat-runtime.ts`

Both CLI and desktop instantiate services through this factory. This avoids duplicated bootstrap/provider/session wiring and keeps behavior consistent across app surfaces.

Desktop chat keeps the same core execution path and only changes the renderer interaction protocol:

- UI conversation state + streaming semantics: AI SDK UI
- transport adapter: renderer `ChatTransport` that calls Electron IPC
- orchestration runtime: main process `WorkbenchService` -> core `OpenGoatService`

## Desktop Architecture

### Main process

- `src/main/main.ts`
  - Creates BrowserWindow
  - Boots OpenGoat runtime
  - Registers tRPC IPC handler
- `src/main/ipc/router.ts`
  - Typed desktop RPC surface
- `src/main/state/workbench-store.ts`
  - Durable desktop state store (`state.json`)
- `src/main/state/workbench-service.ts`
  - Application use-cases (add project, create session, send chat message)

### Renderer process

- `src/renderer/src/App.tsx`
  - Sidebar: projects + sessions
  - Main panel: chat timeline
- `src/renderer/src/features/chat/electron-chat-transport.ts`
  - AI SDK UI transport bridge to Electron IPC chat calls
- `src/renderer/src/store/workbench-store.ts`
  - Zustand state/actions
- `src/renderer/src/lib/trpc.ts`
  - Type-safe tRPC client via IPC link
- `src/renderer/src/components/ui/*`
  - shadcn-style primitives (`Button`, `Input`, `Textarea`)

### Shared contracts

- `src/shared/workbench.ts`
  - zod schemas and shared types for project/session/message entities

## Data Model

Desktop state is stored under OpenGoat home:

- `~/.opengoat/apps/desktop/state.json`

Entity model:

- Project: id, name, rootPath, sessions[]
- Session: id, title, `sessionKey` (mapped to OpenGoat sessionRef), messages[]
- Message: role (`user`/`assistant`), content, optional trace/provider metadata

## Onboarding UX

Desktop onboarding is now a guided first-run flow aligned with CLI intent:

- Step 1: choose a provider (grouped by Cloud APIs vs Local Tools)
- Step 2: complete only required fields in "Quick Setup"
- Optional fields stay collapsed under "Advanced Settings"

Behavior rules:

- If bootstrap reports `needsOnboarding=true`, onboarding is shown before chat.
- On successful submit where `needsOnboarding=false`, onboarding closes automatically.
- If provider execution later fails, onboarding can reopen with error context for repair.

## Project Working Path Behavior

When sending a chat message from desktop:

- OpenGoat always runs the entry agent as `orchestrator`.
- The selected project's `rootPath` is sent as the run `cwd`.
- Session continuity is maintained by per-session `sessionKey`.

This aligns with OpenGoat's working-path model.

## Commands

From repo root:

- `pnpm desktop:dev` - start Electron desktop in dev mode
- `pnpm desktop:package` - package desktop app
- `pnpm desktop:make` - build installables (platform makers)

Or directly:

- `pnpm --filter @opengoat/desktop start`

## Next Steps

This setup intentionally ships a strong vertical slice first. Recommended follow-up phases:

1. Token-level streaming from provider output into AI SDK UI transport.
2. Session metadata in UI (run id, provider id, timing, trace links).
3. Project/workspace settings panel (provider overrides, default model, logging).
4. E2E desktop smoke tests in CI.
5. Optional package split (`@opengoat/core`) when moving beyond pre-release.
