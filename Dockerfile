# Build stage
FROM node:24.22.1-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production dependencies stage
FROM node:24.22.1-alpine AS prod-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

# The debian12 distroless image stopped receiving Node updates at 24.14.0; use debian13.
# Pinned by digest because distroless publishes no Node version tags. This digest ships Node 24.22.1.
FROM gcr.io/distroless/nodejs24-debian13@sha256:c23cc7262662efd642cd9c9d61783d10f600321f7bafdd37c8a82365ffaa2aa6 AS production

LABEL org.opencontainers.image.title="Octopus Deploy MCP Server (deprecated)" \
      org.opencontainers.image.description="Deprecated. Use the Remote MCP Server in Octopus Server 2026.3 and later: https://octopus.com/docs/octopus-ai/mcp/remote" \
      org.opencontainers.image.source="https://github.com/OctopusDeploy/mcp-server" \
      org.opencontainers.image.documentation="https://octopus.com/docs/octopus-ai/mcp/remote"

WORKDIR /app

COPY package*.json ./

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

ENTRYPOINT ["/nodejs/bin/node", "dist/index.js"]