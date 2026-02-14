# syntax=docker/dockerfile:1.7

FROM node:22 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/core/package.json packages/core/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .

RUN pnpm --filter @opengoat/core build \
  && pnpm --filter opengoat build \
  && pnpm --filter @opengoat/ui build

FROM node:22 AS runtime
WORKDIR /app

ARG OPENCLAW_VERSION=latest

ENV NODE_ENV=production
ENV OPENGOAT_USE_DIST=1
ENV OPENGOAT_UI_HOST=0.0.0.0
ENV OPENGOAT_UI_PORT=19123
ENV OPENGOAT_HOME=/data/opengoat
ENV HOME=/data/opengoat

RUN npm install -g "openclaw@${OPENCLAW_VERSION}" \
  && openclaw --version

COPY --from=build /app /app
COPY docker/entrypoint.sh /usr/local/bin/opengoat-entrypoint

RUN chmod +x /usr/local/bin/opengoat-entrypoint /app/bin/opengoat /app/packages/cli/bin/opengoat \
  && ln -sf /app/bin/opengoat /usr/local/bin/opengoat \
  && mkdir -p /data/opengoat

VOLUME ["/data/opengoat"]
EXPOSE 19123

ENTRYPOINT ["opengoat-entrypoint"]
CMD ["ui"]
