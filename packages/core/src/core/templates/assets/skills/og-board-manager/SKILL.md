---
name: og-board-manager
description: Use when you need to delegate, track, or review work.
metadata:
  version: "1.0.0"
---

# Board Manager

Delegate and track work using tasks.

## Allowed Actions

- Create tasks for yourself.
- Assign tasks to your direct or indirect reportees.
- Read task state.
- If your session has an associated project, specify the path when creating tasks.

Important: replace `<me>` with your agent ID.

```bash
sh ./opengoat agent info <me>
```

## Task Commands

```bash
sh ./opengoat task list --as <me>
sh ./opengoat task create --owner <me> --title "..." --description "..." --assign <agent-id> [--project <path>]
sh ./opengoat task show <task-id>
```

## Standard workflow

### 1. Confirm org context

```bash
sh ./opengoat agent info <me>
```

Use the output to ensure:

- You assign only to **your** reportees (direct or indirect) or yourself
- You choose task granularity appropriate to your layer in the org

### 2. Review tasks

```bash
sh ./opengoat task list --as <me>
sh ./opengoat task show <task-id>
```

### 3. Delegate by creating a task

Create one task per owner and outcome.

```bash
sh ./opengoat task create \
  --owner <me> \
  --title "<verb>: <deliverable>" \
  --description "<context + deliverable + acceptance criteria>" \
  --assign <agent-id> \
  [--project <path>]
```

## Self-assigning (do the work yourself)

If the task is small enough and you have the tools and context to complete it efficiently, **do not delegate**. Create a task for yourself so the work is still tracked.

Rules:

- Use `--assign <me>`
- Keep the task scoped to a single, verifiable outcome
- Include acceptance criteria so “done” is unambiguous

Example:

```bash
sh ./opengoat task create \
  --owner <me> \
  --title "Fix: <short description>" \
  --description "Context:\n- ...\n\nDeliverable:\n- ...\n\nAcceptance criteria:\n- ..." \
  --assign <me> \
  [--project <path>]
```

## Task sizing and detail level (depends on your layer)

Do not blindly "break tasks down small." Size tasks based on where you sit in the org and who you are assigning to. You already know your org shape (direct and indirect reportees, and which reportees are managers). Use that.

### If you are a higher-level manager

Write **outcome-focused** tasks:

- What result is needed
- Why it matters
- Constraints and success criteria
- Optional milestones (not step-by-step instructions)

Expect your reportee to create smaller tasks for their own direct reportees if needed.

### If you are the last manager before execution

Write **execution-ready** tasks:

- Concrete steps when helpful
- File paths, commands, edge cases
- Clear validation steps (how to verify)

## Task writing template (not enforced, but recommended)

### Title

Use a verb + deliverable:

- `Implement: <feature>`
- `Fix: <bug>`
- `Investigate: <question>`
- `Decide: <tradeoff>`

### Description (pasteable)

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
- You can use `sh ./opengoat task --help` to see available commands and options.
