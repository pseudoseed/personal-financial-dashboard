# Multi-stage build for production
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Add build arguments for cache invalidation
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Install ALL dependencies (including dev dependencies) for build
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Add build arguments for cache invalidation
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION
ARG CACHE_BUST

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code with cache busting
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application with cache busting
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Add build arguments for cache invalidation
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Install necessary packages
RUN apk add --no-cache \
    curl \
    bash \
    tzdata \
    sqlite \
    dcron

# Set timezone
ENV TZ=UTC

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create necessary directories with proper ownership
RUN mkdir -p /app/data /app/logs /app/backups && \
    chown -R nextjs:nodejs /app/data /app/logs /app/backups

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy scripts and compile TypeScript
COPY --from=builder /app/scripts ./scripts
RUN chmod +x scripts/init-db.sh && \
    chmod +x scripts/start-with-backup-cron.sh && \
    chown nextjs:nodejs scripts/init-db.sh scripts/start-with-backup-cron.sh

# Create enhanced startup script with validation and error handling
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "=========================================="' >> /app/start.sh && \
    echo 'echo "Personal Finance Dashboard - Starting Up"' >> /app/start.sh && \
    echo 'echo "=========================================="' >> /app/start.sh && \
    echo 'echo "Build Date: ${BUILD_DATE:-unknown}"' >> /app/start.sh && \
    echo 'echo "Version: ${VERSION:-unknown}"' >> /app/start.sh && \
    echo 'echo "Git Commit: ${VCS_REF:-unknown}"' >> /app/start.sh && \
    echo 'echo ""' >> /app/start.sh && \
    echo 'cd /app' >> /app/start.sh && \
    echo 'export DATABASE_URL="file:/app/data/dev.db"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'echo "Step 1: Initializing database..."' >> /app/start.sh && \
    echo './scripts/init-db.sh' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'echo "Step 2: Starting Next.js application..."' >> /app/start.sh && \
    echo 'echo "Application will be available at http://localhost:3000"' >> /app/start.sh && \
    echo 'echo "Health check available at http://localhost:3000/api/health"' >> /app/start.sh && \
    echo 'echo ""' >> /app/start.sh && \
    echo 'echo "=========================================="' >> /app/start.sh && \
    echo 'echo "Startup complete - Application is ready!"' >> /app/start.sh && \
    echo 'echo "=========================================="' >> /app/start.sh && \
    echo 'echo ""' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nextjs:nodejs /app/start.sh

# Set ownership of app directories
RUN chown -R nextjs:nodejs /app

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME=0.0.0.0

# Enhanced health check with startup grace period
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Switch to nextjs user for security
USER nextjs

# Set entrypoint to the new cron+app startup script
ENTRYPOINT ["/app/scripts/start-with-backup-cron.sh"]

# Comment out the old start.sh CMD
# CMD ["/app/start.sh"] 