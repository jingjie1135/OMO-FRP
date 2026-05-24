FROM oven/bun:1.3.14-slim AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.json vite.config.ts ./
COPY src ./src

RUN bun install --frozen-lockfile && \
    bun run build:ui && \
    bun run build:server

FROM node:20-slim AS opencode

RUN apt-get update && \
    apt-get install -y --no-install-recommends git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

RUN mkdir -p /config /workspaces

ENV OPENCODE_HOST=0.0.0.0
ENV OPENCODE_PORT=4096
ENV OPENCODE_CONFIG_DIR=/config
ENV OPENCODE_WORKSPACE_ROOT=/workspaces

WORKDIR /workspaces

EXPOSE 4096

CMD ["sh", "-c", "opencode serve --hostname \"${OPENCODE_HOST}\" --port \"${OPENCODE_PORT}\""]

FROM oven/bun:1.3.14-slim AS management-ui

WORKDIR /app

ENV MANAGEMENT_UI_HOST=0.0.0.0
ENV MANAGEMENT_UI_PORT=4080
ENV MANAGEMENT_UI_STATIC_ROOT=/app/dist/ui

COPY --from=builder /app/dist ./dist

EXPOSE 4080

CMD ["bun", "run", "/app/dist/server/management-ui-server.js"]
