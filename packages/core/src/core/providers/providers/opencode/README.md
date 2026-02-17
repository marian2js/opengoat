# OpenCode Provider

- Type: CLI
- Command: `opencode`
- Env override: `OPENCODE_CMD`
- Auth command: `opencode auth login`
- Invocation mode: headless run (`opencode run --format json`)
- Session resume: supported (`opencode run --session <session-id>`)
- Permissions mode: forced allow via env (`OPENCODE_PERMISSION={"bash":"allow","edit":"allow","webfetch":"allow","read":"allow","write":"allow"}`)
- External agent creation: not supported
- External agent deletion: not supported
