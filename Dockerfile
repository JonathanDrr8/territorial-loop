# Lockstep-Server + ausgelieferte Client-App in EINEM Node-Prozess (ADR-0009).
# Build: aus dem Git-Repo (Docker Compose `build:` mit Git-URL-Kontext) oder lokal.
FROM node:20-slim

WORKDIR /app

# Abhängigkeiten zuerst (Layer-Cache). npm ci installiert auch Dev-Deps — gebraucht für
# den Build (vite/tsc) UND zur Laufzeit (tsx fährt server/server.ts).
COPY package.json package-lock.json ./
RUN npm ci

# Quellcode + Client-Build nach dist/ (der Server liefert dist/ statisch aus).
COPY . .
RUN npm run build

ENV PORT=8787
EXPOSE 8787

# Serviert die gebaute App (dist/) + Lockstep-WebSocket auf demselben Port.
CMD ["npm", "run", "server"]
