/** Italienische Strings (ADR-0014). Fehlende Keys fallen auf Deutsch zurück. */
export const it: Record<string, string> = {
  'app.tagline': 'RTS da browser su un mondo senza bordi',

  'nav.play': 'Gioca',
  'nav.multiplayer': 'Multigiocatore',
  'nav.settings': 'Impostazioni',
  'nav.changelog': 'Novità',
  'nav.help': 'Aiuto',

  'header.name': 'Nome',
  'header.namePlaceholder': 'Il tuo nome',
  'footer.feedback': 'Feedback',
  'footer.sourcecode': 'Codice sorgente',
  'lang.label': 'Lingua',

  'section.world': 'Mondo',
  'section.opponents': 'Avversari',
  'section.match': 'Partita',
  'field.map': 'Mappa (L × A)',
  'field.terrain': 'Tipo di mappa',
  'field.aiCount': 'Numero di IA',
  'field.wildCount': 'Nazioni selvagge',
  'field.difficulty': "Difficoltà dell'IA",
  'field.victory': 'Vittoria %',
  'field.seed': 'Seme (opzionale)',
  'field.seedPlaceholder': 'vuoto = casuale',
  'terrain.flat': 'Aperto (senza acqua)',
  'terrain.continents': 'Continenti',
  'terrain.islands': 'Isole',
  'difficulty.easy': 'Facile',
  'difficulty.normal': 'Normale',
  'difficulty.hard': 'Difficile',
  'play.start': 'Avvia partita',
  'play.spectate': 'Guarda',

  'settings.intro': 'Visualizzazione e funzioni opzionali. Si applicano alla prossima partita.',
  'settings.display': 'Visualizzazione',
  'field.camera': 'Telecamera',
  'field.sound': 'Audio',
  'toggle.on': 'sì',
  'toggle.off': 'no',
  'camera.tiles': 'Tessere (come prima)',
  'camera.period': 'Riquadro (senza giunture)',
  'camera.fixed': 'Riquadro (fisso)',
  'camera.dynamic': 'Riquadro dinamico',
  'settings.experimental': 'Sperimentale',
  'settings.experimental.body':
    'Le funzioni opzionali da provare compariranno qui come interruttori dedicati — foreste, fiumi, ' +
    'pesci, rumore tipo terrestre… Ancora niente di attivo.',

  'mp.intro': 'Unisciti a una partita aperta o crea la tua stanza.',
  'mp.openDialog': 'Crea stanza / entra con codice',
  'mp.reconnect': '⟳ Riconnetti — stanza {room}',

  'lobby.openTitle': 'Stanze aperte',
  'lobby.runningTitle': 'Partite in corso',
  'lobby.refresh': '↻ Aggiorna',
  'lobby.emptyOpen': 'Nessuna stanza aperta. Creane una da «Multigiocatore».',
  'lobby.emptyRunning': 'Nessuna partita in corso.',
  'lobby.spectate': 'Guarda',
  'lobby.unreachable': 'Server non raggiungibile.',
  'lobby.loading': 'Caricamento …',
  'lobby.players': 'giocatori',
  'lobby.spectators': 'spettatori',

  'info.title': 'Consigli e trucchi',
  'info.feedback': 'Feedback / segnala un bug',
  'info.tip.1':
    'Le truppe crescono più in fretta intorno al 42 % del tuo limite — spendile in attacchi invece di accumularle.',
  'info.tip.2':
    'Le fabbriche danno oro per ogni città/porto collegato — e il triplo per i collegamenti con nazioni straniere.',
  'info.tip.3':
    'Maiusc+clic sinistro attacca lungo tutto il confine; Maiusc+rotella regola la dimensione dell’attacco.',
  'info.tip.4':
    'Il mondo è un toro: uscire a sinistra ti riporta a destra — usa i bordi per aggirare.',
  'info.tip.5': 'Le navi da guerra bloccano le rotte commerciali nemiche e ne razziano il carico.',
  'info.tip.6': 'Trovato un bug o hai un’idea? Diccelo con «Feedback / segnala un bug».',

  'changelog.openFull': 'Apri il registro completo',
  'changelog.title': 'Novità',
  'changelog.loading': 'Caricamento novità …',
  'changelog.error': 'Impossibile caricare il registro delle modifiche.',

  'help.title': 'Meccaniche di gioco',
  'help.intro':
    'territorial-loop è un RTS territoriale in tempo reale su un mondo senza bordi: uscire a ' +
    'sinistra ti riporta a destra (un toro). L’obiettivo è dominare gran parte della mappa.',

  'help.goal.title': 'Obiettivo',
  'help.goal.body':
    'Conquista territorio finché controlli la quota di mappa impostata per la partita (vittoria %). ' +
    'Se perdi tutto il territorio, sei eliminato.',

  'help.expansion.title': 'Espandersi e attaccare',
  'help.expansion.body':
    'Il cursore stabilisce quante truppe riceve un attacco. Cliccare su terra neutrale ti espande; ' +
    'cliccare su una nazione attacca lungo il confine. Un vantaggio di 2:1 basta per la presa ' +
    'totale; i fronti pari diventano duri. Le truppe crescono fino a un limite che sale col territorio.',

  'help.buildings.title': 'Edifici',
  'help.buildings.body':
    'Con l’oro costruisci Città (più limite di truppe), Avamposto difensivo (bonus + raggio contro ' +
    'gli attacchi), Porto (commercio e navi) e Fabbrica (economia). Migliorabili; alla conquista il ' +
    'nuovo proprietario li mantiene — tranne gli avamposti difensivi.',

  'help.economy.title': 'Economia (reti di fabbriche)',
  'help.economy.body':
    'L’oro non viene dalla dimensione del territorio ma dalle fabbriche: una fabbrica si collega in ' +
    'linea d’aria alle tue città/porti/fabbriche a portata e produce oro per ogni obiettivo ' +
    'collegato. I collegamenti con nazioni straniere danno 3× oro (e favore) — cooperare conviene. ' +
    'Costruisci Città + Porto + Fabbrica vicine e collegale.',

  'help.ships.title': 'Navi e commercio',
  'help.ships.body':
    'Le chiatte da trasporto portano truppe via acqua verso altre isole/fianchi (richiamabili). Le ' +
    'navi mercantili fanno la spola tra porti e danno oro a entrambi i proprietari. Le navi da ' +
    'guerra pattugliano, bloccano/saccheggiano i mercantili nemici e si combattono tra loro.',

  'help.diplomacy.title': 'Diplomazia',
  'help.diplomacy.body':
    'Puoi stringere alleanze (gli alleati non si attaccano e condividono favore) e imporre embarghi. ' +
    'Le alleanze scadono da sole. Tutto questo si gestisce dal menu radiale del clic destro.',

  'help.treason.title': 'Tradimento',
  'help.treason.body':
    'Attaccare un alleato è tradimento: l’alleanza si rompe e per un po’ sei bandito — gli altri ti ' +
    'infliggono allora 1,5× danni. Il gioco chiede conferma prima di un simile attacco.',

  'help.relations.title': 'Relazioni (rancore e favore)',
  'help.relations.body':
    'La guerra navale e gli embarghi generano rancore; il commercio e la vicinanza di fabbriche ' +
    'generano favore. Entrambi svaniscono nel tempo, tingono i confini (rosso/verde) e guidano chi ' +
    'l’IA attacca o risparmia.',

  'help.wild.title': 'Nazioni selvagge',
  'help.wild.body':
    'Le nazioni selvagge sono passive: si espandono nelle terre selvagge, attaccano con cautela, non ' +
    'costruiscono e hanno un limite più basso — un cuscinetto conquistabile e bottino.',

  'help.camera.title': 'Mondo e telecamera',
  'help.camera.body':
    'La mappa è un toro (senza bordo). Con la rotella zoomi, trascinando o con WASD muovi la ' +
    'telecamera. Lo stile (tessere / riquadro) si regola nelle Impostazioni.',

  'help.controls.title': 'Comandi',
  'help.controls.body':
    'Clic sinistro: attacca/espandi · Maiusc+clic sinistro: tutto intorno al confine · ' +
    'Maiusc+rotella: regola la dimensione dell’attacco · Clic destro: menu radiale (costruire/' +
    'chiatta/nave/diplomazia) · 1–4: edifici · B: modalità chiatta · R: raggi delle navi · ' +
    'Spazio: pausa · Esc: menu.',

  'help.growth.title': 'Crescita delle truppe',
  'help.growth.body':
    'Ogni nazione ha un limite di truppe che sale col numero di caselle (in modo sublineare — il ' +
    'doppio della terra ≠ il doppio del limite). La crescita al secondo non è costante: vicino a 0 ' +
    'cresci piano, più in fretta a riserva media, e più ti avvicini al limite più frena. L’ottimo è ' +
    'intorno al 42 % del limite. Spendere truppe in attacchi ti tiene nella zona di forte crescita; ' +
    'accumulare vicino al limite la ferma quasi del tutto.',

  // ── Registro eventi ────────────────────────────────────────────────────────
  'event.allianceExpired': 'L’alleanza tra {a} e {b} è scaduta',
  'event.breakTraitor': '{a} rompe l’alleanza con il traditore {b}',
  'event.betray': '{a} tradisce {b}!',
  'event.allied': '{a} e {b} sono alleati',
  'event.allianceOffer': '{a} propone un’alleanza a {b}',
  'event.allianceDecline': '{a} rifiuta l’alleanza di {b}',
  'event.embargoOn': '{a} impone un embargo a {b}',
  'event.embargoOff': '{a} revoca l’embargo su {b}',
  'event.tradeMode.random': 'Mete commerciali: casuale',
  'event.tradeMode.nearest': 'Mete commerciali: la più vicina',
  'event.tradeMode.farthest': 'Mete commerciali: la più lontana',
  'event.tradeMode.allies': 'Mete commerciali: solo alleati',
  'event.warshipNeutralSpare': 'Navi: risparmia i neutrali',
  'event.warshipNeutralAll': 'Navi: attacca tutti',
  'event.warshipHold': '{p}: le navi tengono la posizione e si curano',
  'event.warshipPatrol': '{p}: le navi pattugliano',
  'event.warshipLimit': '{p}: limite di navi raggiunto',
  'event.warshipNoGold': '{p}: oro insufficiente per una nave da guerra',
  'event.warshipNoRoute': '{p}: nessun porto con rotta marittima verso l’obiettivo',
  'event.noCoast': '{p}: nessuna costa tua — conquista prima terra sull’acqua',
  'event.noWaterway': '{p}: nessuna rotta marittima verso questo obiettivo',
  'event.boatAttack': '⚠ {player} attacca {defender} con una chiatta da trasporto',
  'event.boatSent': '{p} invia una chiatta da trasporto',
  'event.boatLand': '{p} sbarca truppe',
  'event.defend': '{p} respinge l’attacco di {attacker}',
  'event.warshipSent': '{p} invia una nave da guerra',
  'event.boatSunk': 'Chiatta da trasporto di {p} affondata',
  'event.tradeBlocked': 'Nave mercantile bloccata',
  'event.warshipSunk': 'Nave da guerra di {p} affondata',
  'event.eliminated': '{p} è stato eliminato',
  'event.victory': '{p} ha vinto la partita!',
  'event.loot': '{p} saccheggia {amount} oro da {from}',
  'event.lootWild': '{p} saccheggia {amount} oro dalle terre selvagge',
  'event.annex': '{p} circonda {wild} e la annette',
  'event.annexLoot': '{p} circonda {wild} e la annette (+{amount} oro)',
}
