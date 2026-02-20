---
"@opengoat/core": patch
"opengoat": patch
---
Release quality and task-cron reliability improvements across notifications and delegation.

- keep notification continuity in the same session while recovering from provider context overflow by triggering in-session compaction and retrying delivery once
- refine top-down delegation logic so blocked tasks are no longer counted as open tasks for threshold checks
- add regression coverage to protect top-down blocked-task semantics and notification behavior stability
