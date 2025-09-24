# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R mcp:nodejs /app
USER mcp

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/index.js"]

CMD [""]