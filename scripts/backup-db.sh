#!/usr/bin/env bash
# WAL-konsistentes Backup der Account-/Ranglisten-DB (ADR-0027).
#
# Läuft auf dem Container-Host (LXC 307, in /opt/territorial). Nutzt die SQLite-Online-Backup-API
# IM laufenden Container (better-sqlite3 ist dort vorhanden) → kein sqlite3-CLI nötig, garantiert
# konsistent auch während Schreibzugriffen. Schreibt nach ./backups (muss als Volume gemountet
# sein) und rotiert auf die letzten $KEEP Stände.
#
# Einrichtung als täglicher Cron auf dem LXC, z.B.:
#   0 4 * * *  cd /opt/territorial && ./scripts/backup-db.sh >> /var/log/tl-backup.log 2>&1
# Oder vom PVE aus:  pct exec 307 -- bash -c 'cd /opt/territorial && ./scripts/backup-db.sh'
set -euo pipefail

SERVICE="${SERVICE:-territorial}"   # docker-compose Service-Name
KEEP="${KEEP:-14}"                  # wie viele Backups behalten
STAMP="$(date +%Y%m%d-%H%M%S)"

cd "${TL_DIR:-/opt/territorial}"
mkdir -p backups

# Online-Backup über better-sqlite3 (im Container). DATA_DIR ist im Image gesetzt (/app/data).
docker compose exec -T "$SERVICE" node -e "
  const Database = require('better-sqlite3')
  const src = (process.env.DATA_DIR || '/app/data') + '/accounts.db'
  const db = new Database(src, { readonly: true })
  db.backup('/app/backups/accounts-${STAMP}.db')
    .then(() => { console.log('backup ok: accounts-${STAMP}.db'); process.exit(0) })
    .catch((e) => { console.error(e); process.exit(1) })
"

# Rotation: nur die neuesten $KEEP behalten.
ls -1t backups/accounts-*.db 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "Backups vorhanden: $(ls -1 backups/accounts-*.db 2>/dev/null | wc -l) (behalte $KEEP)"
