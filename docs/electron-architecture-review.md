# Electron Architecture Review (Pre-Release)

Date: 2026-02-08
Scope: `packages/electron`

## Executive Summary

The Electron app has a solid baseline: clear process boundaries (main vs renderer), typed IPC contracts, and existing tests around onboarding, router wiring, and renderer store flows.

The highest-risk area was state orchestration and data movement efficiency:

- renderer store mixed UI state + domain update logic in one large module
- chat flow performed redundant IPC round-trips after every send
- main persistence store re-read and re-parsed state from disk on each read path

This pass keeps behavior intact while reducing avoidable IPC/disk work and making the update logic easier to reason about.

## What Was Improved

### 1. Chat result contract now returns the updated session snapshot

Files:
- `packages/electron/src/shared/workbench.ts`
- `packages/electron/src/main/state/workbench-service.ts`
- `packages/electron/src/renderer/src/lib/trpc.ts`

`chat.send` now returns:

- `session` (authoritative post-write session snapshot)
- `reply`
- `providerId`
- `tracePath` (optional)

Impact:

- renderer no longer needs to refetch project/session data after send
- state updates are now deterministic from the mutation response

### 2. Renderer store now performs local deterministic updates

File:
- `packages/electron/src/renderer/src/store/workbench-store.ts`

Changes:

- removed redundant `listProjects` and `getSessionMessages` calls from common flows
  - bootstrap
  - add project
  - create session
  - rename session
  - remove session
  - select session
  - send message
- added focused project/session update helpers:
  - `upsertProject`
  - `upsertProjectSession`
  - `removeProjectSession`
  - `getProjectSessionMessages`
- fixed optimistic message cleanup on send failure

Impact:

- less IPC chatter
- clearer ownership of local state transitions
- fewer stale-read windows during rapid UI interaction

### 3. Main WorkbenchStore now caches state in-memory with clone boundaries

File:
- `packages/electron/src/main/state/workbench-store.ts`

Changes:

- introduced in-memory `stateCache`
- disk read + parse only on first load (or process restart)
- write transactions persist then update cache
- read APIs return cloned data (`structuredClone`) to avoid accidental external mutation of cache-backed state

Impact:

- lower disk I/O and JSON parse churn
- stronger encapsulation for future contributor safety

## Validation

- `corepack pnpm --filter @opengoat/desktop lint`
- `corepack pnpm vitest run packages/electron/src/main/ipc/router.test.ts packages/electron/src/main/state/workbench-service.test.ts packages/electron/src/renderer/src/features/chat/electron-chat-transport.test.ts packages/electron/src/renderer/src/store/workbench-store.test.ts packages/electron/src/renderer/src/store/workbench-flow.e2e.test.ts`

All passed.

## Recommended Next Refactors (Priority Order)

1. Split renderer store into domain slices (`projects`, `chat`, `onboarding`, `gateway`) with isolated action modules.
2. Separate long-lived message history from `state.json` into per-session files to prevent unbounded state-file growth.
3. Add explicit versioned migration path for desktop state schema (`schemaVersion` upgrade hooks).
4. Add performance smoke tests for session/message scaling (N sessions x M messages).
5. Add main-process integration tests for `WorkbenchStore` cache consistency and crash-safe persistence semantics.
