# ADR 0013: Beziehungssystem — Groll & Gunst (steuert KI + Visualisierung) — Plan

## Status

Accepted — vollständig umgesetzt (A+B Seekrieg-Groll/Abfangen, F Gunst aus Handel +
Fabrik-Nachbarschaft, C grüner Gunst-Tint, D KI-Zielwahl nach Beziehung, E Neutral-Toggle
für Kriegsschiffe). Offene Design-Fragen unten wurden so entschieden: Gunst aus
**Handel + Fabrik-Nachbarschaft**, Visualisierung zuerst **grüner Karten-Tint**,
Neutral-Toggle-Default **alle angreifen** (umschaltbar im Hafen-Radialmenü).

## Datum

2026-05-29

## Kontext

Es gibt bereits einen gerichteten, abklingenden **Groll** (`state.grudge`,
`directedKey(angreifer, opfer) → Wert`). Bisher entstand er nur durch **Land-Eroberung** und
trieb ausschließlich **Visuals aus Menschen-Sicht** (rote Tints/Schiff-Ringe in
`render/renderer.ts`); die **KI las ihn nie**.

In dieser Session ist daraus ein größerer Wunsch gewachsen: ein vollwertiges
**Beziehungssystem** zwischen Nationen, das

- durch **Seekrieg** (versenkte/blockierte Schiffe) Groll erzeugt,
- durch **Zusammenarbeit** (Handel, gemeinsame Fabrik-Reichweite) **Gunst** (positives
  Gegenstück) erzeugt,
- die **KI-Zielwahl** beeinflusst (greift eher Groll-Nationen an, schont Gunst-Partner),
- dem **Spieler sichtbar** gemacht wird,
- und einen **Toggle** bietet, ob eigene Kriegsschiffe auch **neutrale** Fracht angreifen.

## Bereits umgesetzt (diese Session)

- **A — KI-Abfangen:** `ai.ts:planWarshipHunts` lenkt patrouillierende eigene Kriegsschiffe per
  `move-warship` gezielt vor das nächste erreichbare feindliche Handelsschiff (statt nur am
  Hafen zu pendeln). Verbündete Fracht wird nie gejagt.
- **B — Seekrieg-Groll:** `game.ts:resolveNavalCombat` erhöht den Groll des Bestohlenen beim
  Beschuss/Versenken (pro Kriegsschiff-Treffer, je Boot, an beide Hafen-Besitzer eines
  blockierten Handelsschiffs). Konstanten `GRUDGE_PER_*`, Helfer `addGrudge`.

## Plan (offen)

### F — Gunst (positives Gegenstück zum Groll)

Neue Map `state.goodwill: Map<directedKey, number>` (analog `grudge`, gleicher Abkling-Mechanismus
in `decayGrudge` → in `decayRelations` umbenennen/erweitern). Quellen:

- **Abgeschlossene Handelsfahrt** zwischen zwei _verschiedenen_ Spielern: beide bekommen Gunst
  zueinander (`advanceTradeShips`, wo das Handels-Gold ausgeschüttet wird). Wert ∝ Fahrt-Gold.
- **Fabrik-Reichweite über Grenzen:** _optional/Phase 2_ — heute verbinden sich Fabriken nur mit
  **eigenen** Gebäuden (`buildings.ts`). Eine spielerübergreifende „Nachbarschafts-Gunst" (Fabrik
  in Reichweite fremder Städte/Häfen → beide etwas Gunst + ggf. kleiner Gold-Bonus) wäre ein
  **neuer Mechanik-Baustein** — separat absegnen.

**Netto-Beziehung** `relation(a→b) = goodwill − grudge`. Helfer `relationLevel(state, a, b)`.

### D — KI nutzt die Beziehung

In `ai.ts:pickLandTarget`/`pickBoatTarget`: Gegner-Ziele nach **Netto-Groll** gewichten
(hoher Groll → wahrscheinlicher; hohe Gunst → meiden, ggf. wie Verbündete ganz überspringen ab
Schwelle). Gewichtete Zufallswahl statt `randElement` (deterministisch über `rng`). So entstehen
stabile Freundschaften und gezielte Vergeltung.

### C — Visualisierung (UI, in kleinen Schritten)

Kandidaten (genau **einen** zuerst, abgestimmt):

1. **Rangliste:** kleines Beziehungs-Icon/Punkt je Nation aus Menschen-Sicht (😠 rot abgestuft /
   🤝 grün abgestuft / neutral grau).
2. **Karten-Tint:** bestehender roter Groll-Tint bekommt ein grünes Gunst-Pendant.
3. **Diplomatie-Menü:** Beziehungs-Zeile (Balken −/+) je Nation.

### E — Neutral-Toggle

Eigene Kriegsschiffe feuern heute auf **jede** nicht-verbündete Fracht. Neuer Spieler-Toggle
(Default: **an** = wie bisher, alle Nicht-Verbündeten): bei **aus** nur noch Fracht von Nationen
mit echtem Feind-Status (Embargo / Groll über Schwelle) angreifen, neutrale ignorieren.
Wirkt nur auf **menschliche** Kriegsschiffe (KI behält ihre eigene Logik). Speichern wie
`warshipHold` am `Player` + Umschalter im Hafen-Radialmenü o. ä.

## Offene Design-Fragen (vor Umsetzung)

1. **Gunst-Quellen:** nur Handel, oder auch grenzübergreifende Fabrik-Reichweite (= neue Mechanik)?
2. **Visualisierung:** welche der drei Darstellungen zuerst?
3. **Neutral-Toggle-Default:** alle Nicht-Verbündeten (wie heute) oder neutral standardmäßig schonen?

## Verifikation (für die offenen Teile)

| #   | Was                                    | Test-Kommando                                               | Erwartetes Ergebnis                                   |
| --- | -------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| F1  | Handel erzeugt Gunst                   | Unit: zwei Spieler-Häfen, Handelsfahrt bis Ankunft ticken   | `state.goodwill.get(directedKey(a,b)) > 0` beidseitig |
| F2  | Gunst klingt ab                        | Unit: Gunst setzen, viele Ticks                             | Wert sinkt, < Schwelle → gelöscht                     |
| D1  | KI greift Groll-Nation eher an         | Unit: zwei Nachbarn, einer mit hohem Groll → viele decide() | Angriffsziele liegen mehrheitlich beim Groll-Nachbarn |
| D2  | KI schont Gunst-Partner                | Unit: Nachbar mit hoher Gunst                               | kaum/keine Angriffe gegen ihn                         |
| E1  | Toggle aus → neutrale Fracht ignoriert | Unit: neutrales Handelsschiff in Reichweite, Toggle aus     | kein Projektil/keine Versenkung                       |
| —   | Gesamt                                 | `npm run typecheck && npm run lint && npm run test:run`     | grün                                                  |

Manuell (Playwright): Beziehungs-Visualisierung sichtbar & plausibel; Toggle schaltet sichtbar um.
