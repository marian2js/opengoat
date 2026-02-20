# GitHub Copilot CLI Provider

- Command: `copilot`
- Env override: `COPILOT_CLI_CMD`
- Invocation mode: headless prompt mode (`copilot --prompt <message> --silent --allow-all`)
- Session resume: supported (`copilot --resume <session-id>`)
- Auth mode: external (uses existing Copilot/GitHub CLI auth, optionally via `GITHUB_TOKEN` or `GH_TOKEN`)
