# Docker Runtime

OpenGoat ships with a Docker image that includes:

- OpenGoat CLI (`opengoat`)
- OpenGoat UI server (`packages/ui` build output)
- OpenClaw CLI installed from npm (`openclaw@latest`)

## Build

```bash
docker build -t opengoat:latest .
```

## Run UI

```bash
docker run --rm \
  -p 19123:19123 \
  -e OPENGOAT_UI_HOST=0.0.0.0 \
  -e OPENGOAT_UI_PORT=19123 \
  -v opengoat-data:/data/opengoat \
  opengoat:latest
```

Defaults inside the image:

- `OPENGOAT_HOME=/data/opengoat`
- `OPENGOAT_UI_HOST=0.0.0.0`
- `OPENGOAT_UI_PORT=19123`
- `OPENGOAT_USE_DIST=1`

## Run CLI

```bash
docker run --rm -v opengoat-data:/data/opengoat opengoat:latest cli --help
docker run --rm -v opengoat-data:/data/opengoat opengoat:latest cli agent list
```

## Verify OpenClaw in Image

```bash
docker run --rm opengoat:latest openclaw --version
```

## Compose

`docker-compose.yml` launches the UI service:

```bash
docker compose up --build
```

Run CLI through the same service image:

```bash
docker compose run --rm opengoat cli --help
```
