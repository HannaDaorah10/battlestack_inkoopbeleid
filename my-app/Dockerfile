# syntax=docker/dockerfile:1

# Build stage

FROM node:24-alpine AS build
WORKDIR /app

ARG BUILD_NUMBER=dev
ENV BUILD_NUMBER=${BUILD_NUMBER}

# pnpm-workspace.yaml carries the `allowBuilds:` approvals for native deps and MUST land before install,
# or pnpm blocks those build scripts (ERR_PNPM_IGNORED_BUILDS). Globbed so non-pnpm managers don't break the COPY.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./

# Via npm, not corepack: Node 25+ no longer bundles corepack, so this survives the base image moving past 24.
RUN npm install -g pnpm

RUN pnpm install --frozen-lockfile

COPY . ./

# Must exist even for a `db:push` project with no generated SQL, because the runtime COPY below depends on it.
RUN mkdir -p /app/server/database/migrations

# nuxt-security's rateLimiter is baked in at build time, so it cannot be toggled at container runtime; empty means ON.
# NEVER build a production image with `--build-arg NUXT_RATE_LIMIT_DISABLED=true`: it removes the per-IP rate limit.
ARG NUXT_RATE_LIMIT_DISABLED=""
ENV NUXT_RATE_LIMIT_DISABLED=${NUXT_RATE_LIMIT_DISABLED}

# 4GB heap: Nitro's server bundling of Mastra plus Tailwind v4 blows past the default ~2GB ceiling.
# Set inline so intermediate shells and package-manager exec wrappers cannot drop it.
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# Stage standalone migrate/seed scripts + the SQL migrations dir for the runtime image.
RUN mkdir -p /app/dist-tools && \
    cp tools/migrate.mjs /app/dist-tools/migrate.mjs && \
    cp tools/seed.mjs /app/dist-tools/seed.mjs && \
    mkdir -p /app/dist-tools/migrations && \
    if [ -d /app/server/database/migrations ]; then \
        cp -R /app/server/database/migrations/. /app/dist-tools/migrations/; \
    fi

# Nitro's file tracer cannot copy npm-aliased deps under their alias names, which Mastra's `@mastra/schema-compat` imports.
# Copy them into the server output under the aliased path so runtime resolution works without inline-bundling.
RUN if [ -d node_modules/zod-from-json-schema-v3 ]; then \
        mkdir -p .output/server/node_modules && \
        cp -RL node_modules/zod-from-json-schema-v3 .output/server/node_modules/; \
    fi && \
    if [ -d node_modules/@ai-sdk/provider-utils-v5 ]; then \
        mkdir -p .output/server/node_modules/@ai-sdk && \
        cp -RL node_modules/@ai-sdk/provider-utils-v5 .output/server/node_modules/@ai-sdk/; \
    fi

# Runtime stage

FROM node:24-alpine AS runtime
WORKDIR /app

COPY --from=build --chown=node:node /app/.output/ ./

# Standalone migrate/seed scripts land next to .output/server/index.mjs so
# they resolve postgres + @node-rs/argon2 from .output/server/node_modules.
# A deploy target's init step can call `node /app/server/migrate.mjs` and
# `node /app/server/seed.mjs` directly against this runtime image.
COPY --from=build --chown=node:node /app/dist-tools/migrate.mjs /app/server/migrate.mjs
COPY --from=build --chown=node:node /app/dist-tools/seed.mjs /app/server/seed.mjs
COPY --from=build --chown=node:node /app/dist-tools/migrations/ /app/migrations/

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

USER node

CMD ["node", "/app/server/index.mjs"]
