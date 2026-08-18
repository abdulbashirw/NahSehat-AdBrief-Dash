# ─── NahSehat Dashboard — Multi-stage Docker Build ───
# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# ─── Vite Environment Variables (build-time) ──────────
# These build args override .env.production values at build time.
# Pass them via: docker build --build-arg VITE_BE_API=https://... .
# If not provided, .env.production defaults are used (relative paths for nginx proxy).
ARG VITE_BE_API
ARG VITE_NAHSEHAT_API_V3
ARG VITE_NAHSEHAT_ADBRIEF_API_V3
ARG VITE_APP_NAME
ARG VITE_ENV
ARG VITE_ENABLE_MOCK
ARG VITE_ENABLE_DEVTOOLS

# Write provided build args to .env.production.local (overrides .env.production).
# Only non-empty values are written — empty build args fall back to .env.production.
RUN touch .env.production.local && \
    if [ -n "$VITE_BE_API" ]; then echo "VITE_BE_API=$VITE_BE_API" >> .env.production.local; fi && \
    if [ -n "$VITE_NAHSEHAT_API_V3" ]; then echo "VITE_NAHSEHAT_API_V3=$VITE_NAHSEHAT_API_V3" >> .env.production.local; fi && \
    if [ -n "$VITE_NAHSEHAT_ADBRIEF_API_V3" ]; then echo "VITE_NAHSEHAT_ADBRIEF_API_V3=$VITE_NAHSEHAT_ADBRIEF_API_V3" >> .env.production.local; fi && \
    if [ -n "$VITE_APP_NAME" ]; then echo "VITE_APP_NAME=$VITE_APP_NAME" >> .env.production.local; fi && \
    if [ -n "$VITE_ENV" ]; then echo "VITE_ENV=$VITE_ENV" >> .env.production.local; fi && \
    if [ -n "$VITE_ENABLE_MOCK" ]; then echo "VITE_ENABLE_MOCK=$VITE_ENABLE_MOCK" >> .env.production.local; fi && \
    if [ -n "$VITE_ENABLE_DEVTOOLS" ]; then echo "VITE_ENABLE_DEVTOOLS=$VITE_ENABLE_DEVTOOLS" >> .env.production.local; fi

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]