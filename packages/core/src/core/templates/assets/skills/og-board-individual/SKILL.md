---
name: og-board-individual
description: "Use when you need to work with tasks: view tasks, list tasks, update task status, add blockers, artifacts, and worklogs."
metadata:
  version: "1.0.0"
---

# Board Individual

Use this skill to read and update tasks assigned to you.

Use tools directly. Do not run shell CLI commands like `sh ./opengoat ...`.

## Quick Start

Replace `<me>` with your agent id.

```text
opengoat_agent_info({ "agentId": "<me>" })
```

You will typically have one or more `<task-id>` values to update.

## Relevant Tools

```text
opengoat_task_list({ "assignee": "<me>" })
opengoat_task_get({ "taskId": "<task-id>" })
opengoat_task_update_status({
  "actorId": "<me>",
  "taskId": "<task-id>",
  "status": "todo|doing|blocked|pending|done",
  "reason": "<optional-reason>"
})
opengoat_task_add_blocker({ "actorId": "<me>", "taskId": "<task-id>", "blocker": "..." })
opengoat_task_add_artifact({ "actorId": "<me>", "taskId": "<task-id>", "content": "..." })
opengoat_task_add_worklog({ "actorId": "<me>", "taskId": "<task-id>", "content": "..." })
```

## View Tasks

### Show a single task

```text
opengoat_task_get({ "taskId": "<task-id>" })
```

### List tasks

```text
opengoat_task_list({ "assignee": "<me>" })
```

### List latest tasks

```text
opengoat_task_list_latest({ "assignee": "<me>", "limit": 20 })
```

## Update Task Status

Statuses: `todo`, `doing`, `blocked`, `pending`, `done`.

```text
opengoat_task_update_status({
  "actorId": "<me>",
  "taskId": "<task-id>",
  "status": "doing|blocked|pending|done|todo",
  "reason": "<reason when needed>"
})
```

### Reason rules

- `reason` is mandatory when moving to `blocked` or `pending`.
- `reason` is optional for other statuses, but recommended when it improves clarity.

Examples:

```text
opengoat_task_update_status({ "actorId": "<me>", "taskId": "<task-id>", "status": "doing" })
opengoat_task_update_status({ "actorId": "<me>", "taskId": "<task-id>", "status": "blocked", "reason": "Need API token from platform team" })
opengoat_task_update_status({ "actorId": "<me>", "taskId": "<task-id>", "status": "pending", "reason": "Waiting for review window on Friday" })
opengoat_task_update_status({ "actorId": "<me>", "taskId": "<task-id>", "status": "done", "reason": "Merged PR #123 and deployed" })
```

## Blockers, Artifacts, Worklogs

### Add a blocker entry

```text
opengoat_task_add_blocker({
  "actorId": "<me>",
  "taskId": "<task-id>",
  "blocker": "Blocked by <thing>. Unblocks when <condition>."
})
```

### Add an artifact (proof of work)

```text
opengoat_task_add_artifact({
  "actorId": "<me>",
  "taskId": "<task-id>",
  "content": "PR: <link> | Docs: <link> | Output: <summary>"
})
```

### Add a worklog update (progress notes)

```text
opengoat_task_add_worklog({
  "actorId": "<me>",
  "taskId": "<task-id>",
  "content": "Did X. Next: Y. Risk: Z."
})
```

## Minimal Hygiene

- Keep status accurate (`todo` -> `doing` -> `blocked/pending/done`).
- When moving to `blocked` or `pending`, include a specific reason.
- When blocked, add a blocker entry that states what unblocks you.
- When done, add at least one artifact that proves completion.
- Use worklogs when progress is non-obvious or when handing off.
