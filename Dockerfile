# Lockstep-Server + ausgelieferte Client-App in EINEM Node-Prozess (ADR-0009).
# Build: aus dem Git-Repo (Docker Compose `build:` mit Git-URL-Kontext) oder lokal.
FROM node:20-slim

WORKDIR /app

# Build-Tools für native Module: better-sqlite3 (ADR-0027) hat für node:20-slim kein Prebuild,
# fällt also auf `node-gyp` zurück → braucht python3/make/g++. Ohne diese schlägt `npm ci` fehl.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Abhängigkeiten zuerst (Layer-Cache). npm ci installiert auch Dev-Deps — gebraucht für
# den Build (vite/tsc) UND zur Laufzeit (tsx fährt server/server.ts).
COPY package.json package-lock.json ./
RUN npm ci

# Quellcode + Client-Build nach dist/ (der Server liefert dist/ statisch aus).
COPY . .
RUN npm run build

ENV PORT=8787
# Persistente Daten (Account-/Ranglisten-DB, ADR-0027). Dieses Verzeichnis MUSS als Volume
# gemountet werden (docker-compose: `./data:/app/data`), sonst gehen die Accounts bei jedem
# `--build`/Recreate verloren. Feedback liegt analog unter /app/feedback.
ENV DATA_DIR=/app/data
EXPOSE 8787

# Serviert die gebaute App (dist/) + Lockstep-WebSocket auf demselben Port.
CMD ["npm", "run", "server"]
