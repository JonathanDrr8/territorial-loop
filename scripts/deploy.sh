#!/usr/bin/env bash
# Sofort-Deploy auf loop.jarhost.de: lokalen Stand nach GitHub pushen + Container SOFORT neu bauen.
# HINWEIS: Seit 2026-05 läuft auf dem Container ein Auto-Deploy (systemd-Timer pollt GitHub main
# alle 2 Min) — ein normaler `git push origin main` geht also von allein live. Dieses Skript ist
# nur noch für „jetzt sofort + patch-Versions-Bump" gedacht.
# Lokal entwickeln (npm run dev) bleibt unberührt.
set -euo pipefail

PVE="${PVE_HOST:-192.168.188.64}"
CTID="${CT_ID:-307}"

# Version bei jedem Live-Push hochzählen (patch) + Commit + Tag. Verlangt sauberen Tree —
# Feature-Änderungen also vorher committen. Für minor/major: vorher `npm version minor` o.ä.
echo "→ Version-Bump (patch) + Tag"
npm version patch -m "release: v%s"

echo "→ git push origin main (inkl. Tag)"
git push origin main --follow-tags

echo "→ Rebuild im Container ($CTID) aus GitHub …"
ssh root@"$PVE" "pct exec $CTID -- bash -c 'cd /opt/territorial && docker compose up -d --build'"

echo "→ Verifiziere live …"
sleep 4
ver=$(curl -fsS https://loop.jarhost.de/version || echo '{}')
echo "loop.jarhost.de: $ver"
curl -fsS -o /dev/null -w '  /health → %{http_code}\n' https://loop.jarhost.de/health
echo "✓ fertig"
