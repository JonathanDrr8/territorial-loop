# `src/ai/` — KI-Gegner

## Zweck

KI-gesteuerte Spieler. Generieren Intents wie menschliche Spieler, nicht mehr und nicht weniger.

## Was gehört rein

- KI-Strategien (aggressiv, defensiv, expansiv, etc.)
- Entscheidungs-Logik (welches Tile angreifen, wo verteidigen)
- Heuristiken (Bedrohungs-Bewertung, Expansions-Wert)
- Difficulty-Tuning (verschiedene KI-Stufen)

## Was gehört NICHT rein

- Direktes State-Manipulieren (KI darf nur Intents emittieren wie ein Spieler)
- Rendering von KI-Debug-Info (das ist `src/render/`)

## Konventionen

- **KI = Spieler mit Code** — gleiche API, gleiche Beschränkungen wie menschliche Spieler
- **Deterministisch** — nutzt seeded PRNG aus `core/`, kein `Math.random()`
- **Kein Cheating** — KI sieht nur was Spieler auch sehen würden (Fog-of-War falls implementiert)

## Öffentliche API

### `ai.ts` — Allround-KI

```ts
interface AI {
  /** Pro Sim-Tick aufgerufen, liefert 0..n Intents. */
  decide(state: GameState): readonly Intent[]
}

type Difficulty = 'beginner' | 'easy' | 'standard' | 'advanced' | 'expert'
const DIFFICULTIES: readonly Difficulty[] // aufsteigende Stärke

function createAI(playerId, gameSeed, difficulty = 'standard', wild = false): AI
```

**Verhalten:**

- Pro KI eigene PRNG-Instanz, Seed = `ai-{playerId}-{gameSeed}`. Damit ist die
  KI deterministisch, aber **unabhängig** vom Sim-PRNG — sie verschiebt nicht
  den Zufalls-Verlauf der Simulation.
- Pro Entscheidung kann die KI mehrere Aktionen anstoßen: Militär (Land-Angriff,
  Krater-Heilung, Boot), Bau (Wirtschaft, Flak, Flughafen, Verteidigung), Bomber,
  Kriegsschiffe, Diplomatie — alles **capability-gated** (`isBuildingAllowed` +
  Infrastruktur/Gold), passt sich also an deaktivierte Gebäude an.

### 5-Stufen-Leiter (ADR-0020)

`PROFILES` staffelt Aggression + Fähigkeiten je Stufe (capability-gated):

| Stufe    | Fähigkeiten zusätzlich zur vorigen                          |
| -------- | ----------------------------------------------------------- |
| beginner | nur Expansion (kein Bau)                                    |
| easy     | + Wirtschaft                                                |
| standard | + Diplomatie, Kriegsschiffe, defensive Flak, Krater-Heilung |
| advanced | + offensive Bomber                                          |
| expert   | alles, Aggression am Optimum (~42% Truppen-Einsatz)         |

**Sweet Spot Aggression ≈ 42%** — mehr macht die KI nachweislich schwächer (Truppen
zerfasern). Die Stufen sind über die Arena ELO-kalibriert.

### `arena.ts` / `elo.ts` — Selbstläufer-Arena (Messung)

Headless KI-gegen-KI (`runMatch`) → Territorium + Nutzungs-Statistik; `computeElo`
liefert ELO pro Profil (Anker frei wählbar). **Kein Machine-Learning** — misst nur die
handgetunte Heuristik, damit Tuning-Schritte überprüfbar sind. Runner: `npm run ai-arena`.
Siehe `docs/decisions/0020-ki-rework-arena.md` + `docs/ki-arena-report.md`.
