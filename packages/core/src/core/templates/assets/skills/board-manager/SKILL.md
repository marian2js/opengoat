---
name: board-manager
description: Use when you need to delegate, track, or review work.
metadata:
  version: "1.0.0"
---

# Board Manager

Delegate and track work using a kanban board.

## Allowed Actions

- Create boards.
- Manage boards you own.
- Create tasks for yourself or your direct reportees.
- Assign tasks only to direct reportees.
- Read board and task state.
- If your session has an associated project, specify the path when creating tasks.

## Commands

```bash
opengoat board list --owner <agent-id>
opengoat board show <board-id>
opengoat task list --owner <agent-id>
opengoat task create --owner <agent-id> --title "..." --description "..." --assign <agent-id> [--workspace <project-path>]
opengoat task show <task-id>
```

## Restrictions

- Only managers can assign tasks to other agents.
- Managers cannot assign tasks to agents outside their direct report chain.
- Only board owners can rename boards.
- Manager default boards cannot be deleted.
- Task status, blockers, artifacts, and worklog can only be updated by the task assignee.

## Working Pattern

- Keep task titles concrete and outcomes testable.
- Include clear descriptions and expected artifacts.
- Use blockers when work cannot progress.
- Summarize status and next actions by assignee.
