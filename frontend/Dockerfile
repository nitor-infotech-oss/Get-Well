# ============================================================
# GetWell RhythmX — Frontend Dockerfile
# Multi-stage: build Vue app → serve with Nginx (HTTP + HTTPS)
# ============================================================

# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time env vars — overridden by docker-compose or CI
ARG VITE_API_BASE_URL=/api
ARG VITE_WS_URL=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ── Stage 2: Serve with Nginx ──
FROM nginx:1.27-alpine AS production

# Install openssl for self-signed cert generation
RUN apk add --no-cache openssl

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Generate self-signed SSL certificate (valid 365 days)
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/server.key \
      -out /etc/nginx/ssl/server.crt \
      -subj "/C=US/ST=State/L=City/O=GetWell-RhythmX/CN=getwell-rhythmx-poc"

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:443/ || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
