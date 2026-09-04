# --- dependencies -----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Baked into the client bundle at build time, so it must be the PUBLIC websocket
# URL, not an internal one.
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_NAME=CampusConnect
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- run --------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

# `output: standalone` emits a self-contained server plus only the node_modules
# it actually uses, which is a fraction of the full install.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
