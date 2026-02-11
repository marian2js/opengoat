---
name: board-manager
description: Manager playbook for OpenGoat boards and tasks.
---

# Board Manager

Use this skill when coordinating delivery through OpenGoat boards and tasks.

## Allowed Actions

- Create boards.
- Rename boards you own.
- Create tasks for yourself or your direct reportees.
- Assign tasks only to direct reportees.
- Read board and task state.

## Restrictions (Enforced by Core)

- Only managers can assign tasks to other agents.
- Managers cannot assign tasks to agents outside their direct report chain.
- Only board owners can rename boards.
- Task status, blockers, artifacts, and worklog can only be updated by the task assignee.

## Working Pattern

- Keep task titles concrete and outcomes testable.
- Include clear descriptions and expected artifacts.
- Use blockers when work cannot progress.
- Summarize status and next actions by assignee.
