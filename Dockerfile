# syntax=docker/dockerfile:1

# kXStream — single container serving the Angular PWA + the web-backend
# (Xtream proxy + Kodi /cast) on one port. Ideal for Unraid Docker: point the
# tablet at http://<unraid-ip>:3000 and it reaches Kodi on the same LAN.

# ---- Build stage ----
FROM node:22-bookworm-slim AS build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build web --configuration=pwa \
    && pnpm nx build web-backend

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    PUBLIC_DIR=/app/public
WORKDIR /app/backend
# Bundled backend (main.js + generated package.json for any externalized deps)
COPY --from=build /repo/dist/apps/web-backend ./
# Built PWA static assets served by the backend at "/"
COPY --from=build /repo/dist/apps/web /app/public
# Install only deps the bundler externalized (no-op if fully bundled)
RUN npm install --omit=dev --no-audit --no-fund || true
EXPOSE 3000
CMD ["node", "main.cjs"]
