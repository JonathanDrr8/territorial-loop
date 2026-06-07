/** Deutsche Strings (Quell-Sprache, ADR-0014). Fehlt ein Key in `en`, fällt es hierauf zurück. */
export const de: Record<string, string> = {
  'app.tagline': 'Browser-RTS auf einer randlosen Welt',

  'nav.play': 'Spielen',
  'nav.multiplayer': 'Mehrspieler',
  'nav.ranking': 'Rangliste',
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
  'section.mode': 'Modus',
  'field.captureMode': 'Hauptstadt-Modus',
  'field.teamMode': 'Teams',
  'teamMode.off': 'Aus (jeder gegen jeden)',
  'teamMode.allied': 'Teams (verbündet)',
  'teamMode.shared': 'Geteilte Nation',
  'field.teamCount': 'Anzahl Teams',
  'field.teamSize': 'Team-Größe',
  'section.match': 'Match',
  'field.map': 'Karte (B × H)',
  'field.terrain': 'Karten-Typ',
  'field.aiCount': 'Anzahl KI',
  'field.wildCount': 'Wilde Nationen',
  'field.difficulty': 'KI-Schwierigkeit',
  'field.victory': 'Sieg-%',
  'field.attackSize': 'Start-Angriff %',
  'field.seed': 'Seed (optional)',
  'field.seedPlaceholder': 'leer = zufällig',
  'field.reroll': 'Würfeln',
  'preset.title': 'Vorgaben',
  'preset.sub': '{ai} Gegner · {wild} wild',
  'preset.small': 'Klein',
  'preset.standard': 'Standard',
  'preset.large': 'Groß',
  'preset.chaos': 'Chaos',
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
  'play.matchSettings': 'Match-Einstellungen anpassen',
  'play.spectate': 'Zuschauen',
  'play.ranked': 'Ranglisten',
  'play.tutorial': 'Tutorial',

  // ── Tab „Einstellungen" ────────────────────────────────────────────────────
  'settings.intro': 'Darstellung & optionale Features. Wirken sich aufs nächste Match aus.',
  'settings.display': 'Darstellung',
  'settings.audio': 'Audio',
  'field.camera': 'Kamera',
  'field.hoverMode': 'Hover-Info',
  'field.master': 'Gesamt',
  'field.sound': 'Soundeffekte',
  'field.music': 'Musik (Beta)',
  'toggle.on': 'an',
  'toggle.off': 'aus',
  'camera.tiles': 'Kacheln (wie vorher)',
  'camera.period': 'Box (nahtlos)',
  'camera.fixed': 'Box (fest)',
  'camera.dynamic': 'Dynamische Box',
  'hovermode.both': 'Panel + Tooltip',
  'hovermode.panel': 'Nur festes Panel',
  'hovermode.tooltip': 'Nur Cursor-Tooltip',
  'settings.buildings': 'Erlaubte Gebäude',
  'settings.buildings.body': 'Deaktivierte Gebäude kann im Match niemand bauen — auch keine KI.',
  'settings.world': 'Welt',
  'settings.hud': 'HUD & Design',
  'settings.hud.theme': 'Design',
  'settings.hud.hint':
    'Das ganze HUD lässt sich im Match frei anpassen — drücke im Spiel Esc und wähle „HUD anpassen": Panels verschieben, skalieren, aus-/einblenden.',
  'settings.hud.layout': 'HUD-Layout',
  'settings.hud.resetLayout': 'Auf Standard zurücksetzen',
  'settings.hud.reset.done': 'Zurückgesetzt',

  // ── Tab „Mehrspieler" ──────────────────────────────────────────────────────
  'mp.intro': 'Tritt einem offenen Spiel bei oder erstelle deine eigene Lobby.',
  'mp.openDialog': 'Lobby erstellen / per Code beitreten',
  'mp.reconnect': '⟳ Wieder verbinden — Raum {room}',

  // Online-Rangliste (ADR-0027)
  'ranking.title': 'Online-Rangliste',
  'ranking.intro':
    'Dein Ranglisten-ELO aus Solo-Matches gegen die KI, weltweit gespeichert. Mehrspieler-Partien verändern es nicht.',
  'ranking.myElo': 'Dein ELO',
  'ranking.myPeak': 'Bestwert',
  'ranking.loading': 'Lädt …',
  'ranking.empty': 'Noch keine Einträge — spiel ein Ranglisten-Match!',
  'ranking.offline': 'Offline — keine Verbindung zum Ranglisten-Server.',
  'ranking.colName': 'Name',
  'ranking.colElo': 'ELO',
  'ranking.colRecord': 'S/N',
  'ranking.hideMe': 'Mich aus der Rangliste ausblenden',
  'ranking.hidden': 'Ausgeblendet',
  'ranking.visible': 'Sichtbar',

  // Account / Login (ADR-0027 Phase 2)
  'account.signIn': 'Anmelden',
  'account.title.account': 'Konto',
  'account.title.login': 'Anmelden',
  'account.title.register': 'Konto erstellen',
  'account.title.recover': 'Passwort zurücksetzen',
  'account.loggedInAs': 'Angemeldet als {name}',
  'account.intro':
    'Optional: Sichere dein ELO geräteübergreifend. Ohne Anmeldung spielst du als Gast weiter.',
  'account.username': 'Benutzername',
  'account.password': 'Passwort',
  'account.newPassword': 'Neues Passwort',
  'account.email': 'E-Mail (optional)',
  'account.recoveryCode': 'Wiederherstellungs-Code',
  'account.btn.login': 'Anmelden',
  'account.btn.register': 'Konto erstellen',
  'account.btn.recover': 'Zurücksetzen',
  'account.btn.logout': 'Abmelden',
  'account.btn.close': 'Schließen',
  'account.btn.savedIt': 'Habe ich gespeichert',
  'account.btn.deleteAccount': 'Konto löschen',
  'account.btn.privacy': 'Datenschutz',
  'account.btn.back': 'Zurück',
  'account.switch.toRegister': 'Noch kein Konto? Erstellen',
  'account.switch.toLogin': 'Schon ein Konto? Anmelden',
  'account.switch.toRecover': 'Passwort vergessen?',
  'account.recoveryTitle': 'Dein Wiederherstellungs-Code',
  'account.recoveryHint':
    'Bewahre ihn sicher auf — nur damit kannst du dein Passwort ohne E-Mail zurücksetzen. Er wird nur dieses eine Mal angezeigt.',
  'account.error.invalid': 'Benutzername oder Passwort falsch.',
  'account.error.taken': 'Dieser Benutzername ist schon vergeben.',
  'account.error.username': 'Benutzername: 3–24 Zeichen (Buchstaben, Ziffern, _ und -).',
  'account.error.password': 'Passwort: mindestens 6 Zeichen.',
  'account.error.offline': 'Server nicht erreichbar.',
  'account.delete.title': 'Konto löschen?',
  'account.delete.warning':
    'Das löscht dein Konto und alle zugehörigen Daten (Anzeigename, ELO-Wertung und Bilanz, gespeicherte Einstellungen) endgültig vom Server. Das lässt sich nicht rückgängig machen.',
  'account.delete.passwordPrompt': 'Zur Bestätigung dein Passwort eingeben',
  'account.delete.confirm': 'Endgültig löschen',
  'account.delete.cancel': 'Abbrechen',
  'account.delete.wrongPassword': 'Passwort falsch.',
  'account.delete.done': 'Konto gelöscht. Du spielst jetzt wieder als anonymer Gast.',
  'account.privacy.title': 'Datenschutz',
  'account.privacy.body':
    'Dieses Spiel speichert für die Online-Rangliste nur das Nötigste: deinen Anzeigenamen sowie deine ELO-Wertung und Bilanz. Legst du ein Konto an, kommen ein Benutzername, ein verschlüsselt gespeichertes Passwort und – nur falls du sie angibst – eine E-Mail hinzu; auch deine geräteübergreifenden Einstellungen werden dann am Konto gespeichert. Keine Werbung, kein Tracking, keine Weitergabe an Dritte. Du kannst dein Konto jederzeit oben selbst löschen. Fragen oder Auskunfts-/Löschwünsche: {email}',

  // Tutorial (geführtes Match)
  'tutorial.title': 'Tutorial',
  'tutorial.btn.next': 'Weiter',
  'tutorial.btn.finish': 'Fertig',
  'tutorial.step.welcome.goal': 'Willkommen',
  'tutorial.step.welcome.text':
    'Willkommen bei territorial-loop! Das farbige Gebiet in der Mitte ist dein Reich. Dein Ziel: dich ausbreiten und die Insel erobern. Wir gehen die Grundlagen Schritt für Schritt durch.',
  'tutorial.step.expand.goal': 'Breite dich aus',
  'tutorial.step.expand.text':
    'Klicke ein angrenzendes graues Gebiet an deiner Grenze an — deine Truppen breiten sich dorthin aus.',
  'tutorial.step.size.goal': 'Angriffsgröße',
  'tutorial.step.size.text':
    'Mit Shift+Mausrad stellst du ein, wie viel deiner Truppen ein Angriff einsetzt. Mehr Truppen erobern schneller, lassen dein Kerngebiet aber dünner. Probier es ruhig aus.',
  'tutorial.step.wild.goal': 'Erobere die Wilden',
  'tutorial.step.wild.text':
    'Die grauen „wilden" Nationen sind passiv und schwach besiedelt — perfekt zum Wachsen. Erobere die wilde Nation neben dir; beim Erobern erbeutest du ihr Gold.',
  'tutorial.step.city.goal': 'Baue eine Stadt',
  'tutorial.step.city.text':
    'Mit Gold baust du Gebäude. Wir schenken dir etwas Gold zum Üben. Drücke Taste 1 und setze eine Stadt auf dein Gebiet — eine Stadt hebt dein Truppen-Limit, du kannst also mehr Truppen halten.',
  'tutorial.step.factory.goal': 'Baue eine Fabrik',
  'tutorial.step.factory.text':
    'Gold ist der Schlüssel zu allem. Baue eine Fabrik (Taste 4) — sie verbindet sich mit deinen Städten und produziert laufend Gold. Fabriken sind das Rückgrat deiner Wirtschaft. Hier ist Gold dafür.',
  'tutorial.step.grow.goal': 'Wachse weiter',
  'tutorial.step.grow.text':
    'Stark! Wachsen ist das Wichtigste. Breite dich weiter aus und erobere mehr Gebiet — je größer dein Reich, desto mehr Truppen und Gold.',
  'tutorial.step.airport.goal': 'Baue einen Flughafen',
  'tutorial.step.airport.text':
    'Zeit für Luftmacht. Baue einen Flughafen (Taste 5) — von hier starten Bomber. Wir schenken dir das Gold dafür.',
  'tutorial.step.bomber.goal': 'Starte einen Bomber',
  'tutorial.step.bomber.text':
    'Drücke Taste 7, um einen Bomber zu bauen, und klicke dann ein feindliches (graues) Gebiet an. Der Bomber fliegt hin und wirft eine Bombe, die Truppen tötet, Gebiet neutralisiert und Gebäude zerstört — Vorsicht, sie verschont niemanden, auch Verbündete nicht.',
  'tutorial.step.finish.goal': 'Geschafft',
  'tutorial.step.finish.text':
    'Geschafft! Du beherrschst die Grundlagen: ausbreiten, erobern, Wirtschaft (Städte + Fabriken) und Luftkrieg. Häfen und Schiffe, Diplomatie und die Spielmodi lernst du am besten direkt in einer echten Partie kennen. Viel Erfolg!',

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
    'Angriffe), Hafen (Handel & Schiffe), Fabrik (Wirtschaft), Flugplatz (startet Bomber) und ' +
    'Flak (schießt feindliche Bomber ab). Gebäude sind aufrüstbar; bei Eroberung übernimmt der ' +
    'neue Besitzer sie — außer Verteidigungsposten.',

  'help.economy.title': 'Wirtschaft (Fabrik-Netzwerke)',
  'help.economy.body':
    'Gold kommt nicht aus der Gebietsgröße, sondern aus Fabriken: Eine Fabrik versorgt deine ' +
    'Städte und Häfen, die über zusammenhängendes eigenes Land erreichbar sind (Gold-Karren ' +
    'pendeln über deine Straßen), und erzeugt pro verbundenem Ziel Gold. Liegt eine Fabrik nahe ' +
    'einer fremden Nation, bringt diese Verbindung 3× Gold (und Gunst). Wichtig: Eine frisch ' +
    'eroberte Fabrik produziert erst, wenn sie über eigenes Gebiet mit deinen Städten verbunden ' +
    'ist. Bau Stadt + Hafen + Fabrik nah beieinander und vernetze sie.',

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
    'Diplomatie) · 1–6: Gebäude · 7: Bomber · 8: Kriegsschiff · B: Boot-Modus · R: Schiff-Reichweiten · ' +
    '„.“ / „,“: Tempo · Leertaste: Pause · Esc: Menü (auch „HUD anpassen").',

  'help.growth.title': 'Truppen-Wachstum',
  'help.growth.body':
    'Jede Nation hat ein Truppen-Maximum, das mit der Anzahl deiner Tiles steigt (sublinear — ' +
    'doppelt so viel Land ≠ doppelter Cap). Das Wachstum pro Sekunde ist nicht konstant: nahe 0 ' +
    'Truppen wächst du langsam, bei mittlerem Bestand am schnellsten, je näher am Maximum desto ' +
    'stärker abgebremst. Das Optimum liegt bei ~42 % des Caps. Truppen für Angriffe ausgeben hält ' +
    'dich oft im wachstumsstarken Bereich; Horten nahe am Cap bringt das Wachstum fast zum Stillstand.',

  'help.air.title': 'Luftkrieg (Bomber & Flak)',
  'help.air.body':
    'Ein Flugplatz lässt dich Bomber starten. Ein Bomber fliegt zum Ziel und schlägt eine Bombe ' +
    'ein: Sie reißt einen Krater, tötet Truppen im Umkreis und macht das getroffene Land neutral. ' +
    'Das erzeugt starken Groll beim Getroffenen (und Angst bei allen anderen). Ein Flak-Posten ' +
    '(Luftabwehr) schießt feindliche Bomber in Reichweite ab — schütze damit deine Städte und Fabriken.',

  'help.rivers.title': 'Flüsse',
  'help.rivers.body':
    'Optional (im Experimentell-Panel bzw. in der Lobby aktivierbar): Auf Kontinent- und Insel-' +
    'Karten werden echte, navigierbare Flüsse ins Terrain geschnitten — von den Bergen bis zum ' +
    'Meer. Sie sind breit genug für Schiffe, die so tief ins Landesinnere fahren und flankieren können.',

  'help.hud.title': 'HUD anpassen',
  'help.hud.body':
    'Im Match öffnest du mit Esc → „HUD anpassen" den Editor: Panels frei verschieben, skalieren ' +
    'und ein-/ausblenden (eine Liste zeigt alle Elemente), das Design (Theme) wechseln und alles ' +
    'auf Standard zurücksetzen. Auch über die Einstellungen im Hauptmenü erreichbar. Deine ' +
    'Anordnung wird lokal gespeichert.',

  'help.multiplayer.title': 'Mehrspieler & Ranglisten',
  'help.multiplayer.body':
    'Mehrspieler: Über „Mehrspieler" eröffnest du einen Raum (Code teilen) oder trittst einem bei ' +
    '— alle spielen server-synchron im selben Match. Ranglisten-Modus: Solo gegen eine KI auf ' +
    'deiner Spielstärke; gewinnst du, steigt dein ELO, so siehst du deinen Fortschritt. Die KI-' +
    'Schwierigkeit reicht von Anfänger bis Experte.',

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
  'event.tradeBlocked': 'Dein Handel blockiert — {amount} Gold entgangen',
  'event.warshipSunk': 'Kriegsschiff von {p} versenkt',
  'event.eliminated': '{p} wurde eliminiert',
  'event.capitalCaptured': '{p} erobert die Hauptstadt von {victim} und übernimmt das Reich',
  'event.capitalBombed':
    'Die Hauptstadt von {victim} ist zerstört — das Reich zerfällt zur Wildnis',
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
  'hud.tab.feed': 'Meldungen',
  'hud.troops': 'Truppen',
  'hud.land': 'Land',
  'hud.gold': 'Gold',
  'pause.title': 'Pause',
  'pause.resume': 'Weiter',
  'pause.settings': 'Einstellungen',
  'pause.leave': 'Runde verlassen',
  'settings.radialSize': 'Radialmenü-Größe',
  'settings.radialSize.small': 'Klein',
  'settings.radialSize.normal': 'Normal',
  'settings.radialSize.large': 'Groß',
  'settings.offscreenLabels': 'Namen am Rand (nächste …)',
  'settings.tapDelay': 'Tipp-Angriff-Verzögerung (0 = aus)',
  'settings.keybinds': 'Tastenbelegung',
  'settings.keybinds.reset': 'Zurücksetzen',
  'keybind.press': 'Taste drücken…',
  'keybind.center': 'Aufs eigene Reich zentrieren',
  'keybind.radial': 'Aktionsmenü öffnen',
  'keybind.boat': 'Transportboot-Modus',
  'keybind.bomber': 'Bomber-Modus',
  'keybind.warship': 'Kriegsschiff-Modus',
  'keybind.shipRanges': 'Schiff-Reichweiten zeigen',
  'keybind.speedUp': 'Tempo erhöhen',
  'keybind.speedDown': 'Tempo verringern',
  'keybind.buildCity': 'Bauen: Stadt',
  'keybind.buildDefense': 'Bauen: Verteidigung',
  'keybind.buildPort': 'Bauen: Hafen',
  'keybind.buildFactory': 'Bauen: Fabrik',
  'keybind.buildAirport': 'Bauen: Flugplatz',
  'keybind.buildFlak': 'Bauen: Flak',
  'hud.editor.open': 'HUD anpassen',
  'hud.editor.done': 'Fertig',
  'hud.editor.reset': 'Standard',
  'hud.editor.export': 'Export',
  'hud.editor.copied': 'Kopiert',
  'hud.editor.slider': 'Slider',
  'hud.editor.slider.action': 'Aktionen',
  'hud.editor.slider.resource': 'Truppen',
  'hud.editor.buttons': 'Knöpfe',
  'hud.editor.buttons.row': 'Reihe',
  'hud.editor.buttons.numpad': 'Numpad',
  'hud.editor.merged': 'Paket',
  'hud.editor.split': 'Geteilt',
  'hud.editor.panel.troopsNum': 'Truppen-Zahl',
  'hud.editor.panel.troopsBar': 'Truppen-Balken',
  'hud.editor.panel.gold': 'Gold',
  'hud.editor.panel.buys': 'Käufe',
  'hud.editor.panel.boat': 'Boot',
  'hud.editor.theme': 'Design',
  'hud.editor.hidden': 'Ausgeblendet',
  'hud.editor.elements': 'Elemente',
  'hud.editor.tab.layout': 'Layout',
  'hud.editor.quickConfig': 'Quick-Config',
  'quickcfg.standard': 'Standard',
  'quickcfg.mouse': 'Maus',
  'quickcfg.wheel': 'Navigations-Rad',
  'hud.editor.presets.templates': 'Vorlagen',
  'hud.editor.presets.custom': 'Eigene',
  'hud.editor.presets.load': 'Laden',
  'hud.editor.presets.save': 'Speichern',
  'hud.editor.presets.delete': 'Löschen',
  'hud.editor.presets.slotName': 'Layout {n}',
  'hud.editor.presets.namePlaceholder': 'Name…',
  'hud.editor.presets.reset': 'Zurücksetzen',
  'hud.editor.presets.saveInto': 'Speichern in…',
  'hud.editor.presets.newSlot': 'Neuer Slot',
  'hud.editor.panel.attacks': 'Laufende Angriffe',
  'hud.editor.emptyHint': 'erscheint im Spiel',
  'hud.editor.hint': 'Ziehen = verschieben · Ecken = Größe · × = ausblenden',
  'hud.editor.resizePanel': 'Werkzeugleiste größer/kleiner ziehen',
  'hud.editor.panel.info': 'Spielzeit',
  'hud.editor.panel.rank': 'Rangliste',
  'hud.editor.panel.resource': 'Truppen & Bauen',
  'hud.editor.panel.action': 'Aktions-Leiste',
  'hud.editor.panel.minimap': 'Minimap',
  'hud.editor.panel.feed': 'Meldungen',
  'hud.editor.panel.wheel': 'Aktions-Rad',
  'hud.editor.panel.topbar': 'Statusleiste',
  'hud.editor.panel.attackbar': 'Angriffsgröße',
  'hud.editor.panel.menu': 'Menü-Knopf',
  'hud.editor.panel.feedback': 'Feedback-Knopf',
  'hud.editor.troopStyle': 'Truppen-Anzeige',
  'hud.editor.troopStyle.bar': 'Balken',
  'hud.editor.troopStyle.orb': 'Kugel',
  'hud.editor.control': 'Steuerung',
  'hud.editor.control.auto': 'Auto',
  'hud.editor.control.desktop': 'Desktop',
  'hud.editor.control.touch': 'Maus / Rad',
  'hud.boat': 'Transportboot',
  'hud.bomber': 'Bomber',
  'hud.warship': 'Kriegsschiff',
  'hud.boatHintShort': 'Ziel auf anderer Insel',
  'wheel.title': 'Aktionen',
  'wheel.back': 'Zurück',
  'wheel.build': 'Bauen',
  'wheel.ships': 'Angriffe',
  'minimap.collapse': 'Minimap einklappen',
  'minimap.expand': 'Minimap ausklappen',
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
  'hud.buildLevel': 'Stufe',
  'hud.newMatch': 'Neues Match',
  'hud.keepWatching': 'Weiterspielen',
  'hud.keepSpectating': 'Weiter zuschauen',
  'hud.defeatTitle': 'Du wurdest besiegt',
  'hud.defeatSub': 'Dein Reich wurde vollständig erobert.',
  'hud.troopStyleToggle': 'Anzeige umschalten: Balken ↔ Kugel',
  'hud.andMore': '… und {n} weitere',
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
  'mp.team': 'Team',
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
  'field.riverDensity': 'Fluss-Häufigkeit',

  // ── Festes Hover-Info-Panel ──────────────────────────────────────────────────
  'hover.title': 'Unter dem Cursor',
  'hover.empty': 'Maus über die Karte bewegen',
  'hover.building': 'Gebäude',
  'hover.water': 'Wasser',
}
