# OpenGoat Home

This directory stores OpenGoat organization state.

- `config.json`: global organization settings
- `agents.json`: registered agent ids
- `agents/`: per-agent OpenGoat config + session store
- `skills/`: optional OpenGoat compatibility skill store (created on first install)
- `providers/`: OpenClaw runtime connectivity config
- `runs/`: run traces (routing + execution history)

OpenClaw owns runtime skill loading and workspace bootstrap markdown files.
