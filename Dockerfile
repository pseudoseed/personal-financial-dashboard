# Multi-stage build for production
FROM node:20.14.0-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install ALL dependencies (including dev dependencies) for build
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install cron and other necessary packages
RUN apk add --no-cache \
    dcron \
    curl \
    bash \
    tzdata

# Set timezone
ENV TZ=UTC

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create necessary directories
RUN mkdir -p /app/data /app/logs /var/spool/cron/crontabs

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
COPY --from=builder /app/node_modules ./node_modules
RUN chmod +x scripts/refresh-data-docker.sh scripts/init-db.sh
# Compile TypeScript scripts to JavaScript using the builder's TypeScript
RUN npx tsc scripts/refresh-data.ts --outDir scripts --target es2020 --module commonjs --esModuleInterop --skipLibCheck

# Create cron configuration (daily at 6 AM) - run as root
RUN echo "0 6 * * * /app/scripts/refresh-data-docker.sh >> /app/logs/cron.log 2>&1" > /var/spool/cron/crontabs/root

# Create startup script that runs both cron (as root) and Next.js (as nextjs)
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'echo "Starting cron service..."' >> /app/start.sh && \
    echo 'crond -f -l 2 &' >> /app/start.sh && \
    echo 'echo "Initializing database..."' >> /app/start.sh && \
    echo 'cd /app' >> /app/start.sh && \
    echo 'export DATABASE_URL="file:/app/data/dev.db"' >> /app/start.sh && \
    echo './scripts/init-db.sh' >> /app/start.sh && \
    echo 'echo "Starting Next.js application..."' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Set ownership of app directories
RUN chown -R nextjs:nodejs /app

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["/app/start.sh"] 