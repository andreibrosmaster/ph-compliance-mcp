# syntax=docker/dockerfile:1
# ph-compliance-mcp — containerized stdio MCP server.
#
# Multi-stage build:
#   build   — install deps + compile TypeScript (devDependencies included)
#   runtime — slim node image with only dist/ + prod node_modules + scripts
#
# The runtime image exposes NO ports: the server speaks MCP over stdio, so the
# container is spawned by an MCP client (e.g. Claude Code / Cursor / Docker
# exec) as the server process. PH_COMPLIANCE_LOCAL_CORPUS is pre-wired to
# /corpus so the server never downloads at runtime (air-gapped model).
#
# Build:  docker build -t ph-compliance-mcp .
# Verify: docker run --rm -i ph-compliance-mcp node dist/src/server.js < /dev/null
#         (or via an MCP client / docker exec into a sidecar)

# ---- build stage ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
# pnpm via corepack (Node 24 ships corepack; enable defensively).
RUN corepack enable || true
COPY package.json pnpm-lock.yaml* ./
# No lockfile committed yet (first-run gate) — fall back to a plain install.
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY data-pipeline ./data-pipeline
RUN pnpm build

# ---- runtime stage ----
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PH_COMPLIANCE_LOCAL_CORPUS=/corpus \
    PH_COMPLIANCE_CACHE_DIR=/cache
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY scripts ./scripts
# A healthcheck that spawns the server and calls list_domains (0 = healthy).
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD ["node", "scripts/healthcheck.mjs"]
# The MCP protocol runs over stdio; the client (not Docker) owns the process.
ENTRYPOINT ["node", "dist/src/server.js"]
