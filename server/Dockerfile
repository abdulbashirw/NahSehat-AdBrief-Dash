# ─── NahSehat Dashboard Backend — Multi-stage Docker Build ───
# Express + MySQL2 + JWT API server
#
# Build context: server/ directory
#   docker build -t nahsehat-backend ./server
#
# Cloud Run sets the PORT env var automatically (default 8080).
# The app reads process.env.PORT || 3001, so it listens on 8080 in Cloud Run.

# Stage 1: Build the TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# Stage 2: Production runtime (minimal image)
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application from builder stage
COPY --from=builder /app/dist ./dist

# Cloud Run sets PORT=8080 automatically; this is a fallback for local Docker.
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check (Cloud Run ignores this; useful for local Docker)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application — compiled entry point is dist/app.js
CMD ["node", "dist/app.js"]