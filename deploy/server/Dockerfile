FROM node:20-slim

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
