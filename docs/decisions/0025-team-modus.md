# ADR-0025: Team-Modus

**Status:** Accepted (Phase 1 — „allied" — umgesetzt; „shared" offen)
**Datum:** 2026-06-01

## Kontext

Jonathan möchte im Mehr- und Einzelspieler in Teams spielen. Zwei gewünschte Modi:

1. **Geteilte Nation** („shared"): mehrere Spieler steuern DIESELBE Nation (eine Farbe, eine Fläche,
   gemeinsames Gold/Truppen).
2. **Verbündete Nationen** („allied"): jeder hat seine eigene Nation, aber Teamkameraden kämpfen nie
   gegeneinander — wie eine feste Allianz.

Die **Siegbedingung gilt pro Team** (addierte Werte der Mitglieder). Team-Größe und Team-Anzahl sind
frei einstellbar (Slider); der Rest wird mit KI aufgefüllt, die ebenfalls in Teams agiert. Auch im
Solo-Spiel verfügbar.

## Entscheidung

### Datenmodell (umgesetzt)

- `PlayerDef.teamId?` / `Player.teamId?` — gleiche `teamId` = ein Team. Wilde haben nie ein Team.
- `GameConfig` trägt die Teams über die Player-Liste (kein eigenes Config-Feld nötig).

### Modus „allied" (umgesetzt)

- Bei `createGame` werden **permanente Allianzen** zwischen Teamkameraden geseedet
  (`seedTeamAlliances`): als Allianz OHNE `allianceExpiry`-Eintrag → läuft nie ab. Dadurch greift die
  **gesamte vorhandene Allianz-Logik** ohne Sonderpfade (kein Beschuss, KI verschont Kameraden).
- **Kein Friendly Fire:** `applyAttackIntent` lehnt Angriffe auf Teamkameraden ab (`sameTeam`).
- **KI verrät keine Kameraden:** `planDiplomacy` schließt Teamkameraden aus den verratbaren
  Verbündeten aus.
- **Team-Sieg:** `checkVictory` summiert das Gebiet pro „Seite" (`sideOf` = `teamId ?? -id`); ein
  Team gewinnt, sobald die **Summe** seiner Mitglieder die `victoryPct`-Schwelle erreicht.
- **UI:** Play-Tab → „Modus" → Teams = „Aus / Teams (verbündet)" + Slider Team-Anzahl (2–8) &
  Team-Größe (1–6). `buildConfig` erzeugt `teamCount × teamSize` Nationen (Mensch = Slot 0), füllt
  mit KI auf und vergibt `teamId = floor(slot / teamSize)`.
- Komponiert mit dem Hauptstadt-Modus (ADR-0026): `checkCaptureVictory` ist team-bewusst.

### Modus „shared" (offen)

Eine geteilte Nation = EIN Spieler-Entity mit mehreren Controllern. Das ist primär ein
Mehrspieler-Thema (zwei Clients mit derselben `humanId` → beide Intents wirken auf dieselbe Nation)
und braucht Lobby-Slot-Zuweisung. Im Solo ergibt „geteilt" wenig Sinn (Co-op-KI auf der eigenen
Nation wäre chaotisch). **Bewusst zurückgestellt**, bis die MP-Lobby Team-/Slot-Zuweisung kann.

## Konsequenzen

- Solo-Team-Spiel (allied) funktioniert sofort, deterministisch, MP-sicher (nur Player-Felder, die via
  `...rest` serialisiert werden).
- MP-Team-Spiel braucht noch: Team-Settings in `MatchSettings` + Lobby-Team-Zuweisung (offen).
- `shared`-Modus ist noch nicht wählbar (nur `off`/`allied`).
