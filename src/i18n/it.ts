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
  'terrain.world': 'Mondo (geo)',
  'terrain.europe': 'Europa (geo)',
  'terrain.africa': 'Africa (geo)',
  'terrain.australia': 'Australia (geo)',
  'difficulty.beginner': 'Principiante',
  'difficulty.easy': 'Facile',
  'difficulty.standard': 'Standard',
  'difficulty.advanced': 'Avanzato',
  'difficulty.expert': 'Esperto',
  'play.start': 'Avvia partita',
  'play.spectate': 'Guarda',
  'play.ranked': 'Classificata',

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
  'settings.buildings': 'Edifici consentiti',
  'settings.buildings.body':
    'Gli edifici disattivati non possono essere costruiti da nessuno nella partita — nemmeno dall’IA.',
  'settings.world': 'Mondo',
  'settings.hud': 'HUD e aspetto',
  'settings.hud.theme': 'Aspetto',
  'settings.hud.hint':
    'L’intero HUD è personalizzabile liberamente durante la partita — premi Esc nel gioco e scegli «Personalizza HUD»: sposta, ridimensiona, mostra o nascondi i pannelli.',
  'settings.hud.layout': 'Disposizione HUD',
  'settings.hud.resetLayout': 'Ripristina predefiniti',
  'settings.hud.reset.done': 'Ripristinato',

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
    'gli attacchi), Porto (commercio e navi), Fabbrica (economia), Aeroporto (lancia bombardieri) e ' +
    'Contraerea (abbatte i bombardieri nemici). Migliorabili; alla conquista il nuovo proprietario ' +
    'li mantiene — tranne gli avamposti difensivi.',

  'help.economy.title': 'Economia (reti di fabbriche)',
  'help.economy.body':
    'L’oro non viene dalla dimensione del territorio ma dalle fabbriche: una fabbrica rifornisce le ' +
    'tue città e porti raggiungibili tramite territorio proprio contiguo (carri dell’oro percorrono ' +
    'le tue strade) e produce oro per ogni obiettivo collegato. Una fabbrica vicina a una nazione ' +
    'straniera rende 3x oro (e favore) per quel collegamento. Importante: una fabbrica appena ' +
    'conquistata produce solo una volta collegata alle tue città tramite territorio proprio. ' +
    'Costruisci Città + Porto + Fabbrica vicine.',

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
    'chiatta/nave/diplomazia) · 1-6: edifici · 7: bombardiere · 8: nave da guerra · B: modalità ' +
    'chiatta · R: raggi delle navi · «.» / «,»: velocità · Spazio: pausa · Esc: menu (anche «Personalizza HUD»).',

  'help.growth.title': 'Crescita delle truppe',
  'help.growth.body':
    'Ogni nazione ha un limite di truppe che sale col numero di caselle (in modo sublineare — il ' +
    'doppio della terra ≠ il doppio del limite). La crescita al secondo non è costante: vicino a 0 ' +
    'cresci piano, più in fretta a riserva media, e più ti avvicini al limite più frena. L’ottimo è ' +
    'intorno al 42 % del limite. Spendere truppe in attacchi ti tiene nella zona di forte crescita; ' +
    'accumulare vicino al limite la ferma quasi del tutto.',

  'help.air.title': 'Guerra aerea (bombardieri e contraerea)',
  'help.air.body':
    'Un aeroporto ti permette di lanciare bombardieri. Un bombardiere vola verso l’obiettivo e ' +
    'sgancia una bomba: scava un cratere, uccide truppe nel raggio e rende neutro il terreno ' +
    'colpito. Questo genera forte rancore nel colpito (e paura negli altri). Un avamposto ' +
    'contraerea abbatte i bombardieri nemici a portata — usalo per proteggere città e fabbriche.',

  'help.rivers.title': 'Fiumi',
  'help.rivers.body':
    'Opzionale (attivabile nel pannello Sperimentale o nella stanza): sulle mappe Continenti e ' +
    'Isole vengono scavati fiumi reali navigabili nel terreno — dalle montagne fino al mare. ' +
    'Sono abbastanza larghi per le navi, che così possono risalire nell’entroterra e aggirare.',

  'help.hud.title': 'Personalizzare l’HUD',
  'help.hud.body':
    'In partita, premi Esc → «Personalizza HUD» per aprire l’editor: sposta, ridimensiona e ' +
    'mostra/nascondi i pannelli liberamente (un elenco mostra tutti gli elementi), cambia il tema ' +
    'e ripristina tutto ai valori predefiniti. Accessibile anche dalle impostazioni del menu ' +
    'principale. La tua disposizione viene salvata localmente.',

  'help.multiplayer.title': 'Multigiocatore e classificata',
  'help.multiplayer.body':
    'Multigiocatore: tramite «Multigiocatore» apri una stanza (condividi il codice) o ne entri ' +
    'una — tutti giocano sincronizzati sullo stesso server. Modalità classificata: da solo contro ' +
    'un’IA al tuo livello; vinci e il tuo ELO sale per seguire i tuoi progressi. La difficoltà ' +
    'dell’IA va da Principiante a Esperto.',

  // ── Registro eventi ────────────────────────────────────────────────────────
  'event.allianceExpired': 'L’alleanza tra {a} e {b} è scaduta',
  'event.breakTraitor': '{a} rompe l’alleanza con il traditore {b}',
  'event.betray': '{a} tradisce {b}!',
  'event.allied': '{a} e {b} sono alleati',
  'event.allianceOffer': '{a} propone un’alleanza a {b}',
  'event.allianceDecline': '{a} rifiuta l’alleanza di {b}',
  'event.embargoOn': '{a} impone un embargo a {b}',
  'event.donateGold': '{a} dona {n} oro a {b}',
  'event.donateTroops': '{a} invia {n} truppe in supporto a {b}',
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
  'event.boatAttack': '{player} attacca {defender} con una chiatta da trasporto',
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
  'event.annex': '{p} circonda una nazione selvaggia e la annette',
  'event.annexLoot': '{p} circonda una nazione selvaggia e la annette (+{amount} oro)',
  'event.annexFragment': '{p} inghiotte il territorio circondato di {victim}',
  'event.annexFragmentLoot': '{p} inghiotte il territorio circondato di {victim} (+{amount} oro)',

  // ── HUD ──────────────────────────────────────────────────────────────────────
  'hud.tooltip.city': 'Città — +{cap} di truppe massime per livello.',
  'hud.tooltip.defense':
    'Avamposto difensivo — entro {range} (+{per}/livello) la conquista costa fino a {mult}× di più.',
  'hud.tooltip.port':
    'Porto — necessario per navi da trasporto e mercantili (costruibile solo sull’acqua).',
  'hud.tooltip.factory':
    'Fabbrica — si collega in linea d’aria alle tue città/porti/fabbriche e produce oro per ogni città/porto collegato.',
  'hud.tooltip.airport':
    'Aeroporto — hangar per {slots} aereo per livello; lancia bombardieri (compra aereo + munizioni per sgancio).',
  'hud.tooltip.flak':
    'Contraerea — abbatte i bombardieri nemici nel raggio di {range} (+{per}/livello).',
  'hud.controls': 'Comandi',
  'hud.controlsBody':
    'Clic sinistro: attacco · B: modalità barca (obiettivo su un’altra isola) · 7: modalità bombardiere · 8: nave da guerra<br/>Clic destro: menu (costruisci/attacco/barca/nave/diplomazia)<br/>Trascina (sin./des.) o WASD: telecamera · Rotella: zoom<br/>1–6: edifici (città/difesa/porto/fabbrica/aeroporto/contraerea) · R: portate delle navi · Spazio: pausa<br/>, / . : velocità · Esc: menu<br/>Clic sul pannello attacchi: annulla / barca · nave indietro',
  'hud.rank': 'Classifica',
  'hud.troops': 'Truppe',
  'hud.land': 'Territorio',
  'hud.gold': 'Oro',
  'pause.title': 'Pausa',
  'pause.resume': 'Continua',
  'pause.leave': 'Esci dalla partita',
  'hud.editor.open': 'Personalizza HUD',
  'hud.editor.done': 'Fatto',
  'hud.editor.reset': 'Predefinito',
  'hud.editor.export': 'Esporta',
  'hud.editor.copied': 'Copiato',
  'hud.editor.slider': 'Cursore',
  'hud.editor.slider.action': 'Azioni',
  'hud.editor.slider.resource': 'Truppe',
  'hud.editor.buttons': 'Pulsanti',
  'hud.editor.buttons.row': 'Righe',
  'hud.editor.buttons.numpad': 'Numpad',
  'hud.editor.merged': 'Blocco',
  'hud.editor.split': 'Diviso',
  'hud.editor.panel.troopsNum': 'Numero truppe',
  'hud.editor.panel.troopsBar': 'Barra truppe',
  'hud.editor.panel.gold': 'Oro',
  'hud.editor.panel.buys': 'Acquisti',
  'hud.editor.panel.boat': 'Barca da trasporto',
  'hud.editor.theme': 'Tema',
  'hud.editor.hidden': 'Nascosto',
  'hud.editor.elements': 'Elementi',
  'hud.editor.panel.attacks': 'Attacchi',
  'hud.editor.hint': 'Trascinare = sposta · Angoli = ridimensiona · × = nascondi',
  'hud.editor.panel.info': 'Tempo e comandi',
  'hud.editor.panel.rank': 'Classifica',
  'hud.editor.panel.resource': 'Truppe e costruzione',
  'hud.editor.panel.action': 'Azioni',
  'hud.editor.panel.minimap': 'Minimappa',
  'hud.editor.panel.feed': 'Eventi',
  'hud.boat': 'Barca da trasporto',
  'hud.bomber': 'Bombardiere',
  'hud.warship': 'Nave',
  'hud.boatHintShort': 'obiettivo su un’altra isola',
  'hud.boatModeHint':
    'Modalità barca: clicca un obiettivo costiero su un’altra terra · Esc termina',
  'route.direct': 'diretto',
  'route.arc-left': 'arco a sinistra',
  'route.arc-right': 'arco a destra',
  'hud.bomberModeHint':
    'Modalità bombardiere · Rotta: {route} · Shift+rotella cambia · Clic = obiettivo · Esc termina',
  'hud.bomberWarnShot': 'Sarà abbattuto!',
  'hud.warshipModeHint':
    'Modalità nave da guerra: clicca un obiettivo sull’acqua (serve un porto + oro) · Esc termina',
  'hud.attack': 'Attacco: {pct}%',
  'hud.newMatch': 'Nuova partita',
  'hud.keepWatching': 'Continua a guardare',
  'hud.andMore': '… e altri {n}',
  'hud.pauseOverlay': 'PAUSA',
  'hud.pause': 'Pausa',
  'hud.inCombat': 'in combattimento {n}',
  'hud.ecoNote': '{factories} fabbrica(che) · {dests} obiettivi',
  'hud.ecoBase': 'Oro base',
  'hud.ecoFactory': 'Rete di fabbriche',
  'hud.ecoTrade': 'Commercio',
  'hud.ecoSum': 'Totale',
  'hud.wilderness': 'Terre selvagge',
  'hud.cancelling': 'annullamento…',
  'hud.cancelNow': 'Annulla subito',
  'hud.cancelAttack': 'Annulla attacco (~2,5 s di ritirata)',
  'hud.returning': 'rientra',
  'hud.enRoute': 'in viaggio',
  'hud.recallBoat': 'Richiama la barca',
  'hud.recallWarship': 'Richiama la nave',
  'hud.defendTitle': 'Difendi — impiega le truppe 1:1 (spinta dello slider)',
  'hud.defendWith': 'Difendi con {troops} truppe',
  'hud.jumpToBattle': 'Vai all’attacco',
  'hud.attacks': 'Attacchi',
  'hud.traitorTitle': 'Traditore — fuorilegge, difesa indebolita ({time} rimasti)',
  'hud.alliedTitle': 'Alleato · scade tra {time}',
  'hud.less': 'Meno ▴',
  'hud.showAll': 'Mostra tutti i {n} ▾ (+{hidden})',
  'hud.running': 'in corso',
  'hud.ended': 'terminata · vincitore {winner}',
  'hud.time': 'Tempo',
  'hud.traitorBanner': 'Sei fuorilegge — tutti ti infliggono 1,5× danni ({time} rimasti)',
  'hud.victory': 'Vittoria',
  'hud.matchDuration': 'Durata {time} · la partita continua',
  'hud.colPlayer': 'Giocatore',
  'hud.colPeakPct': 'Picco %',
  'hud.colPeakTroops': 'Picco truppe',

  // ── Nomi degli edifici ────────────────────────────────────────────────────────
  'building.city': 'Città',
  'building.defense': 'Difesa',
  'building.port': 'Porto',
  'building.factory': 'Fabbrica',
  'building.airport': 'Aeroporto',
  'building.flak': 'Contraerea',

  // ── Menu radiale ──────────────────────────────────────────────────────────────
  'menu.chooseAction': 'Scegli un’azione',
  'menu.hint.city': '+{cap} al limite truppe/livello',
  'menu.hint.defense': 'conquista fino a {mult}× più cara',
  'menu.hint.port': 'requisito per le navi',
  'menu.hint.factory': 'oro tramite rete (città/porti a portata)',
  'menu.hint.airport': 'lancia bombardieri contro un bersaglio (oro per lancio)',
  'menu.hint.flak': 'abbatte i bombardieri nemici di passaggio',
  'menu.breakAlliance': 'Rompi alleanza',
  'menu.breakAllianceDetail': 'tradimento → bandito · scade tra {time}',
  'menu.acceptAlliance': 'Accetta alleanza',
  'menu.acceptAllianceDetail': 'propone un’alleanza',
  'menu.requestSent': 'Richiesta inviata …',
  'menu.requestSentDetail': 'in attesa di risposta',
  'menu.requestAlliance': 'Richiedi alleanza',
  'menu.requestAllianceDetail': 'proponi un’alleanza',
  'menu.embargoLift': 'Revoca embargo',
  'menu.embargoImpose': 'Imponi embargo',
  'menu.donateGold': 'Donare oro',
  'menu.donateGoldParent': 'Comprare favore / placare rancore',
  'menu.donateGoldDetail': 'Dona {n} oro',
  'menu.donateSlider': 'Importo del cursore',
  'menu.donateTroops': 'Donare truppe',
  'menu.donateTroopsDetail': 'Invia {n} truppe di supporto',
  'menu.embargoLiftDetail': 'consenti di nuovo il commercio',
  'menu.embargoImposeDetail': 'ferma il commercio',
  'menu.tradeAllowAll': 'Consenti di nuovo il commercio',
  'menu.tradeStopAll': 'Ferma il commercio con tutti',
  'menu.tradeAllowAllDetail': 'revoca tutti gli embarghi — porti e fabbriche commerciano di nuovo',
  'menu.tradeStopAllDetail':
    'embargo contro tutti — ferma navi mercantili e link esteri delle fabbriche',
  'menu.maxLevel': 'Livello massimo',
  'menu.upgrade': 'Potenzia → L{level}',
  'menu.warshipHoldLabel': 'Navi: mantieni e cura',
  'menu.warshipPingPong': 'Navi: ping-pong',
  'menu.warshipModeDetail': 'commuta — vale per tutte le tue navi da guerra',
  'menu.trade.random': 'Commercio: casuale',
  'menu.trade.nearest': 'Commercio: più vicino',
  'menu.trade.farthest': 'Commercio: più lontano',
  'menu.trade.allies': 'Commercio: solo alleati',
  'menu.tradeNext': 'Clic → {next}',
  'menu.warshipSpare': 'Navi: risparmia i neutrali',
  'menu.warshipAttackAll': 'Navi: attacca tutti',
  'menu.warshipNeutralDetail': 'commuta — risparmiare i mercantili neutrali?',
  'menu.goldTitle': 'Oro: {gold}',
  'menu.water': 'Acqua',
  'menu.warship': 'Nave da guerra',
  'menu.warshipHasPort': 'pattuglia e blocca il commercio nemico',
  'menu.warshipNoPort': 'porto necessario (salpata dal porto)',
  'menu.bomber': 'Lancia bombardiere',
  'menu.bomberDetail':
    'Bombarda il bersaglio — distrugge edifici, truppe e territorio nel raggio dell’esplosione',
  'menu.bomberCooldown': 'l’aeroporto si sta ancora ricaricando',
  'menu.bomberFull': 'hangar pieno o nessun aereo',
  'menu.attack': 'Attacco',
  'menu.attackDetail': '{n} truppe al fronte',
  'menu.boatDetail': '{n} truppe via acqua',

  // ── Suggerimento al passaggio ─────────────────────────────────────────────────
  'tip.effect.city': '+{cap} al limite truppe',
  'tip.effect.defense': '{mult}× costo di conquista · portata {range} caselle',
  'tip.effect.port': 'navi e commercio · conta come obiettivo di rete',
  'tip.effect.factory': 'oro di rete · portata {range} caselle',
  'tip.effect.airport': 'hangar · {slots} posti aereo',
  'tip.effect.flak': 'contraerea · portata {range} caselle',
  'tip.upgrade.defense': 'portata {range} caselle',
  'tip.upgrade.airport': 'hangar {slots} posti',
  'tip.upgrade.flak': 'portata {range} caselle',
  'tip.dests': '{n} obiettivi',
  'tip.tradeShip': 'Nave mercantile',
  'tip.warship': 'Nave da guerra',
  'tip.you': 'Tu',
  'tip.underConstruction': 'in costruzione',
  'tip.lvl': 'Liv.',
  'tip.neutralLand': 'terra neutrale',
  'tip.perTile': '~{n}/casella',
  'tip.allied': 'Alleato · {time} rimasti',
  'tip.grudge': 'Rancore {n}',
  'tip.favor': 'Favore {n}',
  'tip.traitor': 'Traditore — bandito (difesa indebolita)',
  'tip.loot': 'bottino alla conquista ~{gold}',

  // ── Finestre di dialogo ──────────────────────────────────────────────────────
  'confirm.leave': 'Esci',
  'confirm.keepPlaying': 'Continua',
  'confirm.leaveRound': 'Uscire dalla partita in corso?',
  'confirm.treason':
    '{ally} è tuo alleato. Un attacco è TRADIMENTO: l’alleanza si rompe, diventi bandito e subisci 1,5× danni da tutti per un po’. Attaccare comunque?',
  'loading.map': 'Generazione della mappa …',

  // ── Finestra di feedback ─────────────────────────────────────────────────────
  'feedback.triggerTitle': 'Dai un feedback o segnala un bug',
  'feedback.title': 'Feedback / segnala un bug',
  'feedback.kindFeedback': 'Feedback',
  'feedback.kindBug': 'Bug',
  'feedback.placeholder': 'Cosa vuoi dirci? (idea, lode, bug …)',
  'feedback.send': 'Invia',
  'feedback.cancel': 'Annulla',
  'feedback.empty': 'Scrivi qualcosa, per favore.',
  'feedback.sending': 'Invio …',
  'feedback.thanks': 'Grazie!',
  'feedback.error': 'Invio non riuscito (server raggiungibile?).',

  // ── Lobby multigiocatore ─────────────────────────────────────────────────────
  'mp.formTitle': 'Multigiocatore — territorial-loop',
  'mp.namePlaceholder': 'Tu',
  'mp.room': 'Stanza',
  'mp.roomPlaceholder': 'vuoto = nuova stanza',
  'mp.connect': 'Connetti',
  'mp.noUrl': 'Inserisci un URL del server.',
  'mp.back': 'Indietro',
  'mp.connecting': 'Connessione …',
  'mp.timeout':
    'Nessuna connessione (timeout). Il dev server (npm run dev) o npm run server è attivo?',
  'mp.lobbyTitle': 'Lobby',
  'mp.roomCode': 'Codice stanza',
  'mp.copy': 'Copia',
  'mp.copied': 'Copiato',
  'mp.you': 'tu',
  'mp.ready': 'pronto',
  'mp.waiting': 'in attesa …',
  'mp.disconnected': 'disconnesso',
  'mp.waitingPeers': 'In attesa di partecipanti …',
  'mp.readyBtn': 'Pronto',
  'mp.matchHost': 'Partita (sei l’host)',
  'mp.matchGuest': 'Partita (impostata dall’host)',
  'mp.public': 'elencata nel browser dei server',
  'mp.private': 'privata (solo via codice/link)',
  'mp.map': 'Mappa',
  'mp.terrain': 'Terreno',
  'mp.terrainFlat': 'Aperto',
  'mp.ai': 'IA',
  'mp.wild': 'Selvaggi',
  'mp.difficulty': 'Forza IA',
  'mp.visible': 'Visibile',
  'uiscale.title': 'Dimensione UI',
  'nation.wild': 'selvaggia',
  'hud.resync': 'Risincronizzazione …',
  'log.diplomacy': 'Diplomazia',
  'log.war': 'Guerra',
  'log.economy': 'Economia',
  'prompt.offersAlliance': 'propone un’alleanza',
  'prompt.accept': 'Accetta',
  'prompt.decline': 'Rifiuta',
  'prompt.ignore': 'Ignora',
  'field.rivers': 'Fiumi',
  'field.rivers.hint': 'solo continenti/isole, navigabili',
}
