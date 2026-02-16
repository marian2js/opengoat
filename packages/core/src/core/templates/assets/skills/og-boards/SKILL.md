---
name: og-boards
description: "Use when you need to create, inspect, or update task board work through the OpenGoat CLI."
metadata:
  version: "1.0.0"
---

# OG Boards

Use this skill for task board operations.

- Use CLI commands only.
- Do not call `opengoat_*` tools.
- Run commands from the agent workspace via `./opengoat`.

Your agent id is `<me>`.

## Organization Context

```bash
./opengoat agent info <me>
./opengoat agent direct-reportees <me>
./opengoat agent all-reportees <me>
```

Use reportee commands before delegation so you only assign to valid agents.

## Read Tasks

```bash
./opengoat task list --as <me>
./opengoat task list --as <me> --json
./opengoat task show <task-id>
./opengoat task show <task-id> --json
```

## Create Tasks

```bash
./opengoat task create \
  --owner <me> \
  --assign <agent-id> \
  --title "<verb>: <deliverable>" \
  --description "<context + deliverable + acceptance criteria>" \
  --project "~"
```

Rules:

- assign only to yourself or your reportees
- for self-execution, use `--assign <me>`
- keep one owner and one clear outcome per task

## Update Status

Valid statuses: `todo`, `doing`, `pending`, `blocked`, `done`.

```bash
./opengoat task status <task-id> doing --as <me>
./opengoat task status <task-id> done --as <me>
```

`pending` and `blocked` require `--reason`:

```bash
./opengoat task status <task-id> blocked --reason "Waiting for API token from platform team." --as <me>
./opengoat task status <task-id> pending --reason "Waiting for review window." --as <me>
```

## Add Task Entries

```bash
./opengoat task blocker add <task-id> "Blocked by <thing>. Unblocks when <condition>." --as <me>
./opengoat task artifact add <task-id> "PR: <link> | Docs: <link> | Output: <summary>" --as <me>
./opengoat task worklog add <task-id> "Did X. Next: Y. Risk: Z." --as <me>
```

## Operational Workflow

1. List current work (`task list --as <me>`).
2. Open the target task (`task show <task-id> --json`).
3. Move to `doing` when active.
4. Add blocker/worklog/artifact entries as the task evolves.
5. Move to `done` and include at least one artifact proving completion.

## Cron

Use only when explicitly requested:

```bash
./opengoat task cron --once --inactive-minutes 45
```
