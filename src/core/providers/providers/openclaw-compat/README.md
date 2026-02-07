# OpenClaw Compatibility Providers

This package registers `openclaw-<provider>` providers that forward execution to the local
`openclaw` CLI while preserving OpenGoat's provider contract.

Examples:
- `openclaw-openai`
- `openclaw-openai-codex`
- `openclaw-anthropic`
- `openclaw-openrouter`

Notes:
- Command override: `OPENCLAW_CMD`
- Generic model override: `OPENGOAT_OPENCLAW_MODEL`
- Provider model override: `OPENGOAT_OPENCLAW_<PROVIDER_ID>_MODEL`
  - Example: `OPENGOAT_OPENCLAW_OPENAI_MODEL`
- Auth is provider-specific and maps to OpenClaw onboarding/auth commands.

