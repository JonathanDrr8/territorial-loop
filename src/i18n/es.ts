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
  'difficulty.easy': 'Fácil',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Difícil',
  'play.start': 'Iniciar partida',
  'play.spectate': 'Espectar',

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
  'settings.experimental': 'Experimental',
  'settings.experimental.body':
    'Las funciones opcionales para probar aparecerán aquí como interruptores propios — bosques, ' +
    'ríos, peces, ruido tipo terrestre… Todavía nada activo.',

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
  'event.boatAttack': '⚠ {player} ataca a {defender} con un bote de transporte',
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
  'event.annex': '{p} rodea a {wild} y la anexiona',
  'event.annexLoot': '{p} rodea a {wild} y la anexiona (+{amount} de oro)',
}
