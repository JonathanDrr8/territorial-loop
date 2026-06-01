# ADR-0025: Team-Modus

**Status:** Accepted (Phase 1 „allied" + Phase 2 „shared" umgesetzt)
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

### Modus „shared" (umgesetzt)

Eine geteilte Nation = ein Team IST EINE Nation (ein Land statt mehrere — gleiche Logik wie „allied",
nur kollabiert jedes Team zu einer Nation). `teamCount` = Anzahl Nationen; jedes von Menschen gewählte
Team ist eine gemeinsam gesteuerte Nation, ungewählte sind KI. `teamSize` entfällt im geteilten Modus.

- **MP:** Der Server mappt mehrere Mitglieder → dieselbe Nation-ID (`Member.nationId`, in `buildConfig`
  gesetzt), **routet ihre Intents dorthin** (`submitIntents(..., member.nationId)`; `submitIntents`
  filtert ohnehin auf `intent.playerId === nationId`, und jeder Client baut Intents mit seiner
  `humanId`). Beim Start bekommt jeder Client per-Socket `start.youAre` = seine Nation (≠ Lobby-ID).
  Verifiziert mit zwei Tabs: beide steuern Nation 1, KI ist Nation 2, Lockstep sauber.
- **Solo:** kein echtes Teilen (nur ein Mensch) → einfach ein Spiel mit `teamCount` Nationen, der
  Mensch steuert eine, der Rest KI. Keine Allianzen (jede shared-Nation ist eine eigene Seite).

### MP-Team-Zuweisung (umgesetzt)

- `MatchSettings` trägt `captureMode`/`teamMode`/`teamCount`/`teamSize`; der **Server** baut daraus
  die Config (single source → kein Client/Server-Mismatch).
- **Gezielte Team-Wahl:** `PeerInfo.teamId` + Client-Nachricht `set-team`. In der Lobby wählt jeder
  Spieler sein Team über ein Dropdown (eigenes editierbar, fremde als Anzeige). Der Server speichert
  `Member.teamId` und vergibt in `buildConfig` die Teams: Menschen ins gewählte Team (sonst ins am
  wenigsten belegte), **KI füllt jedes Team auf `teamSize` auf**. Verifiziert: zwei Tabs, gezielte
  Team-Wahl übernommen, Lockstep läuft.
- **`set-team` gilt für `allied` UND `shared`.** Anfangs nahm der Handler nur `allied` an — im
  geteilten Modus wurde die Team-Wahl still verworfen, sodass alle Menschen auf Team 0 → derselben
  Nation landeten und sich nicht gezielt auf verschiedene Nationen aufteilen konnten. Behoben; per
  E2E-Test abgesichert (`tests/server-e2e.test.ts`): verschiedene Teams → Nation 1 vs. 2, gleiches
  Team → gemeinsame Nation, Lockstep in beiden Fällen sauber. **Geteiltes Gold/Truppen/Gebiet kommen
  gratis**, weil eine geteilte Nation buchstäblich EIN `Player`-Objekt ist — kein Pooling-Code nötig.
  Mehrere Mitglieder reichen pro Turn Intents auf dieselbe `nationId` ein; `submitIntents` hängt sie
  an (überschreibt nicht), die autoritative Commit-Reihenfolge des Servers hält den Lockstep.

## Konsequenzen

- Solo- UND MP-Team-Spiel (allied) funktioniert, deterministisch, MP-sicher (Player-Felder via
  `...rest` serialisiert; Config server-autoritativ).
- Beide Modi (`allied` + `shared`) sind in Solo und Mehrspieler wählbar und verifiziert. Offen als
  optionale Politur (nicht blockierend): HUD-Hinweis, mit wem man eine geteilte Nation steuert.
