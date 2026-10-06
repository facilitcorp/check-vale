# CheckVale: um contêiner só. A API (Fastify) serve /api e também a PWA compilada, na mesma origem.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps apps
RUN npm run build -w @checkvale/web && npm run build -w @checkvale/api

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @checkvale/api --include-workspace-root=false --no-audit --no-fund

FROM node:22-slim
ENV NODE_ENV=production PORT=8080 WEB_DIR=/app/web
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/apps/api/dist api
COPY --from=build /app/apps/web/dist web
USER node
EXPOSE 8080
CMD ["node", "api/servidor.js"]
