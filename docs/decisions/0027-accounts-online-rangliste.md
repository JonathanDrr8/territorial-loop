# ADR-0027: Accounts + Online-Rangliste

**Status:** Accepted — Phase 1–2 live (v0.28.0/0.29.0); Phase 3 (Konto löschen + Datenschutz-Hinweis) umgesetzt
**Datum:** 2026-06-01

## Kontext

Bisher ist das Spieler-ELO (ADR-0022, `src/ui/ranked.ts`) rein **lokal in localStorage** — pro
Gerät, nicht wiederherstellbar, keine geräteübergreifende oder öffentliche Bestenliste. Jonathan
will ein **Account-System** mit persistenter Online-Rangliste. Der MP-Server (`server/`) ist ein
schlanker `ws`-Server **ohne Datenbank** (State nur im RAM).

Leitplanken aus dem Design-Gespräch:

- **Login ist optional.** Solo/offline bleibt unangetastet; Mehrspieler funktioniert wie bisher
  ohne jeden Account. Ein Login ist ein **Upgrade obendrauf**, nie eine Hürde davor.
- **Datensparsamkeit zuerst** (DSGVO, DE): so wenig Personenbezogenes wie möglich.
- **Kein Discord/OAuth** (Jonathan nutzt es selbst nicht).
- **Eigener Account = Username + Passwort.** Email **nur optionaler Zusatz** fürs bequeme
  Passwort-Reset (wer keine angibt, nutzt einen Recovery-Code).
- **Die Spielsimulation wird NICHT angefasst.** Accounts sind reine Server-Metadaten um Matches
  herum (Lobby, Identität, ELO-Persistenz) → kein Determinismus-/MP-Risiko.

## Entscheidung

### Technik-Fundament

- **DB: SQLite via `better-sqlite3`** — eine Datei, synchron, production-tauglich, passend zur
  Größe. Liegt in einem **festen Pfad außerhalb des Repos** auf dem Server, überlebt jedes
  Deployment, wird per Cron gesichert. Die DB-Datei kommt **nie ins Git** (`.gitignore`); nur das
  Schema/die Migrationen liegen im Repo.
- **Passwort-Hashing: `scrypt` aus Nodes eingebautem `crypto`** — keine neue Dependency, kein
  nativer Krypto-Build.
- **Sessions: opakes Zufalls-Token in der DB** (kein JWT), liegt clientseitig im localStorage.

### Identitäts-Modell (drei Stufen, alle spielbar)

1. **Solo / offline** — kein Server, kein Account (unverändert).
2. **Online ohne Login (Gast)** — der Server vergibt beim ersten Kontakt still ein anonymes
   **Gast-Token** (im localStorage). ELO/Bilanz werden serverseitig daran gebunden; der Spieler
   taucht mit seinem gewählten Namen in der Rangliste auf. Kein Anmelden nötig. Pseudonym, keine
   personenbezogenen Daten → datenschutzlich unkritisch.
3. **Online mit Login (optional)** — bindet das Gast-Token an einen echten Account (Username +
   Passwort, Email optional) → wiederherstellbar + geräteübergreifend.

### ELO = Solo-Ranglisten-ELO, Mehrspieler bewegt es NICHT

Das vorhandene `ranked.ts` (ELO/Bilanz/Peak, Standard-Formel, Match-Verbuchung gegen skalierende
KI) bleibt die einzige ELO-Mechanik. Accounts ersetzen nur die **localStorage-Persistenz** durch
**Server-Persistenz pro Account/Gast** und liefern eine **Online-Bestenliste** (HTTP-Endpoint).

**Entscheidung (Jonathan):** Das Online-ELO ist schlicht das Solo-Ranglisten-ELO. **Mehrspieler-Matches
verändern das ELO nicht** — sie sind sozialer Spielplatz ohne Wertung. Begründung: Echtes
Mensch-gegen-Mensch-ELO bräuchte mehrere Menschen pro Match; real sind MP-Matches aber meist wenige
Menschen + viele Bots → FFA-Wertung (paarweise Zerlegung wie `elo.ts` oder Platzierungs-ELO) wäre
kaum aussagekräftig. Solo gegen kalibrierte Bots ist das sauberere Können-Maß. MP-Wertung bleibt eine
spätere Option, falls echte Menschen-Lobbys zur Norm werden.

**Vertrauensmodell:** Da der Solo-Modus clientseitig läuft, ist das gemeldete ELO theoretisch
fälschbar (Ehrenbasis). Für ein kleines Spiel unter Bekannten akzeptiert; auf server-validierte
MP-Wertung umstellbar, sobald das Spiel kompetitiv/öffentlich wird.

