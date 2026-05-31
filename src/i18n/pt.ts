/** Portugiesische Strings (pt-BR, ADR-0014). Fehlende Keys fallen auf Deutsch zurück. */
export const pt: Record<string, string> = {
  'app.tagline': 'RTS de navegador em um mundo sem bordas',

  'nav.play': 'Jogar',
  'nav.multiplayer': 'Multijogador',
  'nav.settings': 'Ajustes',
  'nav.changelog': 'Novidades',
  'nav.help': 'Ajuda',

  'header.name': 'Nome',
  'header.namePlaceholder': 'Seu nome',
  'footer.feedback': 'Feedback',
  'footer.sourcecode': 'Código-fonte',
  'lang.label': 'Idioma',

  'section.world': 'Mundo',
  'section.opponents': 'Rivais',
  'section.match': 'Partida',
  'field.map': 'Mapa (L × A)',
  'field.terrain': 'Tipo de mapa',
  'field.aiCount': 'Número de IA',
  'field.wildCount': 'Nações selvagens',
  'field.difficulty': 'Dificuldade da IA',
  'field.victory': 'Vitória %',
  'field.seed': 'Semente (opcional)',
  'field.seedPlaceholder': 'vazio = aleatória',
  'terrain.flat': 'Aberto (sem água)',
  'terrain.continents': 'Continentes',
  'terrain.islands': 'Ilhas',
  'terrain.world': 'Mundo (geo)',
  'terrain.europe': 'Europa (geo)',
  'terrain.africa': 'África (geo)',
  'terrain.australia': 'Austrália (geo)',
  'difficulty.beginner': 'Iniciante',
  'difficulty.easy': 'Fácil',
  'difficulty.standard': 'Padrão',
  'difficulty.advanced': 'Avançado',
  'difficulty.expert': 'Especialista',
  'play.start': 'Iniciar partida',
  'play.spectate': 'Assistir',
  'play.ranked': 'Ranqueado',

  'settings.intro': 'Exibição e recursos opcionais. Valem para a próxima partida.',
  'settings.display': 'Exibição',
  'field.camera': 'Câmera',
  'field.sound': 'Som',
  'toggle.on': 'sim',
  'toggle.off': 'não',
  'camera.tiles': 'Ladrilhos (como antes)',
  'camera.period': 'Caixa (sem emendas)',
  'camera.fixed': 'Caixa (fixa)',
  'camera.dynamic': 'Caixa dinâmica',
  'settings.buildings': 'Edifícios permitidos',
  'settings.buildings.body':
    'Os edifícios desativados não podem ser construídos por ninguém na partida — nem pela IA.',
  'settings.world': 'Mundo',

  'mp.intro': 'Entre em uma partida aberta ou crie sua própria sala.',
  'mp.openDialog': 'Criar sala / entrar por código',
  'mp.reconnect': '⟳ Reconectar — sala {room}',

  'lobby.openTitle': 'Salas abertas',
  'lobby.runningTitle': 'Partidas em andamento',
  'lobby.refresh': '↻ Atualizar',
  'lobby.emptyOpen': 'Nenhuma sala aberta. Crie uma em «Multijogador».',
  'lobby.emptyRunning': 'Nenhuma partida em andamento.',
  'lobby.spectate': 'Assistir',
  'lobby.unreachable': 'Servidor indisponível.',
  'lobby.loading': 'Carregando …',
  'lobby.players': 'jogadores',
  'lobby.spectators': 'espectadores',

  'info.title': 'Dicas e truques',
  'info.feedback': 'Feedback / relatar um bug',
  'info.tip.1':
    'As tropas crescem mais rápido em torno de 42 % do seu limite — gaste-as em ataques em vez de acumular.',
  'info.tip.2':
    'Fábricas dão ouro por cada cidade/porto conectado — e o triplo por conexões com nações estrangeiras.',
  'info.tip.3':
    'Shift+clique esquerdo ataca ao longo de toda a fronteira; Shift+roda ajusta o tamanho do ataque.',
  'info.tip.4':
    'O mundo é um toro: sair pela esquerda te traz de volta pela direita — use as bordas para flanquear.',
  'info.tip.5': 'Navios de guerra bloqueiam rotas comerciais inimigas e tomam a carga.',
  'info.tip.6': 'Achou um bug ou tem uma ideia? Conte-nos em «Feedback / relatar um bug».',

  'changelog.openFull': 'Abrir o registro completo',
  'changelog.title': 'Novidades',
  'changelog.loading': 'Carregando novidades …',
  'changelog.error': 'Não foi possível carregar o registro de alterações.',

  'help.title': 'Mecânicas do jogo',
  'help.intro':
    'territorial-loop é um RTS territorial em tempo real em um mundo sem bordas: sair pela esquerda ' +
    'te traz de volta pela direita (um toro). O objetivo é dominar grande parte do mapa.',

  'help.goal.title': 'Objetivo',
  'help.goal.body':
    'Conquiste território até controlar a fração do mapa definida na partida (vitória %). Se perder ' +
    'todo o seu território, você é eliminado.',

  'help.expansion.title': 'Expandir e atacar',
  'help.expansion.body':
    'O controle deslizante define quantas tropas um ataque recebe. Clicar em terra neutra expande ' +
    'você; clicar em uma nação ataca ao longo da fronteira. Uma vantagem de 2:1 basta para a tomada ' +
    'total; frentes equilibradas ficam difíceis. As tropas crescem até um limite que sobe com o ' +
    'território.',

  'help.buildings.title': 'Construções',
  'help.buildings.body':
    'Com ouro você constrói Cidade (mais limite de tropas), Posto de defesa (bônus + alcance contra ' +
    'ataques), Porto (comércio e navios) e Fábrica (economia). São melhoráveis; ao conquistar, o ' +
    'novo dono as mantém — exceto os postos de defesa.',

  'help.economy.title': 'Economia (redes de fábricas)',
  'help.economy.body':
    'O ouro não vem do tamanho do território, mas das fábricas: uma fábrica se conecta em linha ' +
    'reta às suas cidades/portos/fábricas no alcance e produz ouro por alvo conectado. Conexões com ' +
    'nações estrangeiras dão 3× ouro (e simpatia) — cooperar compensa. Construa Cidade + Porto + ' +
    'Fábrica perto e conecte-as.',

  'help.ships.title': 'Navios e comércio',
  'help.ships.body':
    'Barcaças de transporte levam tropas pela água a outras ilhas/flancos (revogáveis). Navios ' +
    'mercantes circulam entre portos e dão ouro a ambos os donos. Navios de guerra patrulham, ' +
    'bloqueiam/saqueiam mercantes inimigos e lutam entre si.',

  'help.diplomacy.title': 'Diplomacia',
  'help.diplomacy.body':
    'Você pode formar alianças (aliados não se atacam e compartilham simpatia) e impor embargos. As ' +
    'alianças expiram sozinhas. Tudo isso é feito pelo menu radial do clique direito.',

  'help.treason.title': 'Traição',
  'help.treason.body':
    'Atacar um aliado é traição: a aliança quebra e você fica proscrito por um tempo — os demais ' +
    'então causam 1,5× de dano a você. O jogo pede confirmação antes desse ataque.',

  'help.relations.title': 'Relações (rancor e simpatia)',
  'help.relations.body':
    'Guerra naval e embargos geram rancor; comércio e vizinhança de fábricas geram simpatia. Ambos ' +
    'se dissipam com o tempo, tingem as fronteiras (vermelho/verde) e guiam quem a IA ataca ou poupa.',

  'help.wild.title': 'Nações selvagens',
  'help.wild.body':
    'As nações selvagens são passivas: expandem-se pelo ermo, atacam com cautela, não constroem e ' +
    'têm um limite menor — um amortecedor conquistável e espólio.',

  'help.camera.title': 'Mundo e câmera',
  'help.camera.body':
    'O mapa é um toro (sem borda). Com a roda você dá zoom, arrastando ou com WASD move a câmera. O ' +
    'estilo (ladrilhos / caixa) é ajustado em Ajustes.',

  'help.controls.title': 'Controles',
  'help.controls.body':
    'Clique esquerdo: atacar/expandir · Shift+clique esquerdo: em volta de toda a fronteira · ' +
    'Shift+roda: ajustar o tamanho do ataque · Clique direito: menu radial (construir/barcaça/' +
    'navio/diplomacia) · 1–4: construções · B: modo barcaça · R: alcances dos navios · Espaço: ' +
    'pausa · Esc: menu.',

  'help.growth.title': 'Crescimento de tropas',
  'help.growth.body':
    'Cada nação tem um limite de tropas que sobe com seu número de células (de forma sublinear — o ' +
    'dobro de terra ≠ o dobro do limite). O crescimento por segundo não é constante: perto de 0 ' +
    'você cresce devagar, mais rápido com reserva média, e quanto mais perto do limite mais freia. ' +
    'O ótimo fica em torno de 42 % do limite. Gastar tropas em ataques te mantém na zona de alto ' +
    'crescimento; acumular perto do limite quase o paralisa.',

  // ── Registro de eventos ────────────────────────────────────────────────────
  'event.allianceExpired': 'A aliança entre {a} e {b} expirou',
  'event.breakTraitor': '{a} rompe a aliança com o traidor {b}',
  'event.betray': '{a} trai {b}!',
  'event.allied': '{a} e {b} são aliados',
  'event.allianceOffer': '{a} oferece uma aliança a {b}',
  'event.allianceDecline': '{a} recusa a aliança de {b}',
  'event.embargoOn': '{a} impõe um embargo a {b}',
  'event.donateGold': '{a} presenteia {b} com {n} de ouro',
  'event.donateTroops': '{a} envia {n} tropas em apoio a {b}',
  'event.embargoOff': '{a} suspende o embargo a {b}',
  'event.tradeMode.random': 'Destinos comerciais: aleatório',
  'event.tradeMode.nearest': 'Destinos comerciais: o mais próximo',
  'event.tradeMode.farthest': 'Destinos comerciais: o mais distante',
  'event.tradeMode.allies': 'Destinos comerciais: só aliados',
  'event.warshipNeutralSpare': 'Navios: poupar neutros',
  'event.warshipNeutralAll': 'Navios: atacar todos',
  'event.warshipHold': '{p}: os navios mantêm posição e se curam',
  'event.warshipPatrol': '{p}: os navios patrulham',
  'event.warshipLimit': '{p}: limite de navios atingido',
  'event.warshipNoGold': '{p}: ouro insuficiente para um navio de guerra',
  'event.warshipNoRoute': '{p}: nenhum porto com rota marítima até o alvo',
  'event.noCoast': '{p}: você não tem costa — conquiste terra junto à água primeiro',
  'event.noWaterway': '{p}: nenhuma rota marítima até este alvo',
  'event.boatAttack': '⚠ {player} ataca {defender} com uma barcaça de transporte',
  'event.boatSent': '{p} envia uma barcaça de transporte',
  'event.boatLand': '{p} desembarca tropas',
  'event.defend': '{p} repele o ataque de {attacker}',
  'event.warshipSent': '{p} envia um navio de guerra',
  'event.boatSunk': 'Barcaça de transporte de {p} afundada',
  'event.tradeBlocked': 'Navio mercante bloqueado',
  'event.warshipSunk': 'Navio de guerra de {p} afundado',
  'event.eliminated': '{p} foi eliminado',
  'event.victory': '{p} venceu a partida!',
  'event.loot': '{p} saqueia {amount} de ouro de {from}',
  'event.lootWild': '{p} saqueia {amount} de ouro do ermo',
  'event.annex': '{p} cerca uma nação selvagem e a anexa',
  'event.annexLoot': '{p} cerca uma nação selvagem e a anexa (+{amount} de ouro)',
  'event.annexFragment': '{p} engole o território cercado de {victim}',
  'event.annexFragmentLoot': '{p} engole o território cercado de {victim} (+{amount} de ouro)',

  // ── HUD ──────────────────────────────────────────────────────────────────────
  'hud.tooltip.city': 'Cidade — +{cap} de tropas máximas por nível.',
  'hud.tooltip.defense':
    'Posto de defesa — num raio de {range} (+{per}/nível) a conquista custa até {mult}× mais.',
  'hud.tooltip.port':
    'Porto — necessário para navios de transporte e comércio (só construível na água).',
  'hud.tooltip.factory':
    'Fábrica — liga-se em linha reta às tuas cidades/portos/fábricas e produz ouro por cada cidade/porto ligado.',
  'hud.tooltip.airport':
    'Aeroporto — hangar para {slots} avião por nível; lança bombardeiros (compra avião + munição por lançamento).',
  'hud.tooltip.flak': 'Antiaérea — abate bombardeiros inimigos num raio de {range} (+{per}/nível).',
  'hud.controls': 'Controlos',
  'hud.controlsBody':
    'Clique esquerdo: ataque · B: modo barco (alvo noutra ilha) · 7: modo bombardeiro · 8: navio de guerra<br/>Clique direito: menu (construir/ataque/barco/navio/diplomacia)<br/>Arrastar (esq./dir.) ou WASD: câmara · Roda: zoom<br/>1–6: edifícios (cidade/defesa/porto/fábrica/aeroporto/antiaérea) · R: alcances dos navios · Espaço: pausa<br/>, / . : velocidade · Esc: menu<br/>Clica no painel de ataque: cancelar / barco · navio de volta',
  'hud.rank': 'Classificação',
  'hud.troops': 'Tropas',
  'hud.gold': 'Ouro',
  'hud.boat': 'Barco de transporte',
  'hud.bomber': 'Bombardeiro',
  'hud.warship': 'Navio',
  'hud.boatHintShort': 'alvo noutra ilha',
  'hud.boatModeHint': 'Modo barco: clica num alvo costeiro noutra massa de terra · Esc termina',
  'route.direct': 'direto',
  'route.arc-left': 'arco à esquerda',
  'route.arc-right': 'arco à direita',
  'hud.bomberModeHint':
    'Modo bombardeiro · Rota: {route} · Shift+roda alterna · Clique = alvo · Esc termina',
  'hud.bomberWarnShot': 'Será abatido!',
  'hud.warshipModeHint':
    'Modo navio de guerra: clica num alvo na água (precisa de porto + ouro) · Esc termina',
  'hud.attack': 'Ataque: {pct}%',
  'hud.newMatch': 'Nova partida',
  'hud.pauseOverlay': 'PAUSA',
  'hud.pause': 'Pausa',
  'hud.inCombat': 'em combate {n}',
  'hud.ecoNote': '{factories} fábrica(s) · {dests} alvos',
  'hud.ecoBase': 'Ouro base',
  'hud.ecoFactory': 'Rede de fábricas',
  'hud.ecoTrade': 'Comércio',
  'hud.ecoSum': 'Total',
  'hud.wilderness': 'Natureza selvagem',
  'hud.cancelling': 'a cancelar…',
  'hud.cancelNow': 'Cancelar já',
  'hud.cancelAttack': 'Cancelar ataque (~2,5 s de recuo)',
  'hud.returning': 'a regressar',
  'hud.enRoute': 'a caminho',
  'hud.recallBoat': 'Recolher o barco',
  'hud.recallWarship': 'Recolher o navio',
  'hud.defendTitle': 'Defender — empregar tropas 1:1 (impulso do cursor)',
  'hud.defendWith': 'Defender com {troops} tropas',
  'hud.jumpToBattle': 'Ir para o ataque',
  'hud.attacks': 'Ataques',
  'hud.traitorTitle': 'Traidor — fora da lei, defesa enfraquecida (faltam {time})',
  'hud.alliedTitle': 'Aliado · expira em {time}',
  'hud.less': 'Menos ▴',
  'hud.showAll': 'Mostrar todos os {n} ▾ (+{hidden})',
  'hud.running': 'a decorrer',
  'hud.ended': 'terminada · vencedor {winner}',
  'hud.time': 'Tempo',
  'hud.traitorBanner': 'Estás fora da lei — todos te causam 1,5× de dano (faltam {time})',
  'hud.victory': 'Vitória',
  'hud.matchDuration': 'Duração {time} · a partida continua',
  'hud.colPlayer': 'Jogador',
  'hud.colPeakPct': 'Máx. %',
  'hud.colPeakTroops': 'Tropas máx.',

  // ── Nomes dos edifícios ───────────────────────────────────────────────────────
  'building.city': 'Cidade',
  'building.defense': 'Defesa',
  'building.port': 'Porto',
  'building.factory': 'Fábrica',
  'building.airport': 'Aeroporto',
  'building.flak': 'Antiaérea',

  // ── Menu radial ───────────────────────────────────────────────────────────────
  'menu.chooseAction': 'Escolhe uma ação',
  'menu.hint.city': '+{cap} de limite de tropas/nível',
  'menu.hint.defense': 'conquista até {mult}× mais cara',
  'menu.hint.port': 'requisito para navios',
  'menu.hint.factory': 'ouro pela rede (cidades/portos no alcance)',
  'menu.hint.airport': 'lança bombardeiros contra um alvo (ouro por lançamento)',
  'menu.hint.flak': 'abate bombardeiros inimigos de passagem',
  'menu.breakAlliance': 'Romper aliança',
  'menu.breakAllianceDetail': 'traição → fora da lei · expira em {time}',
  'menu.acceptAlliance': 'Aceitar aliança',
  'menu.acceptAllianceDetail': 'oferece uma aliança',
  'menu.requestSent': 'Pedido enviado …',
  'menu.requestSentDetail': 'à espera de resposta',
  'menu.requestAlliance': 'Pedir aliança',
  'menu.requestAllianceDetail': 'propor uma aliança',
  'menu.embargoLift': 'Levantar embargo',
  'menu.embargoImpose': 'Impor embargo',
  'menu.embargoLiftDetail': 'permitir o comércio de novo',
  'menu.embargoImposeDetail': 'para o comércio',
  'menu.tradeAllowAll': 'Permitir o comércio de novo',
  'menu.tradeStopAll': 'Parar o comércio com todos',
  'menu.tradeAllowAllDetail': 'levanta todos os embargos — portos e fábricas voltam a comerciar',
  'menu.tradeStopAllDetail':
    'embargo contra todos — para navios mercantes e ligações externas das fábricas',
  'menu.maxLevel': 'Nível máximo',
  'menu.upgrade': 'Melhorar → L{level}',
  'menu.warshipHoldLabel': 'Navios: manter e curar',
  'menu.warshipPingPong': 'Navios: ping-pong',
  'menu.warshipModeDetail': 'alternar — vale para todos os teus navios de guerra',
  'menu.trade.random': 'Comércio: aleatório',
  'menu.trade.nearest': 'Comércio: mais próximo',
  'menu.trade.farthest': 'Comércio: mais distante',
  'menu.trade.allies': 'Comércio: só aliados',
  'menu.tradeNext': 'Clique → {next}',
  'menu.warshipSpare': 'Navios: poupar neutros',
  'menu.warshipAttackAll': 'Navios: atacar todos',
  'menu.warshipNeutralDetail': 'alternar — poupar mercantes neutros?',
  'menu.goldTitle': 'Ouro: {gold}',
  'menu.water': 'Água',
  'menu.warship': 'Navio de guerra',
  'menu.warshipHasPort': 'patrulha e bloqueia o comércio inimigo',
  'menu.warshipNoPort': 'porto necessário (sai do porto)',
  'menu.bomber': 'Lançar bombardeiro',
  'menu.bomberDetail':
    'Bombardeia o alvo — destrói edifícios, tropas e território no raio da explosão',
  'menu.bomberCooldown': 'o aeródromo ainda está a recarregar',
  'menu.bomberFull': 'hangar cheio ou sem avião',
  'menu.attack': 'Ataque',
  'menu.attackDetail': '{n} tropas para a frente',
  'menu.boatDetail': '{n} tropas pela água',

  // ── Dica ao passar o cursor ───────────────────────────────────────────────────
  'tip.effect.city': '+{cap} de limite de tropas',
  'tip.effect.defense': '{mult}× custo de conquista · alcance {range} casas',
  'tip.effect.port': 'navios e comércio · conta como alvo de rede',
  'tip.effect.factory': 'ouro de rede · alcance {range} casas',
  'tip.effect.airport': 'hangar · {slots} lugares de avião',
  'tip.effect.flak': 'antiaérea · alcance {range} casas',
  'tip.upgrade.defense': 'alcance {range} casas',
  'tip.upgrade.airport': 'hangar {slots} lugares',
  'tip.upgrade.flak': 'alcance {range} casas',
  'tip.dests': '{n} alvos',
  'tip.tradeShip': 'Navio mercante',
  'tip.warship': 'Navio de guerra',
  'tip.you': 'Tu',
  'tip.underConstruction': 'em construção',
  'tip.lvl': 'Nv.',
  'tip.neutralLand': 'terra neutra',
  'tip.perTile': '~{n}/casa',
  'tip.allied': 'Aliado · faltam {time}',
  'tip.grudge': 'Rancor {n}',
  'tip.favor': 'Simpatia {n}',
  'tip.traitor': 'Traidor — fora da lei (defesa enfraquecida)',
  'tip.loot': 'espólio ao conquistar ~{gold}',

  // ── Diálogos ─────────────────────────────────────────────────────────────────
  'confirm.leave': 'Sair',
  'confirm.keepPlaying': 'Continuar a jogar',
  'confirm.leaveRound': 'Sair da ronda atual?',
  'confirm.treason':
    '{ally} é teu aliado. Um ataque é TRAIÇÃO: a aliança quebra, ficas fora da lei e recebes 1,5× de dano de todos por um tempo. Atacar mesmo assim?',
  'loading.map': 'A gerar o mapa …',

  // ── Diálogo de feedback ──────────────────────────────────────────────────────
  'feedback.triggerTitle': 'Dar feedback ou reportar um bug',
  'feedback.title': 'Feedback / reportar um bug',
  'feedback.kindFeedback': 'Feedback',
  'feedback.kindBug': 'Bug',
  'feedback.placeholder': 'O que queres dizer? (ideia, elogio, bug …)',
  'feedback.send': 'Enviar',
  'feedback.cancel': 'Cancelar',
  'feedback.empty': 'Escreve algo, por favor.',
  'feedback.sending': 'A enviar …',
  'feedback.thanks': 'Obrigado!',
  'feedback.error': 'Não foi possível enviar (servidor acessível?).',

  // ── Sala multijogador ────────────────────────────────────────────────────────
  'mp.formTitle': 'Multijogador — territorial-loop',
  'mp.namePlaceholder': 'Tu',
  'mp.room': 'Sala',
  'mp.roomPlaceholder': 'vazio = sala nova',
  'mp.connect': 'Conectar',
  'mp.noUrl': 'Indica um URL de servidor.',
  'mp.back': 'Voltar',
  'mp.connecting': 'A conectar …',
  'mp.timeout':
    'Sem ligação (tempo esgotado). O dev server (npm run dev) ou npm run server está a correr?',
  'mp.lobbyTitle': 'Sala',
  'mp.roomCode': 'Código da sala',
  'mp.copy': 'Copiar',
  'mp.copied': 'Copiado',
  'mp.you': 'tu',
  'mp.ready': 'pronto',
  'mp.waiting': 'a aguardar …',
  'mp.disconnected': 'desligado',
  'mp.waitingPeers': 'À espera de participantes …',
  'mp.readyBtn': 'Pronto',
  'mp.matchHost': 'Partida (és o anfitrião)',
  'mp.matchGuest': 'Partida (definida pelo anfitrião)',
  'mp.public': 'listada no navegador de servidores',
  'mp.private': 'privada (só por código/link)',
  'mp.map': 'Mapa',
  'mp.terrain': 'Terreno',
  'mp.terrainFlat': 'Aberto',
  'mp.ai': 'IA',
  'mp.wild': 'Selvagens',
  'mp.difficulty': 'Força da IA',
  'mp.visible': 'Visível',
  'uiscale.title': 'Tamanho da interface',
  'nation.wild': 'selvagem',
  'hud.resync': 'Ressincronizando …',
  'log.diplomacy': 'Diplomacia',
  'log.war': 'Guerra',
  'log.economy': 'Economia',
  'prompt.offersAlliance': 'oferece uma aliança',
  'prompt.accept': 'Aceitar',
  'prompt.decline': 'Recusar',
  'prompt.ignore': 'Ignorar',
  'field.rivers': 'Rios',
  'field.rivers.hint': 'só continentes/ilhas, navegáveis',
}
