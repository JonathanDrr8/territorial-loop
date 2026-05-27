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
  /** Pro Sim-Tick aufgerufen, liefert 0 oder 1 Intents. */
  decide(state: GameState): readonly Intent[]
}

function createAI(playerId: number, gameSeed: string): AI
```

**Verhalten:**

- Pro KI eigene PRNG-Instanz, Seed = `ai-{playerId}-{gameSeed}`. Damit ist die
  KI deterministisch, aber **unabhängig** vom Sim-PRNG — sie verschiebt nicht
  den Zufalls-Verlauf der Simulation.
- Cooldown zwischen Entscheidungen: 30–100 Ticks (3–10 s bei 10 Hz), jittered.
- Zielwahl: bei Bevölkerung >= 60% des Caps bevorzugt Gegner-Tiles, sonst neutrales
  Land. Es werden nur Tiles direkt an der eigenen Frontier betrachtet — keine
  Sprung-Angriffe.
- Truppen-Einsatz: festes 30% der aktuellen Bevölkerung pro Angriff.