### Rechtliches (pragmatisch, da privates Hobby-Projekt)

- **Kein Impressum vorerst** — die Seite ist unbekannt/nicht beworben; Risiko gering. Nachrüstbar
  (ladungsfähige Adresse mietbar ab ~5 €/Monat), sobald ein echtes öffentliches Release ansteht.
- **Kontakt-Email** (über `jarhost.de`) als niedrigschwelliger Kontakt + Anlaufstelle für
  Auskunfts-/Löschanfragen. (Ersetzt rechtlich kein Impressum, ist aber der richtige erste Schritt.)
- Datenschutzerklärung + „Account löschen" + Auskunft kommen mit den Login-Phasen / vor einem
  öffentlichen Start.

## Phasen

| Phase                      | Inhalt                                                                                                                                                                                                    | Liefert                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **1 — Fundament**          | SQLite + Gast-Token + ELO/Bilanz serverseitig persistent + Online-Bestenliste                                                                                                                             | Persistente Online-Rangliste, ohne Login          |
| **2 — Eigener Account**    | Username + Passwort (scrypt) + Recovery-Code, Email optional, Login/Register-UI, Gast → Account „upgraden"                                                                                                | Wiederherstellung + Cross-Device                  |
| **3 — Sozial + Pflichten** | **Umgesetzt:** „Konto löschen" (passwort-bestätigt, echtes DELETE) + knapper Datenschutz-Hinweis (was gespeichert wird + Kontakt) im Account-Dialog, 9 Sprachen. (Profilname in Lobby/Rangliste separat.) | Selbst-Löschung + Transparenz, rechtlich sauberer |

## Offene Punkte

- **SMTP für Phase 2:** In der Homelab-Doku ist **kein eigener Mailserver** dokumentiert; `jarhost.de`
  liegt bei INWX. Konkrete SMTP-Zugangsdaten für den transaktionalen Versand (Passwort-Reset) sind
  vor Phase 2 zu klären (inkl. SPF/DKIM/DMARC, sonst landen Mails im Spam). **Phase 1 braucht keine Mail.**
- **MP-Match-Wertung:** Vorerst **entschieden, dass MP das ELO NICHT bewegt** (s.o.). Eine spätere
  Umstellung auf server-validierte FFA-Wertung bleibt möglich, wenn echte Menschen-Lobbys zur Norm werden.
- **Missbrauch:** Smurfs, ELO-Farmen, unschöne Profilnamen — simple Moderation später.
- **DB-Persistenz über Deploy:** Deploy-Skript darf die DB-Datei nicht überschreiben/löschen
  (fester Pfad außerhalb Repo) + Backup-Cron einrichten.

## Deploy-Setup (Phase 1)

Der Server läuft als Docker-Container (LXC 307, `/opt/territorial`, `docker compose`). Damit die
Accounts ein `--build`/Recreate überleben, sind **zwei Dinge nötig** (einmalig auf dem Server):

1. **Volumes** in `/opt/territorial/docker-compose.yml` beim Service ergänzen:

   ```yaml
   volumes:
     - ./data:/app/data # Account-/Ranglisten-DB (ADR-0027) — MUSS persistent sein
     - ./backups:/app/backups # Ziel der täglichen DB-Backups
     # - ./feedback:/app/feedback  # (bereits vorhanden)
   ```

   Das Image setzt `DATA_DIR=/app/data`; ohne den Mount landet die DB im Container-Layer und ist
   nach jedem Deploy weg.

2. **Backup-Cron** auf dem LXC (`scripts/backup-db.sh`, WAL-konsistent über die SQLite-Backup-API):
   ```cron
   0 4 * * *  cd /opt/territorial && ./scripts/backup-db.sh >> /var/log/tl-backup.log 2>&1
   ```

**Build-Tools:** `better-sqlite3` hat für `node:20-slim` kein Prebuild → das Dockerfile installiert
`python3/make/g++` vor `npm ci` (verifiziert: ohne sie schlägt der Build fehl).

## Konsequenzen

**Positiv:** Persistente Online-Rangliste auf vorhandener ELO-Mechanik; Login optional → keine
Einstiegshürde; datensparsam; Simulation/Determinismus unberührt.

**Negativ / Risiko:** Erste echte Server-Persistenz (DB-Backup/Deploy-Sorgfalt nötig);
`better-sqlite3` ist ein nativer Build (Build-Tools auf dem Server vorausgesetzt); rechtliche
Pflichten (Impressum/Datenschutz) wachsen mit echter Öffentlichkeit.
