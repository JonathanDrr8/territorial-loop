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

### MP-Team-Zuweisung (umgesetzt)

- `MatchSettings` trägt `captureMode`/`teamMode`/`teamCount`/`teamSize`; der **Server** baut daraus
  die Config (single source → kein Client/Server-Mismatch).
- **Gezielte Team-Wahl:** `PeerInfo.teamId` + Client-Nachricht `set-team`. In der Lobby wählt jeder
  Spieler sein Team über ein Dropdown (eigenes editierbar, fremde als Anzeige). Der Server speichert
  `Member.teamId` und vergibt in `buildConfig` die Teams: Menschen ins gewählte Team (sonst ins am
  wenigsten belegte), **KI füllt jedes Team auf `teamSize` auf**. Verifiziert: zwei Tabs, gezielte
  Team-Wahl übernommen, Lockstep läuft.

## Konsequenzen

- Solo- UND MP-Team-Spiel (allied) funktioniert, deterministisch, MP-sicher (Player-Felder via
  `...rest` serialisiert; Config server-autoritativ).
- `shared`-Modus ist noch nicht wählbar (nur `off`/`allied`).
