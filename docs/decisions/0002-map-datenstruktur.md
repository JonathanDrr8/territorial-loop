# ADR 0002: Map als Dual-TypedArray

## Status

Accepted

## Datum

2026-05-27

## Kontext

Wir brauchen eine Datenstruktur für die Spielkarte. Anforderungen:

- **Pixel-Grid**: jeder Pixel ist ein eroberbares Tile (Konzept-Entscheidung — OpenFront-Stil)
- **Default 512×512** = ~260k Tiles, konfigurierbar bis ≥ 1024×1024 (~1M Tiles)
- **Pro Tick mutiert**: bei einer aktiven Front können hunderte Tiles pro Tick den Owner wechseln
- **Pro Render gelesen**: jedes Tile potentiell sichtbar (Cache-Friendliness wichtig)
- **GPU-übertragbar**: Renderer muss den State pro Frame auf die GPU bringen ohne riesige Per-Pixel-Sprite-Listen

Optionen:

1. `Array<Tile>` mit Objekten pro Tile (`{owner, troops, ...}`) — bequem, aber Object-Header-Overhead und GC-unfreundlich
2. `Map<TileRef, Tile>` — sparse, aber wir haben dichte Daten (jedes Tile existiert)
3. **Dual-TypedArray** (OpenFront-Vorbild): `terrain: Uint8Array` + `state: Uint16Array`, bit-gepackt

## Entscheidung

**Option 3 — Dual-TypedArray nach OpenFront-Vorbild.**

- `terrain: Uint8Array` (länge = `w*h`) — unveränderlich nach Map-Erzeugung. Im MVP komplett gefüllt mit "Land", aber Struktur reserviert für Post-MVP-Terrain.
- `state: Uint16Array` (länge = `w*h`) — pro Tick mutiert. Bits 0-11: `ownerID`, Bits 12-15: reserviert.
- **`TileRef = number`** als Type-Alias = `y * width + x` (flacher Integer-Index).

## Begründung

### RAM-Verbrauch

Bei 512×512: `Uint8Array (260kB) + Uint16Array (520kB)` = ~780 kB. Bei 1024×1024: ~3 MB. Pure Object-Variante wäre 50-100× größer durch Object-Header und Pointer-Indirektion.

### Cache-Lokalität

Flat TypedArrays liegen im Heap als kontinuierliche Speicher-Blöcke. Per-Tile-Iteration ist deutlich schneller als ein `Array<Object>`-Walk (kein Pointer-Hopping).

### GPU-Übertragung

`Uint16Array` ist direkt als WebGL-Textur (Format `R16UI`) hochladbar. Das macht den Renderer trivial: eine einzige Texture-Upload + Fullscreen-Shader statt 260k Sprites. Belegt durch OpenFronts Code (`src/core/game/GameMap.ts`).

### Erweiterbarkeit

Bits 12-15 sind reserviert — bei Bedarf können wir später Border-Flags, Capture-Progress (für Belagerungs-Modus), Defense-Bonus usw. reinpacken ohne Daten-Layout zu ändern.

### Erprobtheit

OpenFront skaliert dieses Layout auf ~4 Mio. Tiles produktiv. Für unseren MVP-Bereich (260k-1M Tiles) absolut sicher.

## Konsequenzen

- **Vorteil:** Speicher-effizient, cache-friendly, GPU-friendly, OpenFront-erprobt
- **Vorteil:** `TileRef` als plain `number` macht Sets/Maps (`Set<TileRef>` für Frontier) leichtgewichtig
- **Nachteil:** Bit-Packing ist weniger lesbar als Objekt-Properties. Wir kapseln das in Getter/Setter-Helper in `world/map.ts` (`getOwner(state, ref)`, `setOwner(state, ref, id)`)
- **Nachteil:** Owner-ID auf 12 bit (max 4095) limitiert. Für unsere ≤ 16-Spieler-Welt vollkommen ausreichend.

## Alternativen verworfen

- **`Array<Tile>` mit Objekten:** zu speicher- und GC-aufwendig bei großen Maps. Kein GPU-Upload-Path.
- **Sparse `Map<TileRef, Tile>`:** dichte Daten passen nicht zu sparse Struktur. Lookup deutlich langsamer.
- **Eigene Bit-Layout-Variante:** Wir kopieren bewusst OpenFront, weil es funktioniert und wir später Mechaniken vergleichen können.

## Reviewdatum

Bei Performance-Problemen oder wenn wir Multiplayer-Snapshot-Übertragung designen.
