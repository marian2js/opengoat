---
name: og-board-manager
description: Use when you need to delegate, track, or review work.
metadata:
  version: "1.0.0"
---

# Board Manager

Delegate and track work using OpenGoat tools.

Use tools directly. Do not run shell CLI commands like `sh ./opengoat ...`.

## Allowed Actions

- Create tasks for yourself.
- Assign tasks to your direct or indirect reportees.
- Read and update task state.
- Add blockers, artifacts, and worklogs.

Important: replace `<me>` with your agent ID.

```text
opengoat_agent_info({ "agentId": "<me>" })
```

## Task Tools

```text
opengoat_task_list({ "assignee": "<me>" })
opengoat_task_get({ "taskId": "<task-id>" })
opengoat_task_create({
  "actorId": "<me>",
  "title": "...",
  "description": "...",
  "assignedTo": "<agent-id>"
})
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

## Standard Workflow

### 1. Confirm org context

```text
opengoat_agent_info({ "agentId": "<me>" })
```

Use the output to ensure:

- You assign only to your reportees (direct or indirect) or yourself.
- You choose task granularity appropriate to your layer in the org.

### 2. Review tasks

```text
opengoat_task_list({ "assignee": "<me>" })
opengoat_task_get({ "taskId": "<task-id>" })
```

### 3. Delegate by creating a task

Create one task per owner and outcome.

```text
opengoat_task_create({
  "actorId": "<me>",
  "title": "<verb>: <deliverable>",
  "description": "<context + deliverable + acceptance criteria>",
  "assignedTo": "<agent-id>"
})
```

## Self-assigning (do the work yourself)

If the task is small enough and you have the tools and context to complete it efficiently, do not delegate. Create a task for yourself so the work is still tracked.

Rules:

- Use `"assignedTo": "<me>"`.
- Keep the task scoped to a single, verifiable outcome.
- Include acceptance criteria so done is unambiguous.

Example:

```text
opengoat_task_create({
  "actorId": "<me>",
  "title": "Fix: <short description>",
  "description": "Context:\n- ...\n\nDeliverable:\n- ...\n\nAcceptance criteria:\n- ...",
  "assignedTo": "<me>"
})
```

## Task sizing and detail level

Do not blindly break tasks down small. Size tasks based on where you sit in the org and who you are assigning to.

### If you are a higher-level manager

Write outcome-focused tasks:

- What result is needed
- Why it matters
- Constraints and success criteria
- Optional milestones (not step-by-step instructions)

Expect your reportee to create smaller tasks for their own direct reportees if needed.

### If you are the last manager before execution

Write execution-ready tasks:

- Concrete steps when helpful
- File paths and edge cases
- Clear validation steps

## Task writing template

### Title

Use a verb + deliverable:

- `Implement: <feature>`
- `Fix: <bug>`
- `Investigate: <question>`
- `Decide: <tradeoff>`

### Description

```text
Context:
- Why this matters (1–3 bullets)

Deliverable:
- What to produce (code/doc/decision)

Acceptance criteria:
- Observable checks (tests pass, output, link, screenshot, etc.)

Constraints:
- Scope boundaries, dependencies, must-use tools, performance limits
```

## Troubleshooting

- Task creation fails: you are likely assigning to someone who is not in your reportee tree. Reassign to a valid reportee (direct or indirect) or assign to yourself.
- If a tool call fails, inspect the tool error and retry with corrected parameters.
