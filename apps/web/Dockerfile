# Convention Doshwork — 4 étages sur node:22-alpine.
# Bun 1.3.3 dans deps/builder/development ; production reste sur node server.js (sans Bun).

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Bun 1.3.3 — copié depuis l'image officielle alpine (musl, compatible node:22-alpine).
COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
# Prérequis système de sharp, utilisé pour le traitement d'images en Epic 5.
RUN apk add --no-cache vips-dev
COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les NEXT_PUBLIC_* sont inlinées par Next au moment du build : les passer
# au runtime n'aurait aucun effet. Changer de domaine impose un rebuild.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN bun run build

# ---------- development ----------
FROM node:22-alpine AS development
WORKDIR /app
COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

# ---------- production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
# La sortie standalone ne contient ni les assets statiques ni public/ :
# les trois copies sont obligatoires, dans cet ordre.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
# Sans HOSTNAME=0.0.0.0, server.js n'écoute que sur localhost interne
# et le reverse proxy renvoie 502.
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
# Pas de HEALTHCHECK ici : délégué au compose (story 2.5).
