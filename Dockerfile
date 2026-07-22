FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY miniapp/package.json ./miniapp/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
COPY miniapp ./miniapp
RUN pnpm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY miniapp/package.json ./miniapp/package.json
RUN pnpm install --prod --filter kornix-max-bot --frozen-lockfile && pnpm store prune

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-miniapp ./dist-miniapp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

USER node

CMD ["node", "dist/server.js"]
