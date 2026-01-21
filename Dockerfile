# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production dependencies stage
FROM node:24-alpine AS prod-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

FROM gcr.io/distroless/nodejs24-debian12 AS production

WORKDIR /app

COPY package*.json ./

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

ENTRYPOINT ["/nodejs/bin/node", "dist/index.js"]