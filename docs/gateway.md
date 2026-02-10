# OpenGoat Gateway (Optional Remote Control)

OpenGoat Gateway is an optional WebSocket control plane for remote app connections.

It is different from OpenClaw gateway connectivity configured by `opengoat onboard`.

## Two Different Gateway Concepts

1. OpenClaw runtime gateway (configured by `opengoat onboard`)
- decides how OpenGoat reaches OpenClaw runtime
- modes: local or external

2. OpenGoat optional app gateway (this document)
- allows remote clients to control an OpenGoat instance
- started with `opengoat gateway`

## When to Use OpenGoat Gateway

Use when:

- OpenGoat runs on another machine
- a remote app/client must invoke OpenGoat over network/tunnel

Do not use when:

- OpenGoat and client run on the same machine

Local usage should call OpenGoat directly.

## Start / Connect

```bash
# start local gateway server
opengoat gateway --help
opengoat gateway --token "replace-with-strong-token"

# connect to existing remote gateway
opengoat gateway --url "ws://remote-host:18789/gateway" --token "remote-token"
```

Defaults:

- bind host: `127.0.0.1`
- auth: enabled
- non-loopback bind requires `--allow-remote`

## Security Posture

The gateway is fail-closed by default:

- challenge-first handshake (`connect.challenge`)
- strict protocol negotiation
- strict frame validation
- token auth by default
- timing-safe token checks
- nonce enforcement for non-loopback scenarios
- origin checks for browser-origin requests
- handshake timeout
- payload limits
- slow-consumer protection
- rate limiting
- idempotency cache for side-effect calls

## Transport

- HTTP health: `GET /health`
- WebSocket endpoint: `/gateway`

Frame shapes:

- request: `{ type: "req", id, method, params }`
- response: `{ type: "res", id, ok, payload|error }`
- event: `{ type: "event", event, payload, seq? }`

## Methods

Current exposed methods:

- `health`
- `agent.list`
- `agent.run` (requires `idempotencyKey`)
- `session.list`
- `session.history`

## Recommended Deployment

For remote access, prefer tunnel-based exposure:

1. SSH tunnel
2. VPN/tailnet tunnel

Avoid directly exposing the gateway port to public internet.
