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

(wird in Phase B definiert)
