# OpenGoat Gateway (Optional)

OpenGoat Gateway is an optional WebSocket control plane intended for remote-machine use cases.

Use it when:

- OpenGoat runs on a remote host/server.
- Your app (for example Electron) needs to control that remote host (desktop onboarding includes an advanced remote-gateway toggle).

Do not use it when:

- OpenGoat runs locally on the same machine as your app.

In local setups, direct local runtime/IPC is preferred.

## Start

```bash
opengoat gateway --help
opengoat gateway --token "replace-with-strong-token"
opengoat gateway --url "ws://remote-host:18789/gateway" --token "remote-token"
```

Default bind is loopback (`127.0.0.1`). Non-loopback bind requires explicit `--allow-remote`.

When `--url` (or `--remote-url`) is provided, the CLI connects to that remote gateway and does not start a local gateway process.

## Security posture

The gateway is intentionally fail-closed and borrows hardening patterns from OpenClaw Gateway design:

- challenge-first handshake (`connect.challenge` with nonce)
- strict protocol negotiation (`minProtocol` + `maxProtocol`)
- strict request frame validation (unknown fields rejected)
- authentication enabled by default (token)
- timing-safe token comparison
- nonce enforcement for non-loopback clients
- origin checks for browser-origin requests
- handshake timeout
- max payload limit
- slow-consumer protection (buffer threshold)
- request rate limiting
- idempotency cache for side-effect method replay protection

## Transport

- HTTP health: `GET /health`
- WebSocket endpoint: `/gateway`
- JSON frames:
  - request: `{ type: "req", id, method, params }`
  - response: `{ type: "res", id, ok, payload|error }`
  - event: `{ type: "event", event, payload, seq? }`

## Handshake

On connect, server sends:

```json
{ "type": "event", "event": "connect.challenge", "payload": { "nonce": "...", "ts": 0 } }
```

Client must reply first with `connect` request:

```json
{
  "type": "req",
  "id": "connect-1",
  "method": "connect",
  "params": {
    "minProtocol": 1,
    "maxProtocol": 1,
    "client": {
      "id": "desktop",
      "version": "0.1.0",
      "platform": "macos",
      "mode": "operator"
    },
    "auth": { "token": "..." },
    "nonce": "..."
  }
}
```

## Current methods

- `health`
- `agent.list`
- `agent.run` (requires `idempotencyKey`)
- `session.list`
- `session.history`

## Recommended remote deployment

For enterprise safety, keep gateway loopback-bound and expose it through a secure transport:

1. SSH tunnel (recommended baseline)
2. VPN/tailnet tunnel

Avoid direct public exposure of the WebSocket port.
