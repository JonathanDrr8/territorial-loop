# ADR 0022: Kontinuierliche ELO-Stärke, Ranglisten-Modus, Diplomatie-Tiefe

## Status

Accepted — umgesetzt (Session 2026-05-31), aufbauend auf ADR-0020/0021. Branch
`feature/flugzeuge-bomben`. Player-facing in CHANGELOG 0.9.0.

## Datum

2026-05-31

## Kontext

Nach ADR-0021 stand ein Tuner + ein starkes KI-Optimum. Jonathan wollte (a) die Schwierigkeit
**granular wie ELO** statt 5 Schubladen („bei 1000 starten, sehen wie man besser wird"), (b)
Diplomatie im Training **korrekt bewertet**, und (c) **Gunst-Mechaniken** (Gold/Truppen spenden).

## Entscheidung

### 1. Kontinuierliche Stärke + ELO (`src/ai/strength.ts`)

`profileForStrength(s∈[0,1])` erzeugt ein Profil von schwachem Boden bis zum getunten Optimum;
`scripts/ai-calibrate.ts` misst `s→ELO` (monoton). `profileForElo(elo)` liefert eine KI beliebiger
Stärke. Die 5 Presets sind nur noch **Punkte auf dem Kontinuum** (`profileForElo(PRESET_ELO[...])`,
Standard=1000-Anker) → das im UI angezeigte ELO ist die echte Spielstärke („Standard (1000)").

### 2. Ranglisten-Modus (`src/ui/ranked.ts`, lokal, KEINE Accounts)

Spieler startet bei ELO 1000, spielt gegen `profileForElo(eigenes ELO)`; Match-Ende bewegt das ELO
(Standard-Formel, Sieg gegen Stärkere bringt mehr). Bilanz + Peak, persistent in `localStorage`.
Eigener Screen im Play-Menü.

### 3. Freikampf-Tuning + Diplomatie sieg-relevant (`--ffa`)

`diploChance`/`betrayLeadRatio` sind jetzt im `ParamVector`. Der `--ffa`-Modus stellt Kandidaten in
ein Feld diverser unabhängiger Gegner → Diplomatie wird sieg-relevant. **Befund (Daten):** der Tuner
behielt Diplomatie bei (diploChance 0,37, betrayLeadRatio 1,83 = loyaler) statt sie wegzuoptimieren —
Beleg, dass Diplomatie im Freikampf zum Sieg beiträgt. Das FFA-Optimum wurde übernommen (ELO-Decke
stieg auf ~1410). **Bewusst NICHT** Groll als Fitness-Term (das züchtet eine nette Verliererin).

### 4. Gunst-Spenden (`donate-gold`/`donate-troops`)

Gold an jeden → Gunst (nach **Menge + Bereitschaft**, Menge dominiert); Truppen nur an Verbündete.
UI: Diplomatie-Radialmenü mit **Untermenü** (Gold-Slider + 10/25/50/100 %). KI nutzt es **rational
gegatet**: appeased nur einen stärkeren, grollenden Nachbarn mit Überschuss (kein Blanko-Bestechen).

### 5. Kontextbewusste Schicht (`assessContext`)

Pro Entscheidung liest die KI Rang / Welt-Füllstand / Mobbing und regelt nach: Führender
konsolidiert + verrät kaum, Nachzügler ist aggressiver, leere Welt → expandieren / volle → kämpfen,
gemobbt → erst Verteidigung. Leiter bleibt monoton.

## Konsequenzen

**Positiv:** Granulare, ehrliche Schwierigkeit + Progression ohne Accounts; Diplomatie messbar
sieg-relevant; reichere Gunst-Seite; situativ klügere KI.

**Negativ / offen:** Menschen-Balance bleibt außerhalb der Arena-Messung; Ranglisten-Screen vorerst
deutsch; weiteres Tuning/Justierung siehe [[0023-ki-training-ausbau]] (Plan).
