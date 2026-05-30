/** Deutsche Strings (Quell-Sprache, ADR-0014). Fehlt ein Key in `en`, fällt es hierauf zurück. */
export const de: Record<string, string> = {
  'app.tagline': 'Browser-RTS auf einer randlosen Welt',

  'nav.play': 'Spielen',
  'nav.multiplayer': 'Mehrspieler',
  'nav.settings': 'Einstellungen',
  'nav.changelog': 'Changelog',
  'nav.help': 'Hilfe',

  'header.name': 'Name',
  'header.namePlaceholder': 'Dein Name',
  'footer.feedback': 'Feedback',
  'footer.sourcecode': 'Quellcode',
  'lang.label': 'Sprache',

  // ── Tab „Spielen" (Match-Setup) ────────────────────────────────────────────
  'section.world': 'Welt',
  'section.opponents': 'Gegner',
  'section.match': 'Match',
  'field.map': 'Karte (B × H)',
  'field.terrain': 'Karten-Typ',
  'field.aiCount': 'Anzahl KI',
  'field.wildCount': 'Wilde Nationen',
  'field.difficulty': 'KI-Schwierigkeit',
  'field.victory': 'Sieg-%',
  'field.seed': 'Seed (optional)',
  'field.seedPlaceholder': 'leer = zufällig',
  'terrain.flat': 'Offen (kein Wasser)',
  'terrain.continents': 'Kontinente',
  'terrain.islands': 'Inseln',
  'difficulty.easy': 'Einfach',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Schwer',
  'play.start': 'Match starten',
  'play.spectate': 'Zuschauen',

  // ── Tab „Einstellungen" ────────────────────────────────────────────────────
  'settings.intro': 'Darstellung & optionale Features. Wirken sich aufs nächste Match aus.',
  'settings.display': 'Darstellung',
  'field.camera': 'Kamera',
  'field.sound': 'Sound',
  'toggle.on': 'an',
  'toggle.off': 'aus',
  'camera.tiles': 'Kacheln (wie vorher)',
  'camera.period': 'Box (nahtlos)',
  'camera.fixed': 'Box (fest)',
  'camera.dynamic': 'Dynamische Box',
  'settings.experimental': 'Experimentell',
  'settings.experimental.body':
    'Opt-in-Features zum Ausprobieren landen hier als eigene Schalter — Wälder, Flüsse, ' +
    'Fische, erdähnlicher Noise … Noch nichts aktiv.',

  // ── Tab „Mehrspieler" ──────────────────────────────────────────────────────
  'mp.intro': 'Tritt einem offenen Spiel bei oder erstelle deine eigene Lobby.',
  'mp.openDialog': 'Lobby erstellen / per Code beitreten',
  'mp.reconnect': '⟳ Wieder verbinden — Raum {room}',

  // Lobby-Browser (offene Lobbys + laufende Spiele)
  'lobby.openTitle': 'Offene Lobbys',
  'lobby.runningTitle': 'Laufende Spiele',
  'lobby.refresh': '↻ Aktualisieren',
  'lobby.emptyOpen': 'Keine offenen Lobbys. Starte selbst eine über „Mehrspieler".',
  'lobby.emptyRunning': 'Gerade keine laufenden Spiele.',
  'lobby.spectate': 'Zuschauen',
  'lobby.unreachable': 'Server nicht erreichbar.',
  'lobby.loading': 'Lade …',
  'lobby.players': 'Spieler',
  'lobby.spectators': 'Zuschauer',

  // Tipps-/Info-Bereich (Startseite, rechte Spalte)
  'info.title': 'Tipps & Tricks',
  'info.feedback': 'Feedback / Bug melden',
  'info.tip.1':
    'Truppen wachsen am schnellsten bei rund 42 % deines Limits — gib sie für Angriffe aus, statt zu horten.',
  'info.tip.2':
    'Fabriken bringen Gold pro verbundener Stadt/Hafen — und das Dreifache für Verbindungen zu fremden Nationen.',
  'info.tip.3':
    'Shift+Linksklick greift entlang der ganzen Grenze an, Shift+Mausrad justiert die Angriffsgröße fein.',
  'info.tip.4':
    'Die Welt ist ein Torus: links raus heißt rechts wieder rein — nutze die Ränder zum Flankieren.',
  'info.tip.5': 'Kriegsschiffe blockieren feindliche Handelsrouten und erbeuten die Fracht.',
  'info.tip.6': 'Bug gefunden oder eine Idee? Sag es uns über „Feedback / Bug melden".',

  'changelog.openFull': 'Vollständigen Changelog öffnen',

  'changelog.title': 'Was ist neu',
  'changelog.loading': 'Lade Changelog …',
  'changelog.error': 'Changelog konnte nicht geladen werden.',

  // ── Hilfe: Spielmechaniken ─────────────────────────────────────────────────
  'help.title': 'Spielmechaniken',
  'help.intro':
    'territorial-loop ist ein Echtzeit-Territorial-RTS auf einer Welt ohne Ränder: ' +
    'links raus heißt rechts wieder rein (ein Torus). Ziel ist, einen großen Teil der Karte zu beherrschen.',

  'help.goal.title': 'Ziel',
  'help.goal.body':
    'Erobere Gebiet, bis du den im Match eingestellten Anteil der Karte hältst (Sieg-%). ' +
    'Verlierst du dein ganzes Gebiet, bist du raus.',

  'help.expansion.title': 'Ausbreiten & Angreifen',
  'help.expansion.body':
    'Mit dem Schieberegler legst du fest, wie viele Truppen ein Angriff bekommt. Klick auf ' +
    'neutrales Land breitet dich aus; Klick auf eine Nation greift entlang der Grenze an. ' +
    'Übermacht ab 2:1 reicht für die komplette Einnahme; gleich starke Fronten werden zäh. ' +
    'Truppen wachsen bis zu einem Cap, das mit deinem Gebiet steigt.',

  'help.buildings.title': 'Gebäude',
  'help.buildings.body':
    'Für Gold baust du Stadt (mehr Truppen-Cap), Verteidigungsposten (Bonus + Reichweite gegen ' +
    'Angriffe), Hafen (Handel & Schiffe) und Fabrik (Wirtschaft). Gebäude sind aufrüstbar; bei ' +
    'Eroberung übernimmt der neue Besitzer sie — außer Verteidigungsposten.',

  'help.economy.title': 'Wirtschaft (Fabrik-Netzwerke)',
  'help.economy.body':
    'Gold kommt nicht aus der Gebietsgröße, sondern aus Fabriken: eine Fabrik verbindet sich per ' +
    'Luftlinie mit deinen Städten/Häfen/Fabriken in Reichweite und erzeugt pro verbundenem Ziel ' +
    'Gold. Verbindungen zu fremden Nationen bringen 3× Gold (und Gunst) — Kooperation lohnt sich. ' +
    'Bau also Stadt + Hafen + Fabrik nah beieinander und vernetze sie.',

  'help.ships.title': 'Schiffe & Handel',
  'help.ships.body':
    'Transportboote bringen Truppen über Wasser auf andere Inseln/Flanken (rückrufbar). ' +
    'Handelsschiffe pendeln zwischen Häfen und bringen beiden Besitzern Gold. Kriegsschiffe ' +
    'patrouillieren, blockieren/erbeuten fremde Handelsschiffe und bekämpfen sich gegenseitig.',

  'help.diplomacy.title': 'Diplomatie',
  'help.diplomacy.body':
    'Du kannst Bündnisse schließen (Verbündete greifen sich nicht an, teilen Gunst) und Embargos ' +
    'verhängen. Bündnisse laufen automatisch aus. Bedient wird das über das Rechtsklick-Radialmenü.',

  'help.treason.title': 'Verrat',
  'help.treason.body':
    'Greifst du einen Verbündeten an, ist das Verrat: das Bündnis bricht und du wirst eine Zeit ' +
    'lang geächtet — alle anderen fügen dir dann 1,5× Schaden zu. Vor einem solchen Angriff fragt ' +
    'das Spiel nach.',

  'help.relations.title': 'Beziehungen (Groll & Gunst)',
  'help.relations.body':
    'Seekrieg und Embargos erzeugen Groll, Handel und Fabrik-Nachbarschaft erzeugen Gunst. Beides ' +
    'klingt mit der Zeit ab, färbt die Grenzen (rot/grün) und steuert, wen die KI angreift oder schont.',

  'help.wild.title': 'Wilde Nationen',
  'help.wild.body':
    'Wilde Nationen sind passiv: sie breiten sich in die Wildnis aus, greifen nur zurückhaltend an, ' +
    'bauen nicht und haben einen kleineren Cap — ein eroberbarer Puffer und Beute.',

  'help.camera.title': 'Welt & Kamera',
  'help.camera.body':
    'Die Karte ist ein Torus (kein Rand). Über Mausrad zoomst du, mit Ziehen oder WASD bewegst du ' +
    'die Kamera. Die Darstellung (Kacheln / Box) stellst du in den Einstellungen ein.',

  'help.controls.title': 'Steuerung',
  'help.controls.body':
    'Linksklick: Angriff/Ausbreiten · Shift+Linksklick: rundum entlang der ganzen Grenze · ' +
    'Shift+Mausrad: Angriffsgröße fein justieren · Rechtsklick: Radialmenü (Bauen/Boot/Kriegsschiff/' +
    'Diplomatie) · 1–4: Gebäude · B: Boot-Modus · R: Schiff-Reichweiten · Leertaste: Pause · Esc: Menü.',

  'help.growth.title': 'Truppen-Wachstum',
  'help.growth.body':
    'Jede Nation hat ein Truppen-Maximum, das mit der Anzahl deiner Tiles steigt (sublinear — ' +
    'doppelt so viel Land ≠ doppelter Cap). Das Wachstum pro Sekunde ist nicht konstant: nahe 0 ' +
    'Truppen wächst du langsam, bei mittlerem Bestand am schnellsten, je näher am Maximum desto ' +
    'stärker abgebremst. Das Optimum liegt bei ~42 % des Caps. Truppen für Angriffe ausgeben hält ' +
    'dich oft im wachstumsstarken Bereich; Horten nahe am Cap bringt das Wachstum fast zum Stillstand.',

  // ── Ereignislog (Spielmeldungen) ───────────────────────────────────────────
  'event.allianceExpired': 'Allianz zwischen {a} und {b} ausgelaufen',
  'event.breakTraitor': '{a} kündigt das Bündnis mit Verräter {b}',
  'event.betray': '{a} verrät {b}!',
  'event.allied': '{a} und {b} sind verbündet',
  'event.allianceOffer': '{a} bietet {b} ein Bündnis an',
  'event.allianceDecline': '{a} lehnt das Bündnis von {b} ab',
  'event.embargoOn': '{a} verhängt ein Embargo gegen {b}',
  'event.embargoOff': '{a} hebt das Embargo gegen {b} auf',
  'event.tradeMode.random': 'Handelsziele: Zufall',
  'event.tradeMode.nearest': 'Handelsziele: Nächste',
  'event.tradeMode.farthest': 'Handelsziele: Weiteste',
  'event.tradeMode.allies': 'Handelsziele: nur Verbündete',
  'event.warshipNeutralSpare': 'Kriegsschiffe: neutrale schonen',
  'event.warshipNeutralAll': 'Kriegsschiffe: alle angreifen',
  'event.warshipHold': '{p}: Kriegsschiffe halten & heilen',
  'event.warshipPatrol': '{p}: Kriegsschiffe patrouillieren',
  'event.warshipLimit': '{p}: Kriegsschiff-Limit erreicht',
  'event.warshipNoGold': '{p}: zu wenig Gold für ein Kriegsschiff',
  'event.warshipNoRoute': '{p}: kein Hafen mit Wasserweg zum Ziel',
  'event.noCoast': '{p}: keine eigene Küste — erobere erst Land am Wasser',
  'event.noWaterway': '{p}: kein Wasserweg zu diesem Ziel',
  'event.boatAttack': '⚠ {defender} wird von {player} per Transportboot angegriffen',
  'event.boatSent': '{p} schickt ein Transportboot',
  'event.boatLand': '{p} landet Truppen an',
  'event.defend': '{p} wehrt den Angriff von {attacker} ab',
  'event.warshipSent': '{p} entsendet ein Kriegsschiff',
  'event.boatSunk': 'Transportboot von {p} versenkt',
  'event.tradeBlocked': 'Handelsschiff blockiert',
  'event.warshipSunk': 'Kriegsschiff von {p} versenkt',
  'event.eliminated': '{p} wurde eliminiert',
  'event.victory': '{p} hat das Match gewonnen!',
  'event.loot': '{p} erbeutet {amount} Gold von {from}',
  'event.lootWild': '{p} erbeutet {amount} Gold aus der Wildnis',
  'event.annex': '{p} schließt {wild} ein und annektiert sie',
  'event.annexLoot': '{p} schließt {wild} ein und annektiert sie (+{amount} Gold)',
}
