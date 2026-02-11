---
name: board-individual
description: Individual contributor playbook for OpenGoat boards and tasks.
metadata:
  version: "1.0.0"
---

# Board Individual

Use this skill when executing assigned work via OpenGoat boards and tasks.

## Allowed Actions

- Create tasks for yourself.
- Read board and task state.
- Update status for tasks assigned to you.
- Add blockers, artifacts, and worklog entries on tasks assigned to you.

## Restrictions (Enforced by Core)

- You cannot assign tasks to other agents unless you are a manager and the assignee is your direct reportee.
- You cannot update status, blockers, artifacts, or worklog on tasks assigned to someone else.
- You cannot rename boards you do not own.
- You must specify a board id when creating tasks unless you are a manager with a default board.

## Working Pattern

- Keep worklog updates factual and concise.
- Add blockers immediately when blocked.
- Attach artifacts that prove progress.
- Move status deliberately: `todo` -> `doing` -> `blocked|done`.
