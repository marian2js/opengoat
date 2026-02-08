# OpenAI Provider

- Type: HTTP API (no CLI required)
- Auth: `OPENAI_API_KEY`
- Base URL override: `OPENAI_BASE_URL`
- Endpoint path override: `OPENAI_ENDPOINT_PATH`
- Full endpoint override: `OPENAI_ENDPOINT`
- Model override: `OPENAI_MODEL`
- Request timeout override (ms): `OPENAI_REQUEST_TIMEOUT_MS`
- API style override: `OPENAI_API_STYLE` (`responses` or `chat`)

Defaults:
- `api.openai.com` uses `responses`
- compatible custom base URLs default to `chat` unless explicitly overridden
