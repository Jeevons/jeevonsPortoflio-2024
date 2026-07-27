# Convention Doshwork — étages sur node:22-alpine.
# Bun 1.3.3 dans deps/builder/development ; production reste sur node server.js (sans Bun).
# Story 4.6 : un étage `migrator` fournit les artefacts Prisma (CLI + engines
# linux-musl + schéma + migrations + seed transpilé) que l'entrypoint de
# production exécute au démarrage (migrate deploy → seed → node server.js).

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Bun 1.3.3 — copié depuis l'image officielle alpine (musl, compatible node:22-alpine).
COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
# Le postinstall lance `prisma generate` : le schéma et la config Prisma doivent
# donc être présents dès l'install. `generate` ne se connecte pas à la DB (aucune
# DATABASE_URL requise) ; il produit le client généré + fetch les engines (dont
# le schema-engine linux-musl, réutilisé par l'étage migrator).
COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma
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
# Story 4.6 : transpiler le seed TS en un bundle node autonome (prisma/seed.mjs).
# Seul `pg` reste externe (natif, présent dans le standalone) ; @prisma/adapter-pg
# est bundlé car non tracé par Next (le seed n'est pas dans le graphe du build).
RUN bun run build:seed
# Story 5.6 : même traitement pour le script de secours 2FA
# (scripts/admin-reset-2fa.mjs), exécuté à la demande par `docker exec` en prod,
# là où Bun n'existe pas. `pg` reste externe (natif, présent dans le standalone) ;
# pas besoin d'externaliser argon2 : ce script ne hache rien (il efface).
RUN bun run build:reset-2fa

# ---------- development ----------
FROM node:22-alpine AS development
WORKDIR /app
# Story 5.12 — même exigence qu'en production : le serveur de dev exécute sharp
# au runtime des téléversements. Sans libvips ici, la fonctionnalité serait
# testable en prod mais pas en local, à rebours de la story 2.3 (« développer
# dans les mêmes conditions qu'en production »).
RUN apk add --no-cache vips
COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

# ---------- migrator ----------
# Toolchain Prisma AUTONOME pour `migrate deploy` au runtime. On installe la CLI
# prisma dans un préfixe isolé (/opt/prisma-tools) : bun y résout TOUTES les
# dépendances transitives réellement nécessaires (dont `effect`, `c12`… requis
# par @prisma/config) et fetch le schema-engine linux-musl. On évite ainsi de
# copier le node_modules complet (788 Mo) ou de deviner les paquets hoistés.
FROM node:22-alpine AS migrator
WORKDIR /opt/prisma-tools
COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun
RUN echo '{"name":"prisma-tools","private":true}' > package.json \
 && bun add prisma@7.9.0
# Schéma + migrations + config prod + seed transpilé, servis à l'étage production.
COPY --from=builder /app/prisma/seed.mjs /opt/prisma-tools/prisma/seed.mjs
COPY prisma/schema.prisma /opt/prisma-tools/prisma/schema.prisma
COPY prisma/migrations /opt/prisma-tools/prisma/migrations
# Config Prisma dédiée prod (CJS, node-loadable) renommée en prisma.config.js,
# auto-découverte par la CLI. Ne coexiste jamais avec prisma.config.ts (dev only).
COPY prisma/prod.config.js /opt/prisma-tools/prisma.config.js

# ---------- production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# Story 5.12 — libvips au RUNTIME, et pas seulement au build.
#
# 🛑 PIÈGE (le point dur de la story, comme Prisma en 4.6) : sharp traite les
# images au moment de l'UPLOAD, donc dans ce conteneur-ci, pas dans `builder`.
# `vips-dev` à l'étage builder ne sert qu'à l'installation du paquet ; sans
# libvips ici, le premier téléversement en production échoue sur
# « Could not load the "sharp" module using the linux-musl-arm64 runtime ».
#
# `vips` (bibliothèque partagée) suffit au runtime : `vips-dev` n'apporte que
# les en-têtes de compilation, inutiles ici et plus lourds.
RUN apk add --no-cache vips
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
# Story 5.12 — Point de montage du volume `portfolio_uploads` (AC1).
#
# ⚠️ Créé ET attribué à `nextjs` AVANT le `USER nextjs` : le conteneur tourne en
# non-root (Epic 2). Docker donne à un volume nommé vide la propriété du
# répertoire qu'il recouvre au premier montage — sans ce `chown`, il hériterait
# de root:root et tout téléversement échouerait sur EACCES.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
# La sortie standalone ne contient ni les assets statiques ni public/ :
# les trois copies sont obligatoires, dans cet ordre.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Story 4.6 — Toolchain Prisma (CLI + engines + config + migrations) dans un
# répertoire ISOLÉ : ne clobbe pas le node_modules du standalone (runtime Next).
# Le seed transpilé va à côté de server.js pour résoudre @prisma/adapter-pg + pg
# depuis le node_modules du standalone.
COPY --from=migrator --chown=nextjs:nodejs /opt/prisma-tools ./prisma-tools
COPY --from=migrator --chown=nextjs:nodejs /opt/prisma-tools/prisma/seed.mjs ./prisma/seed.mjs
# Story 5.1 — argon2 est un module natif (node-gyp-build charge un .node depuis
# ses `prebuilds/`). On le garde EXTERNE au bundle du seed (build:seed) : inliné,
# Bun fige le chemin absolu de la machine de build → introuvable en prod. Externe,
# il faut donc le fournir à côté du seed. On copie le paquet complet (avec ses
# prebuilds multi-plateformes, dont linux-musl du conteneur) là où le standalone
# place déjà `pg`, pour que `node prisma/seed.mjs` le résolve comme pg.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/argon2 ./node_modules/argon2
# Story 5.6 — Script de secours 2FA (commande de dernier recours, lancée à la
# main par `docker exec`, jamais au démarrage). Placé à côté de server.js pour
# résoudre @prisma/adapter-pg + pg depuis le node_modules du standalone, comme le
# seed. Voir docs/ops/runbook-5-6-reset-2fa-secours.md.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/admin-reset-2fa.mjs ./scripts/admin-reset-2fa.mjs
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
USER nextjs
# Sans HOSTNAME=0.0.0.0, server.js n'écoute que sur localhost interne
# et le reverse proxy renvoie 502.
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
# Story 4.6 : l'entrypoint applique migrate deploy → seed → node server.js,
# AVANT de servir du trafic. Tout échec migrate/seed interrompt le démarrage
# (exit non-zéro) → aucun port n'écoute → healthcheck rouge (AC2).
ENTRYPOINT ["./docker-entrypoint.sh"]
# Pas de HEALTHCHECK ici : délégué au compose (story 2.5).
