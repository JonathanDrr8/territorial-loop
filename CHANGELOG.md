# Changelog

Alle nennenswerten Änderungen an `territorial-loop`. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unreleased]

## [0.1.1] – 2026-05-29

### Hinzugefügt

- **Privat/Öffentlich pro Lobby:** Host-Toggle „Sichtbar" — öffentliche Lobbys erscheinen im
  Server-Browser, private nur per Code/Link.
- **Einladungslinks:** `https://loop.jarhost.de/?room=CODE` öffnet das Spiel direkt in der Lobby;
  in der Lobby gibt es einen „🔗 Kopieren"-Knopf.
- **Zufalls-Default-Name** pro Browser (statt „Du" für alle; wichtig fürs namensbasierte Reconnect).

### Behoben

- **„Leiche":** der „Wieder verbinden"-Knopf erscheint nur noch, wenn der Server bestätigt, dass
  Raum/Slot wirklich rejoinable sind (`/rejoinable`) — sonst wird die alte Sitzung verworfen.
- Feedback-Lese-Skript griff den Container- statt Host-Volume-Pfad.

## [0.1.0] – 2026-05-29

Erste versionierte, **online spielbare** Fassung (gehostet auf `loop.jarhost.de`).

### Hinzugefügt

- **Mehrspieler (server-autoritatives Lockstep, ADR-0009):** simulierender Node+ws-Server,
  Client-`NetworkTransport`, Lobby (Raum-Code, Ready, host-konfigurierbare Match-Settings),
  **Server-Browser** (offene Lobbys im Hauptmenü), **Reconnect** nach Verbindungsabbruch
  (Snapshot), adaptiver Input-Delay (Latenz-gemessen).
- **Deployment:** ein Node-Prozess liefert Client + Lockstep; Docker-Build aus GitHub;
  Auto-Lockstep-Server im Vite-Dev; gehostet hinter Caddy (TLS).
- **Determinismus-Fundament:** serialisierbarer PRNG-State, `serializeState`/`deserializeState`,
  Replay-Harness, cross-engine-deterministische Mathematik (`det-math`).
- **Spielmechanik (Auswahl):** Fabrik-Netzwerk-Wirtschaft inkl. Auslands-Bonus (auch fremde
  Fabriken), Kriegsschiffe/Handel/Boote, Diplomatie mit Verrat (Bestätigungsdialog + Verräter
  auf Karte/HUD sichtbar), Beziehungssystem (Groll/Gunst), wilde Nationen, Terrain-Höhen,
  4-stufige Kamera-Darstellung.

### Behoben

- Multiplayer: eigene Angriffe/HUD korrekt dem lokalen Spieler zugeordnet (statt erstem Menschen).

[Unreleased]: https://github.com/JonathanDrr8/territorial-loop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JonathanDrr8/territorial-loop/releases/tag/v0.1.0
