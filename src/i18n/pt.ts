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
  'difficulty.easy': 'Fácil',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Difícil',
  'play.start': 'Iniciar partida',
  'play.spectate': 'Assistir',

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
  'settings.experimental': 'Experimental',
  'settings.experimental.body':
    'Recursos opcionais para testar aparecerão aqui como botões próprios — florestas, rios, peixes, ' +
    'ruído tipo terrestre… Nada ativo ainda.',

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
}
