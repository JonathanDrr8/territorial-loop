/** Spanische Strings (ADR-0014). Fehlende Keys fallen auf Deutsch zurück. */
export const es: Record<string, string> = {
  'app.tagline': 'RTS de navegador en un mundo sin bordes',

  'nav.play': 'Jugar',
  'nav.multiplayer': 'Multijugador',
  'nav.settings': 'Ajustes',
  'nav.changelog': 'Novedades',
  'nav.help': 'Ayuda',

  'header.name': 'Nombre',
  'header.namePlaceholder': 'Tu nombre',
  'footer.feedback': 'Comentarios',
  'footer.sourcecode': 'Código fuente',
  'lang.label': 'Idioma',

  'section.world': 'Mundo',
  'section.opponents': 'Rivales',
  'section.match': 'Partida',
  'field.map': 'Mapa (An × Al)',
  'field.terrain': 'Tipo de mapa',
  'field.aiCount': 'Número de IA',
  'field.wildCount': 'Naciones salvajes',
  'field.difficulty': 'Dificultad de la IA',
  'field.victory': 'Victoria %',
  'field.seed': 'Semilla (opcional)',
  'field.seedPlaceholder': 'vacío = aleatoria',
  'terrain.flat': 'Abierto (sin agua)',
  'terrain.continents': 'Continentes',
  'terrain.islands': 'Islas',
  'terrain.world': 'Mundo (geo)',
  'terrain.europe': 'Europa (geo)',
  'terrain.africa': 'África (geo)',
  'terrain.australia': 'Australia (geo)',
  'difficulty.beginner': 'Principiante',
  'difficulty.easy': 'Fácil',
  'difficulty.standard': 'Estándar',
  'difficulty.advanced': 'Avanzado',
  'difficulty.expert': 'Experto',
  'play.start': 'Iniciar partida',
  'play.spectate': 'Espectar',
  'play.ranked': 'Clasificatoria',

  'settings.intro': 'Presentación y funciones opcionales. Se aplican a la próxima partida.',
  'settings.display': 'Presentación',
  'field.camera': 'Cámara',
  'field.sound': 'Sonido',
  'toggle.on': 'sí',
  'toggle.off': 'no',
  'camera.tiles': 'Mosaico (como antes)',
  'camera.period': 'Caja (sin costuras)',
  'camera.fixed': 'Caja (fija)',
  'camera.dynamic': 'Caja dinámica',
  'settings.buildings': 'Edificios permitidos',
  'settings.buildings.body':
    'Los edificios desactivados no puede construirlos nadie en la partida, ni siquiera la IA.',
  'settings.world': 'Mundo',

  'mp.intro': 'Únete a una partida abierta o crea tu propia sala.',
  'mp.openDialog': 'Crear sala / unirse por código',
  'mp.reconnect': '⟳ Reconectar — sala {room}',

  'lobby.openTitle': 'Salas abiertas',
  'lobby.runningTitle': 'Partidas en curso',
  'lobby.refresh': '↻ Actualizar',
  'lobby.emptyOpen': 'No hay salas abiertas. Crea una desde «Multijugador».',
  'lobby.emptyRunning': 'No hay partidas en curso.',
  'lobby.spectate': 'Espectar',
  'lobby.unreachable': 'Servidor no disponible.',
  'lobby.loading': 'Cargando …',
  'lobby.players': 'jugadores',
  'lobby.spectators': 'espectadores',

  'info.title': 'Consejos y trucos',
  'info.feedback': 'Comentarios / informar de un fallo',
  'info.tip.1':
    'Las tropas crecen más rápido en torno al 42 % de tu límite — gástalas en ataques en vez de acumularlas.',
  'info.tip.2':
    'Las fábricas dan oro por cada ciudad/puerto conectado — y el triple por conexiones con naciones ajenas.',
  'info.tip.3':
    'Mayús+clic izquierdo ataca a lo largo de toda la frontera; Mayús+rueda ajusta el tamaño del ataque.',
  'info.tip.4':
    'El mundo es un toro: salir por la izquierda te devuelve por la derecha — usa los bordes para flanquear.',
  'info.tip.5':
    'Los buques de guerra bloquean rutas comerciales enemigas y se apoderan de la carga.',
  'info.tip.6':
    '¿Has encontrado un fallo o tienes una idea? Dínoslo con «Comentarios / informar de un fallo».',

  'changelog.openFull': 'Abrir el registro completo',
  'changelog.title': 'Novedades',
  'changelog.loading': 'Cargando novedades …',
  'changelog.error': 'No se pudo cargar el registro de cambios.',

  'help.title': 'Mecánicas del juego',
  'help.intro':
    'territorial-loop es un RTS territorial en tiempo real en un mundo sin bordes: salir por la ' +
    'izquierda te devuelve por la derecha (un toro). El objetivo es dominar gran parte del mapa.',

  'help.goal.title': 'Objetivo',
  'help.goal.body':
    'Conquista territorio hasta controlar el porcentaje del mapa fijado en la partida (victoria %). ' +
    'Si pierdes todo tu territorio, quedas eliminado.',

  'help.expansion.title': 'Expandirse y atacar',
  'help.expansion.body':
    'El control deslizante fija cuántas tropas recibe un ataque. Hacer clic en tierra neutral te ' +
    'expande; hacer clic en una nación ataca a lo largo de la frontera. Una ventaja de 2:1 basta ' +
    'para la toma completa; los frentes parejos se vuelven duros. Las tropas crecen hasta un límite ' +
    'que sube con tu territorio.',

  'help.buildings.title': 'Edificios',
  'help.buildings.body':
    'Con oro construyes Ciudad (más límite de tropas), Puesto defensivo (bonus + alcance contra ' +
    'ataques), Puerto (comercio y barcos) y Fábrica (economía). Son mejorables; al conquistarlos, el ' +
    'nuevo dueño los conserva — salvo los puestos defensivos.',

  'help.economy.title': 'Economía (redes de fábricas)',
  'help.economy.body':
    'El oro no viene del tamaño del territorio, sino de las fábricas: una fábrica se conecta en ' +
    'línea recta con tus ciudades/puertos/fábricas dentro del alcance y produce oro por cada ' +
    'objetivo conectado. Las conexiones con naciones ajenas dan 3× oro (y simpatía) — cooperar ' +
    'merece la pena. Construye Ciudad + Puerto + Fábrica cerca y conéctalas.',

  'help.ships.title': 'Barcos y comercio',
  'help.ships.body':
    'Los botes de transporte llevan tropas por el agua a otras islas/flancos (revocables). Los ' +
    'barcos mercantes viajan entre puertos y dan oro a ambos dueños. Los buques de guerra patrullan, ' +
    'bloquean/saquean barcos mercantes enemigos y luchan entre sí.',

  'help.diplomacy.title': 'Diplomacia',
  'help.diplomacy.body':
    'Puedes formar alianzas (los aliados no se atacan y comparten simpatía) e imponer embargos. Las ' +
    'alianzas caducan solas. Todo ello se maneja desde el menú radial del clic derecho.',

  'help.treason.title': 'Traición',
  'help.treason.body':
    'Atacar a un aliado es traición: la alianza se rompe y quedas proscrito un tiempo — los demás te ' +
    'infligen entonces 1,5× de daño. El juego te lo confirma antes de ese ataque.',

  'help.relations.title': 'Relaciones (rencor y simpatía)',
  'help.relations.body':
    'La guerra naval y los embargos generan rencor; el comercio y la vecindad de fábricas generan ' +
    'simpatía. Ambos se desvanecen con el tiempo, tiñen las fronteras (rojo/verde) y guían a quién ' +
    'ataca o perdona la IA.',

  'help.wild.title': 'Naciones salvajes',
  'help.wild.body':
    'Las naciones salvajes son pasivas: se expanden por el yermo, atacan con cautela, no construyen ' +
    'y tienen un límite menor — un colchón conquistable y botín.',

  'help.camera.title': 'Mundo y cámara',
  'help.camera.body':
    'El mapa es un toro (sin borde). Con la rueda haces zoom, arrastrando o con WASD mueves la ' +
    'cámara. El estilo (mosaico / caja) se ajusta en Ajustes.',

  'help.controls.title': 'Controles',
  'help.controls.body':
    'Clic izquierdo: atacar/expandir · Mayús+clic izquierdo: alrededor de toda la frontera · ' +
    'Mayús+rueda: ajustar el tamaño del ataque · Clic derecho: menú radial (construir/bote/buque/' +
    'diplomacia) · 1–4: edificios · B: modo bote · R: alcances de barcos · Espacio: pausa · Esc: menú.',

  'help.growth.title': 'Crecimiento de tropas',
  'help.growth.body':
    'Cada nación tiene un límite de tropas que sube con tu número de casillas (sublinealmente — el ' +
    'doble de tierra ≠ el doble de límite). El crecimiento por segundo no es constante: cerca de 0 ' +
    'creces despacio, más rápido a media reserva, y cuanto más cerca del límite más se frena. El ' +
    'óptimo está en torno al 42 % del límite. Gastar tropas en ataques te mantiene en la zona de ' +
    'alto crecimiento; acumular cerca del límite casi lo detiene.',

  // ── Registro de eventos ────────────────────────────────────────────────────
  'event.allianceExpired': 'La alianza entre {a} y {b} ha expirado',
  'event.breakTraitor': '{a} rompe la alianza con el traidor {b}',
  'event.betray': '¡{a} traiciona a {b}!',
  'event.allied': '{a} y {b} son aliados',
  'event.allianceOffer': '{a} ofrece una alianza a {b}',
  'event.allianceDecline': '{a} rechaza la alianza de {b}',
  'event.embargoOn': '{a} impone un embargo a {b}',
  'event.donateGold': '{a} regala {n} de oro a {b}',
  'event.donateTroops': '{a} envía {n} tropas a {b} como apoyo',
  'event.embargoOff': '{a} levanta el embargo a {b}',
  'event.tradeMode.random': 'Destinos comerciales: aleatorio',
  'event.tradeMode.nearest': 'Destinos comerciales: el más cercano',
  'event.tradeMode.farthest': 'Destinos comerciales: el más lejano',
  'event.tradeMode.allies': 'Destinos comerciales: solo aliados',
  'event.warshipNeutralSpare': 'Buques: respetar neutrales',
  'event.warshipNeutralAll': 'Buques: atacar a todos',
  'event.warshipHold': '{p}: los buques mantienen posición y se curan',
  'event.warshipPatrol': '{p}: los buques patrullan',
  'event.warshipLimit': '{p}: límite de buques alcanzado',
  'event.warshipNoGold': '{p}: oro insuficiente para un buque',
  'event.warshipNoRoute': '{p}: ningún puerto con ruta marítima al objetivo',
  'event.noCoast': '{p}: no tienes costa propia — conquista tierra junto al agua primero',
  'event.noWaterway': '{p}: no hay ruta marítima a este objetivo',
  'event.boatAttack': '{player} ataca a {defender} con un bote de transporte',
  'event.boatSent': '{p} envía un bote de transporte',
  'event.boatLand': '{p} desembarca tropas',
  'event.defend': '{p} repele el ataque de {attacker}',
  'event.warshipSent': '{p} envía un buque de guerra',
  'event.boatSunk': 'Bote de transporte de {p} hundido',
  'event.tradeBlocked': 'Barco mercante bloqueado',
  'event.warshipSunk': 'Buque de guerra de {p} hundido',
  'event.eliminated': '{p} fue eliminado',
  'event.victory': '¡{p} ha ganado la partida!',
  'event.loot': '{p} saquea {amount} de oro de {from}',
  'event.lootWild': '{p} saquea {amount} de oro del yermo',
  'event.annex': '{p} rodea a una nación salvaje y la anexiona',
  'event.annexLoot': '{p} rodea a una nación salvaje y la anexiona (+{amount} de oro)',
  'event.annexFragment': '{p} se traga el territorio cercado de {victim}',
  'event.annexFragmentLoot': '{p} se traga el territorio cercado de {victim} (+{amount} de oro)',

  // ── HUD ──────────────────────────────────────────────────────────────────────
  'hud.tooltip.city': 'Ciudad — +{cap} de tropas máximas por nivel.',
  'hud.tooltip.defense':
    'Puesto de defensa — en un radio de {range} (+{per}/nivel) la conquista cuesta hasta {mult}× más.',
  'hud.tooltip.port':
    'Puerto — necesario para barcos de transporte y comercio (solo sobre el agua).',
  'hud.tooltip.factory':
    'Fábrica — se conecta en línea recta con tus ciudades/puertos/fábricas y produce oro por cada ciudad/puerto conectado.',
  'hud.tooltip.airport':
    'Aeropuerto — hangar para {slots} avión por nivel; lanza bombarderos (compra avión + munición por lanzamiento).',
  'hud.tooltip.flak':
    'Antiaéreo — derriba bombarderos enemigos en un radio de {range} (+{per}/nivel).',
  'hud.controls': 'Controles',
  'hud.controlsBody':
    'Clic izquierdo: atacar · B: modo barco (objetivo en otra isla) · 7: modo bombardero · 8: buque<br/>Clic derecho: menú (construir/atacar/barco/buque/diplomacia)<br/>Arrastrar (izq./der.) o WASD: cámara · Rueda: zoom<br/>1–6: edificios (ciudad/defensa/puerto/fábrica/aeropuerto/antiaéreo) · R: alcances de barcos · Espacio: pausa<br/>, / . : velocidad · Esc: menú<br/>Clic en el panel de ataque: cancelar / barco · volver',
  'hud.rank': 'Clasificación',
  'hud.troops': 'Tropas',
  'hud.gold': 'Oro',
  'hud.boat': 'Barco de transporte',
  'hud.bomber': 'Bombardero',
  'hud.warship': 'Buque',
  'hud.boatHintShort': 'objetivo en otra isla',
  'hud.boatModeHint':
    'Modo barco: haz clic en un objetivo costero de otra masa de tierra · Esc termina',
  'route.direct': 'directo',
  'route.arc-left': 'arco izquierda',
  'route.arc-right': 'arco derecha',
  'hud.bomberModeHint':
    'Modo bombardero · Ruta: {route} · Shift+rueda cambia · Clic = objetivo · Esc termina',
  'hud.bomberWarnShot': '¡Será derribado!',
  'hud.warshipModeHint':
    'Modo buque: haz clic en un objetivo en el agua (necesita puerto + oro) · Esc termina',
  'hud.attack': 'Ataque: {pct}%',
  'hud.newMatch': 'Nueva partida',
  'hud.pauseOverlay': 'PAUSA',
  'hud.pause': 'Pausa',
  'hud.inCombat': 'en combate {n}',
  'hud.ecoNote': '{factories} fábrica(s) · {dests} objetivos',
  'hud.ecoBase': 'Oro base',
  'hud.ecoFactory': 'Red de fábricas',
  'hud.ecoTrade': 'Comercio',
  'hud.ecoSum': 'Total',
  'hud.wilderness': 'Tierra salvaje',
  'hud.cancelling': 'cancelando…',
  'hud.cancelNow': 'Cancelar de inmediato',
  'hud.cancelAttack': 'Cancelar ataque (~2,5 s de retirada)',
  'hud.returning': 'regresando',
  'hud.enRoute': 'en camino',
  'hud.recallBoat': 'Llamar de vuelta al barco',
  'hud.recallWarship': 'Llamar de vuelta al buque',
  'hud.defendTitle': 'Defender — emplear tropas 1:1 (empuje del deslizador)',
  'hud.defendWith': 'Defender con {troops} tropas',
  'hud.jumpToBattle': 'Saltar al ataque',
  'hud.attacks': 'Ataques',
  'hud.traitorTitle': 'Traidor — proscrito, defensa debilitada (quedan {time})',
  'hud.alliedTitle': 'Aliado · vence en {time}',
  'hud.less': 'Menos ▴',
  'hud.showAll': 'Mostrar todos los {n} ▾ (+{hidden})',
  'hud.running': 'en curso',
  'hud.ended': 'terminada · ganador {winner}',
  'hud.time': 'Tiempo',
  'hud.traitorBanner': 'Estás proscrito — todos te hacen 1,5× de daño (quedan {time})',
  'hud.victory': 'Victoria',
  'hud.matchDuration': 'Duración {time} · la partida continúa',
  'hud.colPlayer': 'Jugador',
  'hud.colPeakPct': 'Máx. %',
  'hud.colPeakTroops': 'Tropas máx.',

  // ── Nombres de edificios ──────────────────────────────────────────────────────
  'building.city': 'Ciudad',
  'building.defense': 'Defensa',
  'building.port': 'Puerto',
  'building.factory': 'Fábrica',
  'building.airport': 'Aeropuerto',
  'building.flak': 'Antiaéreo',

  // ── Menú radial ───────────────────────────────────────────────────────────────
  'menu.chooseAction': 'Elige una acción',
  'menu.hint.city': '+{cap} de límite de tropas/nivel',
  'menu.hint.defense': 'conquista hasta {mult}× más cara',
  'menu.hint.port': 'requisito para barcos',
  'menu.hint.factory': 'oro por red (ciudades/puertos al alcance)',
  'menu.hint.airport': 'lanza bombarderos contra un objetivo (oro por lanzamiento)',
  'menu.hint.flak': 'derriba bombarderos enemigos que pasan',
  'menu.breakAlliance': 'Romper alianza',
  'menu.breakAllianceDetail': 'traición → proscrito · vence en {time}',
  'menu.acceptAlliance': 'Aceptar alianza',
  'menu.acceptAllianceDetail': 'ofrece una alianza',
  'menu.requestSent': 'Solicitud enviada …',
  'menu.requestSentDetail': 'esperando respuesta',
  'menu.requestAlliance': 'Solicitar alianza',
  'menu.requestAllianceDetail': 'proponer una alianza',
  'menu.embargoLift': 'Levantar embargo',
  'menu.embargoImpose': 'Imponer embargo',
  'menu.donateGold': 'Regalar oro',
  'menu.donateGoldParent': 'Ganar simpatía / calmar rencor',
  'menu.donateGoldDetail': 'Regala {n} de oro',
  'menu.donateSlider': 'Cantidad del control',
  'menu.donateTroops': 'Regalar tropas',
  'menu.donateTroopsDetail': 'Envía {n} tropas de apoyo',
  'menu.embargoLiftDetail': 'permitir el comercio de nuevo',
  'menu.embargoImposeDetail': 'detiene el comercio',
  'menu.tradeAllowAll': 'Permitir el comercio de nuevo',
  'menu.tradeStopAll': 'Detener el comercio con todos',
  'menu.tradeAllowAllDetail': 'levanta todos los embargos — puertos y fábricas vuelven a comerciar',
  'menu.tradeStopAllDetail':
    'embargo contra todos — detiene barcos mercantes y enlaces externos de fábricas',
  'menu.maxLevel': 'Nivel máximo',
  'menu.upgrade': 'Mejorar → L{level}',
  'menu.warshipHoldLabel': 'Barcos: mantener y curar',
  'menu.warshipPingPong': 'Barcos: ping-pong',
  'menu.warshipModeDetail': 'alternar — vale para todos tus buques',
  'menu.trade.random': 'Comercio: aleatorio',
  'menu.trade.nearest': 'Comercio: más cercano',
  'menu.trade.farthest': 'Comercio: más lejano',
  'menu.trade.allies': 'Comercio: solo aliados',
  'menu.tradeNext': 'Clic → {next}',
  'menu.warshipSpare': 'Barcos: perdonar neutrales',
  'menu.warshipAttackAll': 'Barcos: atacar a todos',
  'menu.warshipNeutralDetail': '¿alternar — perdonar mercantes neutrales?',
  'menu.goldTitle': 'Oro: {gold}',
  'menu.water': 'Agua',
  'menu.warship': 'Buque de guerra',
  'menu.warshipHasPort': 'patrulla y bloquea el comercio enemigo',
  'menu.warshipNoPort': 'se necesita puerto (sale del puerto)',
  'menu.bomber': 'Lanzar bombardero',
  'menu.bomberDetail':
    'Bombardea el objetivo — destruye edificios, tropas y territorio en el radio de la explosión',
  'menu.bomberCooldown': 'el aeródromo aún se recarga',
  'menu.bomberFull': 'hangar lleno o sin avión',
  'menu.attack': 'Ataque',
  'menu.attackDetail': '{n} tropas al frente',
  'menu.boatDetail': '{n} tropas por el agua',

  // ── Información al pasar el cursor ─────────────────────────────────────────────
  'tip.effect.city': '+{cap} de límite de tropas',
  'tip.effect.defense': '{mult}× coste de conquista · alcance {range} casillas',
  'tip.effect.port': 'barcos y comercio · cuenta como objetivo de red',
  'tip.effect.factory': 'oro de red · alcance {range} casillas',
  'tip.effect.airport': 'hangar · {slots} plazas de avión',
  'tip.effect.flak': 'antiaéreo · alcance {range} casillas',
  'tip.upgrade.defense': 'alcance {range} casillas',
  'tip.upgrade.airport': 'hangar {slots} plazas',
  'tip.upgrade.flak': 'alcance {range} casillas',
  'tip.dests': '{n} objetivos',
  'tip.tradeShip': 'Barco mercante',
  'tip.warship': 'Buque de guerra',
  'tip.you': 'Tú',
  'tip.underConstruction': 'en construcción',
  'tip.lvl': 'Nv.',
  'tip.neutralLand': 'tierra neutral',
  'tip.perTile': '~{n}/casilla',
  'tip.allied': 'Aliado · quedan {time}',
  'tip.grudge': 'Rencor {n}',
  'tip.favor': 'Simpatía {n}',
  'tip.traitor': 'Traidor — proscrito (defensa debilitada)',
  'tip.loot': 'botín al conquistar ~{gold}',

  // ── Diálogos ─────────────────────────────────────────────────────────────────
  'confirm.leave': 'Salir',
  'confirm.keepPlaying': 'Seguir jugando',
  'confirm.leaveRound': '¿Salir de la ronda actual?',
  'confirm.treason':
    '{ally} es tu aliado. Un ataque es TRAICIÓN: la alianza se rompe, quedas proscrito y recibes 1,5× de daño de todos durante un tiempo. ¿Atacar de todos modos?',
  'loading.map': 'Generando el mapa …',

  // ── Diálogo de feedback ──────────────────────────────────────────────────────
  'feedback.triggerTitle': 'Dar feedback o reportar un bug',
  'feedback.title': 'Feedback / reportar un bug',
  'feedback.kindFeedback': 'Feedback',
  'feedback.kindBug': 'Bug',
  'feedback.placeholder': '¿Qué quieres decir? (idea, elogio, bug …)',
  'feedback.send': 'Enviar',
  'feedback.cancel': 'Cancelar',
  'feedback.empty': 'Escribe algo, por favor.',
  'feedback.sending': 'Enviando …',
  'feedback.thanks': '¡Gracias!',
  'feedback.error': 'No se pudo enviar (¿servidor accesible?).',

  // ── Sala multijugador ────────────────────────────────────────────────────────
  'mp.formTitle': 'Multijugador — territorial-loop',
  'mp.namePlaceholder': 'Tú',
  'mp.room': 'Sala',
  'mp.roomPlaceholder': 'vacío = sala nueva',
  'mp.connect': 'Conectar',
  'mp.noUrl': 'Introduce una URL de servidor.',
  'mp.back': 'Atrás',
  'mp.connecting': 'Conectando …',
  'mp.timeout':
    'Sin conexión (tiempo agotado). ¿Está corriendo el dev server (npm run dev) o npm run server?',
  'mp.lobbyTitle': 'Sala',
  'mp.roomCode': 'Código de sala',
  'mp.copy': 'Copiar',
  'mp.copied': 'Copiado',
  'mp.you': 'tú',
  'mp.ready': 'listo',
  'mp.waiting': 'esperando …',
  'mp.disconnected': 'desconectado',
  'mp.waitingPeers': 'Esperando participantes …',
  'mp.readyBtn': 'Listo',
  'mp.matchHost': 'Partida (eres el anfitrión)',
  'mp.matchGuest': 'Partida (fijada por el anfitrión)',
  'mp.public': 'listada en el navegador de servidores',
  'mp.private': 'privada (solo por código/enlace)',
  'mp.map': 'Mapa',
  'mp.terrain': 'Terreno',
  'mp.terrainFlat': 'Abierto',
  'mp.ai': 'IA',
  'mp.wild': 'Salvajes',
  'mp.difficulty': 'Fuerza de la IA',
  'mp.visible': 'Visible',
  'uiscale.title': 'Tamaño de la interfaz',
  'nation.wild': 'salvaje',
  'hud.resync': 'Resincronizando …',
  'log.diplomacy': 'Diplomacia',
  'log.war': 'Guerra',
  'log.economy': 'Economía',
  'prompt.offersAlliance': 'ofrece una alianza',
  'prompt.accept': 'Aceptar',
  'prompt.decline': 'Rechazar',
  'prompt.ignore': 'Ignorar',
  'field.rivers': 'Ríos',
  'field.rivers.hint': 'solo continentes/islas, navegables',
}
