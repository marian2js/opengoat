---
"opengoat": patch
"@opengoat/core": patch
---
Feature-focused release: add strategy-based task delegation (top-down default with configurable bottom-up controls), in-progress timeout reminders, richer task timestamp visibility, and end-to-end chat image attachments (multi-image UI composer, backend normalization, provider forwarding, and native Codex `--image` support).

Also includes critical fixes and hardening: make CEO bootstrap mutations first-init only, keep AGENTS organization insertion idempotent, recover OpenClaw invocations from device-token mismatch paths, resolve plugin runtime loading across monorepo/dist layouts, and align task-cron/image handling validations across UI and server tests.
