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
  'terrain.world': 'Welt (Geo)',
  'terrain.europe': 'Europa (Geo)',
  'terrain.africa': 'Afrika (Geo)',
  'terrain.australia': 'Australien (Geo)',
  'difficulty.beginner': 'Anfänger',
  'difficulty.easy': 'Leicht',
  'difficulty.standard': 'Standard',
  'difficulty.advanced': 'Fortgeschritten',
  'difficulty.expert': 'Experte',
  'play.start': 'Match starten',
  'play.spectate': 'Zuschauen',
  'play.ranked': 'Ranglisten',

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
  'settings.buildings': 'Erlaubte Gebäude',
  'settings.buildings.body': 'Deaktivierte Gebäude kann im Match niemand bauen — auch keine KI.',
  'settings.world': 'Welt',

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
  'event.donateGold': '{a} schenkt {b} {n} Gold',
  'event.donateTroops': '{a} entsendet {b} {n} Truppen zur Unterstützung',
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
  'event.boatAttack': '{defender} wird von {player} per Transportboot angegriffen',
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
  'event.annex': '{p} schließt eine wilde Nation ein und annektiert sie',
  'event.annexLoot': '{p} schließt eine wilde Nation ein und annektiert sie (+{amount} Gold)',
  'event.annexFragment': '{p} schluckt eingeschlossenes Gebiet von {victim}',
  'event.annexFragmentLoot': '{p} schluckt eingeschlossenes Gebiet von {victim} (+{amount} Gold)',

  // ── HUD ──────────────────────────────────────────────────────────────────────
  'hud.tooltip.city': 'Stadt — +{cap} Truppen-Maximum je Stufe.',
  'hud.tooltip.defense':
    'Verteidigungsposten — im Umkreis {range} (+{per}/Stufe) wird Eroberung bis {mult}× teurer.',
  'hud.tooltip.port': 'Hafen — nötig für Transport- & Handelsschiffe (nur am Wasser baubar).',
  'hud.tooltip.factory':
    'Fabrik — verbindet sich per Luftlinie mit eigenen Städten/Häfen/Fabriken und produziert Gold je verbundener Stadt/Hafen.',
  'hud.tooltip.airport':
    'Flughafen — Hangar für {slots} Flugzeug je Stufe; startet Bomber (Flugzeug kaufen + Munition pro Wurf).',
  'hud.tooltip.flak':
    'Flugabwehr — schießt feindliche Bomber im Umkreis {range} (+{per}/Stufe) ab.',
  'hud.controls': 'Steuerung',
  'hud.controlsBody':
    'Linksklick: Angriff · B: Boot-Modus (Ziel auf anderer Insel) · 7: Bomber-Modus · 8: Kriegsschiff<br/>Rechtsklick: Menü (Bauen/Angriff/Boot/Kriegsschiff/Diplomatie)<br/>Ziehen (links/rechts) oder WASD: Kamera · Mausrad: Zoom<br/>1–6: Gebäude (Stadt/Verteidigung/Hafen/Fabrik/Flughafen/Flugabwehr) · R: Schiff-Reichweiten · Leertaste: Pause<br/>, / . : Tempo · Esc: Menü<br/>Angriffs-Panel anklicken: abbrechen / Boot · Schiff zurück',
  'hud.rank': 'Rangliste',
  'hud.troops': 'Truppen',
  'hud.land': 'Land',
  'hud.gold': 'Gold',
  'hud.editor.open': 'HUD anpassen',
  'hud.editor.done': 'Fertig',
  'hud.editor.reset': 'Standard',
  'hud.editor.theme': 'Design',
  'hud.editor.hidden': 'Ausgeblendet',
  'hud.editor.hint': 'Ziehen = verschieben · Ecken = Größe · × = ausblenden',
  'hud.editor.panel.info': 'Zeit & Steuerung',
  'hud.editor.panel.rank': 'Rangliste',
  'hud.editor.panel.resource': 'Truppen & Bauen',
  'hud.editor.panel.action': 'Aktionen',
  'hud.editor.panel.minimap': 'Minimap',
  'hud.editor.panel.feed': 'Ereignisse',
  'hud.boat': 'Transportboot',
  'hud.bomber': 'Bomber',
  'hud.warship': 'Kriegsschiff',
  'hud.boatHintShort': 'Ziel auf anderer Insel',
  'hud.boatModeHint': 'Boot-Modus: Küsten-Ziel auf anderer Landmasse klicken · Esc beendet',
  'route.direct': 'direkt',
  'route.arc-left': 'Bogen links',
  'route.arc-right': 'Bogen rechts',
  'hud.bomberModeHint':
    'Bomber-Modus · Route: {route} · Shift+Mausrad wechselt · Klick = Ziel · Esc beendet',
  'hud.bomberWarnShot': 'Wird abgeschossen!',
  'hud.warshipModeHint':
    'Kriegsschiff-Modus: Wasser-Ziel anklicken (braucht Hafen + Gold) · Esc beendet',
  'hud.attack': 'Angriff: {pct}%',
  'hud.newMatch': 'Neues Match',
  'hud.pauseOverlay': 'PAUSE',
  'hud.pause': 'Pause',
  'hud.inCombat': 'im Kampf {n}',
  'hud.ecoNote': '{factories} Fabrik(en) · {dests} Ziele',
  'hud.ecoBase': 'Grund-Gold',
  'hud.ecoFactory': 'Fabrik-Netz',
  'hud.ecoTrade': 'Handel',
  'hud.ecoSum': 'Summe',
  'hud.wilderness': 'Wildnis',
  'hud.cancelling': 'bricht ab…',
  'hud.cancelNow': 'Sofort abbrechen',
  'hud.cancelAttack': 'Angriff abbrechen (~2.5s Rückzug)',
  'hud.returning': 'kehrt um',
  'hud.enRoute': 'unterwegs',
  'hud.recallBoat': 'Boot zurückrufen',
  'hud.recallWarship': 'Kriegsschiff zurückrufen',
  'hud.defendTitle': 'Abwehren — Truppen 1:1 einsetzen (Slider-Schub)',
  'hud.defendWith': 'Abwehren mit {troops} Truppen',
  'hud.jumpToBattle': 'Zum Angriff springen',
  'hud.attacks': 'Angriffe',
  'hud.traitorTitle': 'Verräter — geächtet, verteidigt geschwächt (noch {time})',
  'hud.alliedTitle': 'Verbündet · läuft in {time} aus',
  'hud.less': 'Weniger ▴',
  'hud.showAll': 'Alle {n} anzeigen ▾ (+{hidden})',
  'hud.running': 'läuft',
  'hud.ended': 'beendet · Sieger {winner}',
  'hud.time': 'Zeit',
  'hud.traitorBanner': 'Du bist geächtet — alle fügen dir 1,5× Schaden zu (noch {time})',
  'hud.victory': 'Sieg',
  'hud.matchDuration': 'Dauer {time} · Match läuft weiter',
  'hud.colPlayer': 'Spieler',
  'hud.colPeakPct': 'Peak %',
  'hud.colPeakTroops': 'Peak Truppen',

  // ── Gebäude-Namen ────────────────────────────────────────────────────────────
  'building.city': 'Stadt',
  'building.defense': 'Verteidigung',
  'building.port': 'Hafen',
  'building.factory': 'Fabrik',
  'building.airport': 'Flughafen',
  'building.flak': 'Flugabwehr',

  // ── Radialmenü ───────────────────────────────────────────────────────────────
  'menu.chooseAction': 'Aktion wählen',
  'menu.hint.city': '+{cap} Truppen-Cap/Stufe',
  'menu.hint.defense': 'Eroberung bis {mult}× teurer',
  'menu.hint.port': 'Voraussetzung für Schiffe',
  'menu.hint.factory': 'Gold übers Netzwerk (Städte/Häfen in Reichweite)',
  'menu.hint.airport': 'Startet Bomber gegen ein Ziel (Gold je Start)',
  'menu.hint.flak': 'Schießt durchfliegende feindliche Bomber ab',
  'menu.breakAlliance': 'Allianz brechen',
  'menu.breakAllianceDetail': 'Verrat → geächtet · läuft in {time} aus',
  'menu.acceptAlliance': 'Allianz annehmen',
  'menu.acceptAllianceDetail': 'bietet ein Bündnis an',
  'menu.requestSent': 'Anfrage gesendet …',
  'menu.requestSentDetail': 'wartet auf Antwort',
  'menu.requestAlliance': 'Allianz anfragen',
  'menu.requestAllianceDetail': 'Bündnis vorschlagen',
  'menu.embargoLift': 'Embargo aufheben',
  'menu.embargoImpose': 'Embargo verhängen',
  'menu.donateGold': 'Gold schenken',
  'menu.donateGoldParent': 'Gunst erkaufen / Groll besänftigen',
  'menu.donateGoldDetail': 'Schenkt {n} Gold',
  'menu.donateSlider': 'Slider-Betrag',
  'menu.donateTroops': 'Truppen schenken',
  'menu.donateTroopsDetail': 'Schickt {n} Truppen zur Unterstützung',
  'menu.embargoLiftDetail': 'Handel wieder erlauben',
  'menu.embargoImposeDetail': 'stoppt den Handel',
  'menu.tradeAllowAll': 'Handel wieder erlauben',
  'menu.tradeStopAll': 'Handel mit allen stoppen',
  'menu.tradeAllowAllDetail': 'hebt alle Embargos auf — Häfen & Fabriken handeln wieder',
  'menu.tradeStopAllDetail': 'Embargo gegen alle — stoppt Handelsschiffe & Fabrik-Auslandslinks',
  'menu.maxLevel': 'Maximale Stufe',
  'menu.upgrade': 'Upgrade → L{level}',
  'menu.warshipHoldLabel': 'Schiffe: Halten & Heilen',
  'menu.warshipPingPong': 'Schiffe: Ping-Pong',
  'menu.warshipModeDetail': 'Umschalten — gilt für alle eigenen Kriegsschiffe',
  'menu.trade.random': 'Handel: Zufall',
  'menu.trade.nearest': 'Handel: Nächste',
  'menu.trade.farthest': 'Handel: Weiteste',
  'menu.trade.allies': 'Handel: nur Verbündete',
  'menu.tradeNext': 'Klick → {next}',
  'menu.warshipSpare': 'Schiffe: neutrale schonen',
  'menu.warshipAttackAll': 'Schiffe: alle angreifen',
  'menu.warshipNeutralDetail': 'Umschalten — neutrale Handelsschiffe verschonen?',
  'menu.goldTitle': 'Gold: {gold}',
  'menu.water': 'Wasser',
  'menu.warship': 'Kriegsschiff',
  'menu.warshipHasPort': 'patrouilliert & blockiert feindlichen Handel',
  'menu.warshipNoPort': 'Hafen nötig (vom Hafen entsandt)',
  'menu.bomber': 'Bomber starten',
  'menu.bomberDetail': 'Bombe aufs Ziel — zerstört Gebäude, Truppen und Gebiet im Umkreis',
  'menu.bomberCooldown': 'Flughafen lädt noch nach',
  'menu.bomberFull': 'Hangar voll oder kein Flugzeug',
  'menu.attack': 'Angriff',
  'menu.attackDetail': '{n} Truppen an die Front',
  'menu.boatDetail': '{n} Truppen übers Wasser',

  // ── Hover-Tooltip ────────────────────────────────────────────────────────────
  'tip.effect.city': '+{cap} Truppen-Cap',
  'tip.effect.defense': '{mult}× Eroberungskosten · Reichweite {range} Tiles',
  'tip.effect.port': 'Schiffe & Handel · zählt als Netz-Ziel',
  'tip.effect.factory': 'Netzwerk-Gold · Reichweite {range} Tiles',
  'tip.effect.airport': 'Hangar · {slots} Flugzeug-Plätze',
  'tip.effect.flak': 'Flugabwehr · Reichweite {range} Tiles',
  'tip.upgrade.defense': 'Reichweite {range} Tiles',
  'tip.upgrade.airport': 'Hangar {slots} Plätze',
  'tip.upgrade.flak': 'Reichweite {range} Tiles',
  'tip.dests': '{n} Ziele',
  'tip.tradeShip': 'Handelsschiff',
  'tip.warship': 'Kriegsschiff',
  'tip.you': 'Du',
  'tip.underConstruction': 'im Bau',
  'tip.lvl': 'Lvl',
  'tip.neutralLand': 'neutrales Land',
  'tip.perTile': '~{n}/Tile',
  'tip.allied': 'Verbündet · noch {time}',
  'tip.grudge': 'Groll {n}',
  'tip.favor': 'Gunst {n}',
  'tip.traitor': 'Verräter — geächtet (verteidigt geschwächt)',
  'tip.loot': 'Beute bei Eroberung ~{gold}',

  // ── Dialoge ──────────────────────────────────────────────────────────────────
  'confirm.leave': 'Verlassen',
  'confirm.keepPlaying': 'Weiterspielen',
  'confirm.leaveRound': 'Laufende Runde verlassen?',
  'confirm.treason':
    '{ally} ist mit dir verbündet. Ein Angriff ist VERRAT: das Bündnis bricht, du wirst geächtet und nimmst eine Zeit lang 1,5× Schaden von allen. Trotzdem angreifen?',
  'loading.map': 'Karte wird generiert …',

  // ── Feedback-Dialog ──────────────────────────────────────────────────────────
  'feedback.triggerTitle': 'Feedback geben oder einen Bug melden',
  'feedback.title': 'Feedback / Bug melden',
  'feedback.kindFeedback': 'Feedback',
  'feedback.kindBug': 'Bug',
  'feedback.placeholder': 'Was möchtest du loswerden? (Idee, Lob, Bug …)',
  'feedback.send': 'Senden',
  'feedback.cancel': 'Abbrechen',
  'feedback.empty': 'Bitte etwas eintippen.',
  'feedback.sending': 'Senden …',
  'feedback.thanks': 'Danke!',
  'feedback.error': 'Konnte nicht senden (Server erreichbar?).',

  // ── Mehrspieler-Lobby ────────────────────────────────────────────────────────
  'mp.formTitle': 'Mehrspieler — territorial-loop',
  'mp.namePlaceholder': 'Du',
  'mp.room': 'Raum',
  'mp.roomPlaceholder': 'leer = neuen Raum',
  'mp.connect': 'Verbinden',
  'mp.noUrl': 'Bitte eine Server-URL angeben.',
  'mp.back': 'Zurück',
  'mp.connecting': 'Verbinde …',
  'mp.timeout':
    'Keine Verbindung (Timeout). Läuft der Dev-Server (npm run dev) bzw. npm run server?',
  'mp.lobbyTitle': 'Lobby',
  'mp.roomCode': 'Raum-Code',
  'mp.copy': 'Kopieren',
  'mp.copied': 'Kopiert',
  'mp.you': 'du',
  'mp.ready': 'bereit',
  'mp.waiting': 'wartet …',
  'mp.disconnected': 'getrennt',
  'mp.waitingPeers': 'Warte auf Teilnehmer …',
  'mp.readyBtn': 'Bereit',
  'mp.matchHost': 'Match (du bist Host)',
  'mp.matchGuest': 'Match (vom Host gesetzt)',
  'mp.public': 'im Server-Browser gelistet',
  'mp.private': 'privat (nur per Code/Link)',
  'mp.map': 'Karte',
  'mp.terrain': 'Terrain',
  'mp.terrainFlat': 'Offen',
  'mp.ai': 'KI',
  'mp.wild': 'Wilde',
  'mp.difficulty': 'KI-Stärke',
  'mp.visible': 'Sichtbar',

  // ── UI-Größen-Slider ─────────────────────────────────────────────────────────
  'uiscale.title': 'UI-Größe',
  'nation.wild': 'wild',
  'hud.resync': 'Resync …',
  'log.diplomacy': 'Diplomatie',
  'log.war': 'Krieg',
  'log.economy': 'Wirtschaft',
  'prompt.offersAlliance': 'bietet ein Bündnis',
  'prompt.accept': 'Akzeptieren',
  'prompt.decline': 'Ablehnen',
  'prompt.ignore': 'Ignorieren',
  'field.rivers': 'Flüsse',
  'field.rivers.hint': 'nur Kontinente/Inseln, befahrbar',
}
