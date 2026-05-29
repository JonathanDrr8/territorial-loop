# ADR 0014: Hauptmenü-Umbau (Top-Nav-Shell mit Kategorien) — Plan

## Status

Proposed (Plan — wartet auf Jonathans Freigabe + die offenen Entscheidungen unten).

## Datum

2026-05-30

## Kontext

Das Start-Menü ist über die letzten Features organisch gewachsen und inzwischen voll: ein
zwei-spaltiges Panel (Einstellungen + „Experimentell"), seit dem Multiplayer eine **dritte
Spalte** „Offene Lobbys", ein **Reconnect-Banner** darüber, ein separater **Mehrspieler-Dialog**,
ein schwebender **Feedback-Knopf** und die **Steuerungs-Hilfe** steckt im In-Game-HUD. Das ist
funktional, aber als Einstieg unübersichtlich und skaliert schlecht für Kommendes (Zuschauen,
Leaderboard/ELO, News).

Jonathan möchte das **gängige Web-Pattern**: oben eine **Kategorie-Navigation**, darunter ein
Inhaltsbereich, der je nach Tab wechselt — angelehnt an OpenFronts Aufbau (PLAY / NEWS / SETTINGS
/ LEADERBOARD / … oben, zentraler Spielbereich, Karten-Hintergrund), **aber bewusst nicht
kopiert**: eigener Look, eigene Kategorien, eigenes Spielgefühl ([[project-eigenes-spielgefuehl]]).

Dies betrifft nur das **Vor-dem-Match-Menü**. Das In-Game-HUD ist ADR-0010 (separat).

## Entscheidung (Struktur)

Ein **Menü-Shell** mit drei festen Zonen, über einem dezenten Hintergrund:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  territorial-loop          [ Spielen ][ Mehrspieler ][ Einstellungen ]        │  ← Header:
│  v0.1.1                    [ Changelog ][ Hilfe ]              Name [ Xaro ]   │     Logo+Version,
├─────────────────────────────────────────────────────────────────────────────┤     Nav, Name
│                                                                               │
│                        ▓ Inhalt des aktiven Tabs ▓                            │  ← Content
│                                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  GitHub · Feedback 🐞                                          v0.1.1 · 2026  │  ← Footer
└─────────────────────────────────────────────────────────────────────────────┘
     (Hintergrund: dezente Welt-/Hex-Textur, stark abgedunkelt)
```

- **Header:** Logo + Versionsnummer links; Kategorie-Tabs mittig; Spielername-Feld rechts
  (global, gilt für Single + MP — heute im Einstellungs-Panel).
- **Content:** wechselt mit dem aktiven Tab (kein Seiten-Reload — Vanilla-DOM-Tab-Switch).
- **Footer:** dezente Links (GitHub) + Feedback + Version. (Sprache ist nur Deutsch → kein
  Sprach-Switcher.)

## Kategorien (Tabs) → was reinzieht

| Tab                        | Inhalt (woher heute)                                                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spielen**                | Karten-/Match-Setup (Karte, Terrain, Gegner/Wilde, Schwierigkeit, Sieg-%, Seed, Tempo) + große **„Match starten"** + **„Zuschauen"**. (Aus dem heutigen Einstellungs-Panel.)                                                            |
| **Mehrspieler**            | Lobby-Browser (offene **und** laufende Spiele → Beitreten/Zuschauen), Raum erstellen (privat/öffentlich), per Code/Link beitreten, „Wieder verbinden". (Faltet `lobby-browser.ts` + `multiplayer-menu.ts` + Reconnect-Banner zusammen.) |
| **Einstellungen**          | Kamera-Darstellung, Sound, Experimentell-Flags. (Aus rechtem „Experimentell"-Panel + Kamera/Sound.)                                                                                                                                     |
| **Changelog**              | `CHANGELOG.md` gerendert (Markdown → HTML), zeigt was neu ist.                                                                                                                                                                          |
| **Hilfe**                  | Steuerungs-Referenz (heute im HUD versteckt) + „Wie funktioniert das Truppen-Wachstum?".                                                                                                                                                |
| _(später)_ **Leaderboard** | Platzhalter/„Bald", an [[feature-idea-accounts-elo]] gekoppelt — erst wenn Accounts existieren.                                                                                                                                         |

**Feedback** bleibt als schwebender 🐞-Knopf (immer erreichbar, auch im Match) **plus** ein Eintrag
im Footer. **Default-Tab:** „Spielen".

## Technischer Ansatz

- Neues `src/ui/menu-shell.ts`: rendert Header/Footer/Hintergrund + verwaltet die Tabs (reines
  Vanilla-DOM, kein Framework — ADR-0001/Projekt-Konvention). Jeder Tab ist eine Render-Funktion,
  die ein Content-Element liefert; Wechsel = Inhalt austauschen.
- **Bestehende Bausteine wiederverwenden, nicht neu schreiben:** das heutige `createStartMenu`
  wird zur **„Spielen"-Tab-Funktion** (Setup-Felder + Start/Zuschauen); `lobby-browser.ts` +
  `multiplayer-menu.ts` wandern in den **„Mehrspieler"-Tab**; das Experimentell-Panel +
  Kamera/Sound in **„Einstellungen"**. So bleibt die Logik (Prefs, Lobby, Transport) unangetastet,
  es ändert sich die **Hülle/Anordnung**.
- `main.ts`-`showMenu()` erzeugt künftig die Shell statt des direkten Start-Menüs; die Callbacks
  (onStart, onJoinLobby, reconnect, …) bleiben gleich verdrahtet.
- Hintergrund: dezente statische Textur/Verlauf (kein live gerenderter Map-Canvas — zu teuer fürs
  Menü; Option für später). Akzentfarbe wie im Spiel (Cyan).

## Phasen (kleine Schritte, [[feedback-kleine-schritte-ui]])

1. **Shell + Reorg (keine neue Funktion):** Header-Nav + Tab-Routing + Footer + Hintergrund; die
   **vorhandenen** Inhalte in Tabs einsortiert (Spielen/Mehrspieler/Einstellungen/Changelog/Hilfe).
   Großer optischer Schritt, aber risikoarm (Logik unverändert). **Hier zuerst Freigabe per Mockup.**
2. **Mehrspieler-Tab-Politik:** Lobby-Browser inkl. laufender Spiele (= Zuschauen-Einstieg, der
   ohnehin anstehende Schritt), Erstellen/Beitreten/Privat sauber im Tab statt im Extra-Dialog.
3. **Politur:** Karten-Vorschau-Kacheln im „Spielen"-Tab (wie OpenFronts Karten-Karten, aber aus
   unserem Seed generiert), Tab-Übergänge, Responsives Layout.
4. _(später)_ Leaderboard-Tab, wenn Accounts/ELO kommen.

## Offene Entscheidungen (für Jonathan)

1. **Kategorien:** Passt das Set (Spielen / Mehrspieler / Einstellungen / Changelog / Hilfe)?
   Etwas weglassen/umbenennen? „Leaderboard" jetzt als „Bald"-Platzhalter zeigen oder ganz weg?
2. **Spielen ↔ Mehrspieler getrennt** (zwei Tabs) oder **ein „Spielen"-Tab** mit Solo + MP
   untereinander (näher an OpenFront: SOLO groß, darunter Create/Join Lobby)?
3. **Hintergrund:** dezente statische Textur (einfach) — oder später ein live gerendertes
   Karten-Bild (aufwändiger)?
4. **Karten-Vorschau-Kacheln** (Phase 3) gewünscht oder unnötig (wir generieren zufällig)?
5. **Umfang Phase 1:** nur umräumen (gleiche Inhalte, neue Hülle) — passt das als erster Schritt?

## Verifikation

- `npm run typecheck && npm run lint && npm run test:run` grün (UI-Umbau bricht keine Tests).
- Browser: jeder Tab erreichbar, Inhalte funktionieren wie vorher (Match starten, Lobby
  erstellen/beitreten, Einstellungen wirken, Changelog lesbar, Hilfe da, Feedback/Reconnect/Version).
- Single-Player- und Mehrspieler-Flow unverändert lauffähig (lokal + gegen `loop.jarhost.de`).

## Konsequenzen

- **Pro:** klarer Einstieg, skaliert für Zuschauen/Leaderboard/News, ein vertrautes Web-Pattern,
  Logik bleibt (nur Hülle neu).
- **Contra/Risiko:** größerer UI-Umbau an `start-menu.ts` → bewusst in Phasen, Phase 1 zuerst per
  Mockup freigeben. Reines Vor-Match-Menü; In-Game-HUD bleibt ADR-0010.

```

```
