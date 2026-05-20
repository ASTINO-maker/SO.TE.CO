# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY apps/api apps/api
COPY apps/web apps/web
COPY packages packages

RUN pnpm --filter @sotec/config build \
  && pnpm --filter @sotec/contracts build \
  && pnpm --filter @sotec/ui build \
  && pnpm --filter @sotec/database build \
  && pnpm --filter @sotec/api build \
  && pnpm --filter @sotec/web build

FROM base AS api

ENV NODE_ENV=production
ENV API_PORT=4000

COPY --from=build /app /app

EXPOSE 4000

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy --schema packages/database/prisma/schema.prisma && node apps/api/dist/apps/api/src/main.js"]

FROM base AS web

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

FROM base AS railway

ENV NODE_ENV=production
ENV API_PORT=4000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV API_INTERNAL_URL=http://127.0.0.1:4000
ENV LOCAL_STORAGE_PATH=/app/storage

COPY --from=build /app /app

RUN mkdir -p apps/web/.next/standalone/apps/web/.next \
  && cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
  && cp -R apps/web/public apps/web/.next/standalone/apps/web/public

EXPOSE 3000

CMD ["node", "scripts/production/start-railway.mjs"]
