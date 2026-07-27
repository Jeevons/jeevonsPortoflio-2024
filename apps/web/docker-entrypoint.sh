#!/bin/sh
# Entrypoint de production (Story 4.6) — convention Doshwork.
#
# Ordre STRICT, AVANT que le serveur n'écoute (AC1) :
#   1. prisma migrate deploy  (applique les migrations en attente — jamais migrate dev)
#   2. seed idempotent        (n'écrase jamais de contenu existant)
#   3. node server.js         (le serveur commence à servir du trafic)
#
# `set -e` : toute erreur de (1) ou (2) interrompt le démarrage avec un exit
# non-zéro (AC2). Le serveur n'est alors JAMAIS lancé → aucun port n'écoute →
# le healthcheck (wget /api/health) reste rouge → l'orchestrateur ne route pas
# de trafic vers une app dont la base est incohérente. Le gating vient de l'ordre
# de démarrage, PAS d'un check DB dans /api/health (hors périmètre, piège n°3).
#
# Sécurité : on ne logue jamais DATABASE_URL ni aucun secret (AGENTS.md §6).
#
# Concurrence (piège n°6) : portfolio mono-conteneur (un seul service `web`) →
# pas de course entre entrypoints. `migrate deploy` prend de toute façon un
# verrou d'avis côté Postgres. Pas de verrou applicatif ajouté (hors périmètre).
set -e

APP_DIR="$(pwd)"

# 1) Migrations : exécutées DEPUIS le toolchain isolé /app/prisma-tools, qui
# contient la CLI prisma, ses dépendances, le schéma, les migrations et
# prisma.config.js (datasource.url lue depuis DATABASE_URL de l'environnement).
echo "[entrypoint] 1/3 — Application des migrations (prisma migrate deploy)…"
cd "$APP_DIR/prisma-tools"
node node_modules/prisma/build/index.js migrate deploy
cd "$APP_DIR"

# 2) Seed idempotent : bundle node autonome, exécuté depuis /app pour résoudre
# @prisma/adapter-pg + pg dans le node_modules du standalone.
echo "[entrypoint] 2/3 — Seed idempotent…"
node prisma/seed.mjs

# 3) Serveur : seulement après le succès de (1) et (2).
echo "[entrypoint] 3/3 — Démarrage du serveur Next (node server.js)…"
exec node server.js
