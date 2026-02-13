---
name: og-board-individual
description: "Use when you need to work with board tasks: view tasks, list tasks, update task status, add blockers, artifacts, and worklogs."
metadata:
  version: "1.0.0"
---

# Board Individual

Use this skill to read and update tasks assigned to you. Follow your manager’s instructions for what to do, and use the commands below to keep task state accurate.

## Quick start

Replace `<me>` with your agent id.

```bash
opengoat agent info <me>
```

You will typically have:

- a `<board-id>` to list tasks
- one or more `<task-id>` values to update

## Relevant commands

```bash
opengoat task list <board-id> [--as <me>] [--json]
opengoat task show <task-id> [--json]

opengoat task status <task-id> <todo|doing|blocked|pending|done> [--reason <reason>] [--as <me>]

opengoat task blocker add <task-id> <content> [--as <me>]
opengoat task artifact add <task-id> <content> [--as <me>]
opengoat task worklog add <task-id> <content> [--as <me>]
```

## View tasks

### Show a single task

```bash
opengoat task show <task-id>
```

### List tasks

List tasks on a board:

```bash
opengoat task list <board-id>
```

List tasks owned by an agent (often: you):

```bash
opengoat task list --as <me>
```

### List tasks by status (practical approach)

Use JSON output and filter locally. The JSON includes task status (`todo|doing|blocked|pending|done`).

```bash
opengoat task list <board-id> --json
```

Filter examples (adjust the jq selector to match the JSON shape you see):

```bash

# If the JSON is an array of tasks

opengoat task list <board-id> --json | jq '.[] | select(.status=="doing")'

# If the JSON is an object that contains a tasks array

opengoat task list <board-id> --json | jq '.tasks[] | select(.status=="doing")'
```

## Update task status

Statuses: `todo`, `doing`, `blocked`, `pending`, `done`.

```bash
opengoat task status <task-id> <todo|doing|blocked|pending|done> [--reason "<reason>"]
```

### Reason rules

- `--reason` is **mandatory** when moving to:
  - `blocked`
  - `pending`
- `--reason` is optional for other statuses, but recommended when it improves clarity.

Examples:

```bash

# Start work

opengoat task status <task-id> doing

# Blocked (reason required)

opengoat task status <task-id> blocked --reason "Need API token from platform team"

# Pending (reason required)

opengoat task status <task-id> pending --reason "Waiting for review window on Friday"

# Done (reason optional but useful)

opengoat task status <task-id> done --reason "Merged PR #123 and deployed"
```

### Assignee override (only if you must)

Some contexts require specifying an assignee context explicitly.

```bash
opengoat task status <task-id> doing --as <agent-id>
```

## Blockers, artifacts, worklogs

### Add a blocker entry (recommended when blocked)

Use this to capture what is blocking you and what unblocks you.

```bash
opengoat task blocker add <task-id> "Blocked by <thing>. Unblocks when <condition>." --as <me>
```

### Add an artifact (proof of work)

Use this for PR links, docs, screenshots, commands run, or final outputs.

```bash
opengoat task artifact add <task-id> "PR: <link> | Docs: <link> | Output: <summary>" --as <me>
```

### Add a worklog update (progress notes)

Use for concise progress updates and handoffs.

```bash
opengoat task worklog add <task-id> "Did X. Next: Y. Risk: Z." --as <me>
```

## Minimal hygiene

- Keep status accurate (`todo` → `doing` → `blocked/pending/done`).
- When moving to `blocked` or `pending`, always include a specific `--reason`.
- When blocked, add a blocker entry that states what unblocks you.
- When done, add at least one artifact that proves completion.
- Use worklogs when progress is non-obvious or when handing off.
