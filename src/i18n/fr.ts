/** Französische Strings (ADR-0014). Fehlende Keys fallen auf Deutsch zurück. */
export const fr: Record<string, string> = {
  'app.tagline': 'RTS de navigateur sur un monde sans bords',

  'nav.play': 'Jouer',
  'nav.multiplayer': 'Multijoueur',
  'nav.settings': 'Réglages',
  'nav.changelog': 'Nouveautés',
  'nav.help': 'Aide',

  'header.name': 'Nom',
  'header.namePlaceholder': 'Ton nom',
  'footer.feedback': 'Retour',
  'footer.sourcecode': 'Code source',
  'lang.label': 'Langue',

  'section.world': 'Monde',
  'section.opponents': 'Adversaires',
  'section.match': 'Partie',
  'field.map': 'Carte (L × H)',
  'field.terrain': 'Type de carte',
  'field.aiCount': "Nombre d'IA",
  'field.wildCount': 'Nations sauvages',
  'field.difficulty': "Difficulté de l'IA",
  'field.victory': 'Victoire %',
  'field.seed': 'Graine (optionnelle)',
  'field.seedPlaceholder': 'vide = aléatoire',
  'terrain.flat': 'Ouvert (sans eau)',
  'terrain.continents': 'Continents',
  'terrain.islands': 'Îles',
  'terrain.world': 'Monde (géo)',
  'terrain.europe': 'Europe (géo)',
  'terrain.africa': 'Afrique (géo)',
  'terrain.australia': 'Australie (géo)',
  'difficulty.easy': 'Facile',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Difficile',
  'play.start': 'Lancer la partie',
  'play.spectate': 'Observer',

  'settings.intro': "Affichage et fonctions optionnelles. S'appliquent à la prochaine partie.",
  'settings.display': 'Affichage',
  'field.camera': 'Caméra',
  'field.sound': 'Son',
  'toggle.on': 'oui',
  'toggle.off': 'non',
  'camera.tiles': 'Tuiles (comme avant)',
  'camera.period': 'Boîte (sans couture)',
  'camera.fixed': 'Boîte (fixe)',
  'camera.dynamic': 'Boîte dynamique',
  'settings.buildings': 'Bâtiments autorisés',
  'settings.buildings.body':
    'Les bâtiments désactivés ne peuvent être construits par personne dans la partie — pas même l’IA.',
  'settings.world': 'Monde',

  'mp.intro': 'Rejoins une partie ouverte ou crée ton propre salon.',
  'mp.openDialog': 'Créer un salon / rejoindre par code',
  'mp.reconnect': '⟳ Se reconnecter — salon {room}',

  'lobby.openTitle': 'Salons ouverts',
  'lobby.runningTitle': 'Parties en cours',
  'lobby.refresh': '↻ Actualiser',
  'lobby.emptyOpen': 'Aucun salon ouvert. Crées-en un via « Multijoueur ».',
  'lobby.emptyRunning': 'Aucune partie en cours.',
  'lobby.spectate': 'Observer',
  'lobby.unreachable': 'Serveur injoignable.',
  'lobby.loading': 'Chargement …',
  'lobby.players': 'joueurs',
  'lobby.spectators': 'spectateurs',

  'info.title': 'Astuces',
  'info.feedback': 'Retour / signaler un bug',
  'info.tip.1':
    'Les troupes croissent le plus vite autour de 42 % de ta limite — dépense-les en attaques plutôt que de les accumuler.',
  'info.tip.2':
    'Les usines rapportent de l’or par ville/port relié — et le triple pour les liens avec des nations étrangères.',
  'info.tip.3':
    'Maj+clic gauche attaque le long de toute la frontière ; Maj+molette ajuste finement la taille de l’attaque.',
  'info.tip.4':
    'Le monde est un tore : sortir à gauche te ramène à droite — utilise les bords pour déborder.',
  'info.tip.5':
    'Les navires de guerre bloquent les routes commerciales ennemies et saisissent la cargaison.',
  'info.tip.6': 'Un bug ou une idée ? Dis-le-nous via « Retour / signaler un bug ».',

  'changelog.openFull': 'Ouvrir le journal complet',
  'changelog.title': 'Nouveautés',
  'changelog.loading': 'Chargement des nouveautés …',
  'changelog.error': 'Impossible de charger le journal des modifications.',

  'help.title': 'Mécaniques du jeu',
  'help.intro':
    'territorial-loop est un RTS territorial en temps réel sur un monde sans bords : sortir à ' +
    'gauche te ramène à droite (un tore). Le but est de dominer une grande partie de la carte.',

  'help.goal.title': 'But',
  'help.goal.body':
    'Conquiers du territoire jusqu’à détenir la part de la carte fixée pour la partie (victoire %). ' +
    'Si tu perds tout ton territoire, tu es éliminé.',

  'help.expansion.title': 'S’étendre et attaquer',
  'help.expansion.body':
    'Le curseur fixe combien de troupes reçoit une attaque. Cliquer sur une terre neutre t’étend ; ' +
    'cliquer sur une nation attaque le long de la frontière. Un avantage de 2:1 suffit pour une ' +
    'prise totale ; les fronts équilibrés deviennent tenaces. Les troupes croissent jusqu’à une ' +
    'limite qui monte avec ton territoire.',

  'help.buildings.title': 'Bâtiments',
  'help.buildings.body':
    'Avec de l’or tu bâtis Ville (plus de limite de troupes), Poste de défense (bonus + portée ' +
    'contre les attaques), Port (commerce et navires) et Usine (économie). Améliorables ; à la ' +
    'conquête, le nouveau propriétaire les garde — sauf les postes de défense.',

  'help.economy.title': 'Économie (réseaux d’usines)',
  'help.economy.body':
    'L’or ne vient pas de la taille du territoire mais des usines : une usine se relie à vue à tes ' +
    'villes/ports/usines à portée et produit de l’or par cible reliée. Les liens avec des nations ' +
    'étrangères rapportent 3× d’or (et de la faveur) — coopérer paie. Construis Ville + Port + Usine ' +
    'proches et relie-les.',

  'help.ships.title': 'Navires et commerce',
  'help.ships.body':
    'Les barges de transport amènent des troupes par l’eau vers d’autres îles/flancs (rappelables). ' +
    'Les navires marchands font la navette entre ports et rapportent de l’or aux deux propriétaires. ' +
    'Les navires de guerre patrouillent, bloquent/pillent les marchands ennemis et se combattent.',

  'help.diplomacy.title': 'Diplomatie',
  'help.diplomacy.body':
    'Tu peux former des alliances (les alliés ne s’attaquent pas et partagent la faveur) et imposer ' +
    'des embargos. Les alliances expirent d’elles-mêmes. Tout cela se gère via le menu radial du ' +
    'clic droit.',

  'help.treason.title': 'Trahison',
  'help.treason.body':
    'Attaquer un allié est une trahison : l’alliance se brise et tu es proscrit un temps — les ' +
    'autres t’infligent alors 1,5× de dégâts. Le jeu demande confirmation avant une telle attaque.',

  'help.relations.title': 'Relations (rancune et faveur)',
  'help.relations.body':
    'La guerre navale et les embargos créent de la rancune ; le commerce et le voisinage d’usines ' +
    'créent de la faveur. Les deux s’estompent avec le temps, teintent les frontières (rouge/vert) ' +
    'et guident qui l’IA attaque ou épargne.',

  'help.wild.title': 'Nations sauvages',
  'help.wild.body':
    'Les nations sauvages sont passives : elles s’étendent dans les terres sauvages, attaquent avec ' +
    'retenue, ne construisent pas et ont une limite plus basse — un tampon conquérable et du butin.',

  'help.camera.title': 'Monde et caméra',
  'help.camera.body':
    'La carte est un tore (sans bord). La molette zoome, le glissement ou WASD déplace la caméra. ' +
    'Le style (tuiles / boîte) se règle dans les Réglages.',

  'help.controls.title': 'Commandes',
  'help.controls.body':
    'Clic gauche : attaquer/s’étendre · Maj+clic gauche : tout autour de la frontière · ' +
    'Maj+molette : ajuster la taille de l’attaque · Clic droit : menu radial (construire/barge/' +
    'navire/diplomatie) · 1–4 : bâtiments · B : mode barge · R : portées des navires · Espace : ' +
    'pause · Échap : menu.',

  'help.growth.title': 'Croissance des troupes',
  'help.growth.body':
    'Chaque nation a une limite de troupes qui monte avec ton nombre de cases (de façon sous-' +
    'linéaire — deux fois plus de terre ≠ deux fois la limite). La croissance par seconde n’est pas ' +
    'constante : près de 0 tu croîs lentement, le plus vite à réserve moyenne, et plus tu approches ' +
    'de la limite plus ça freine. L’optimum est autour de 42 % de la limite. Dépenser des troupes en ' +
    'attaques te garde dans la zone de forte croissance ; accumuler près de la limite l’arrête presque.',

  // ── Journal des événements ─────────────────────────────────────────────────
  'event.allianceExpired': 'L’alliance entre {a} et {b} a expiré',
  'event.breakTraitor': '{a} rompt l’alliance avec le traître {b}',
  'event.betray': '{a} trahit {b} !',
  'event.allied': '{a} et {b} sont alliés',
  'event.allianceOffer': '{a} propose une alliance à {b}',
  'event.allianceDecline': '{a} refuse l’alliance de {b}',
  'event.embargoOn': '{a} impose un embargo à {b}',
  'event.embargoOff': '{a} lève l’embargo sur {b}',
  'event.tradeMode.random': 'Cibles commerciales : aléatoire',
  'event.tradeMode.nearest': 'Cibles commerciales : la plus proche',
  'event.tradeMode.farthest': 'Cibles commerciales : la plus lointaine',
  'event.tradeMode.allies': 'Cibles commerciales : alliés uniquement',
  'event.warshipNeutralSpare': 'Navires : épargner les neutres',
  'event.warshipNeutralAll': 'Navires : attaquer tout le monde',
  'event.warshipHold': '{p} : les navires tiennent position et se soignent',
  'event.warshipPatrol': '{p} : les navires patrouillent',
  'event.warshipLimit': '{p} : limite de navires atteinte',
  'event.warshipNoGold': '{p} : pas assez d’or pour un navire de guerre',
  'event.warshipNoRoute': '{p} : aucun port avec une route maritime vers la cible',
  'event.noCoast': '{p} : pas de côte à toi — conquiers d’abord une terre au bord de l’eau',
  'event.noWaterway': '{p} : aucune route maritime vers cette cible',
  'event.boatAttack': '⚠ {player} attaque {defender} avec une barge de transport',
  'event.boatSent': '{p} envoie une barge de transport',
  'event.boatLand': '{p} débarque des troupes',
  'event.defend': '{p} repousse l’attaque de {attacker}',
  'event.warshipSent': '{p} envoie un navire de guerre',
  'event.boatSunk': 'Barge de transport de {p} coulée',
  'event.tradeBlocked': 'Navire marchand bloqué',
  'event.warshipSunk': 'Navire de guerre de {p} coulé',
  'event.eliminated': '{p} a été éliminé',
  'event.victory': '{p} a gagné la partie !',
  'event.loot': '{p} pille {amount} d’or à {from}',
  'event.lootWild': '{p} pille {amount} d’or dans les terres sauvages',
  'event.annex': '{p} encercle une nation sauvage et l’annexe',
  'event.annexLoot': '{p} encercle une nation sauvage et l’annexe (+{amount} d’or)',
  'event.annexFragment': '{p} engloutit le territoire encerclé de {victim}',
  'event.annexFragmentLoot': '{p} engloutit le territoire encerclé de {victim} (+{amount} d’or)',

  // ── HUD ──────────────────────────────────────────────────────────────────────
  'hud.tooltip.city': 'Ville — +{cap} de troupes max par niveau.',
  'hud.tooltip.defense':
    'Poste de défense — dans un rayon de {range} (+{per}/niveau), la conquête coûte jusqu’à {mult}× plus cher.',
  'hud.tooltip.port':
    'Port — nécessaire aux navires de transport et de commerce (constructible seulement sur l’eau).',
  'hud.tooltip.factory':
    'Usine — se relie à vue à tes villes/ports/usines et produit de l’or par ville/port connecté.',
  'hud.tooltip.airport':
    'Aéroport — lance des bombardiers sur une cible (or par lancement). Recharge {cooldown}s, baisse par niveau.',
  'hud.tooltip.flak':
    'DCA — abat les bombardiers ennemis dans un rayon de {range} (+{per}/niveau).',
  'hud.controls': 'Commandes',
  'hud.controlsBody':
    'Clic gauche : attaque · B : mode bateau (cible sur une autre île)<br/>Clic droit : menu (construire/attaque/bateau/navire/diplomatie)<br/>Glisser (gauche/droite) ou WASD : caméra · Molette : zoom<br/>1–6 : bâtiments (ville/défense/port/usine/aéroport/DCA) · R : portées des navires · Espace : pause<br/>, / . : vitesse · Échap : menu<br/>Clic sur le panneau d’attaque : annuler / bateau · navire retour',
  'hud.rank': 'Classement',
  'hud.troops': 'Troupes',
  'hud.gold': 'Or',
  'hud.boat': 'Bateau de transport',
  'hud.boatHintShort': 'cible sur une autre île',
  'hud.boatModeHint':
    'Mode bateau : clique une cible côtière sur une autre masse de terre · Échap quitte',
  'hud.attack': 'Attaque : {pct}%',
  'hud.newMatch': 'Nouvelle partie',
  'hud.pauseOverlay': 'PAUSE',
  'hud.pause': 'Pause',
  'hud.inCombat': 'au combat {n}',
  'hud.ecoNote': '{factories} usine(s) · {dests} cibles',
  'hud.ecoBase': 'Or de base',
  'hud.ecoFactory': 'Réseau d’usines',
  'hud.ecoTrade': 'Commerce',
  'hud.ecoSum': 'Total',
  'hud.wilderness': 'Étendue sauvage',
  'hud.cancelling': 'annulation…',
  'hud.cancelNow': 'Annuler immédiatement',
  'hud.cancelAttack': 'Annuler l’attaque (~2,5 s de repli)',
  'hud.returning': 'fait demi-tour',
  'hud.enRoute': 'en route',
  'hud.recallBoat': 'Rappeler le bateau',
  'hud.recallWarship': 'Rappeler le navire',
  'hud.defendTitle': 'Défendre — engager les troupes 1:1 (poussée du curseur)',
  'hud.defendWith': 'Défendre avec {troops} troupes',
  'hud.jumpToBattle': 'Aller à l’attaque',
  'hud.attacks': 'Attaques',
  'hud.traitorTitle': 'Traître — hors-la-loi, défense affaiblie ({time} restant)',
  'hud.alliedTitle': 'Allié · expire dans {time}',
  'hud.less': 'Moins ▴',
  'hud.showAll': 'Afficher les {n} ▾ (+{hidden})',
  'hud.running': 'en cours',
  'hud.ended': 'terminée · vainqueur {winner}',
  'hud.time': 'Temps',
  'hud.traitorBanner':
    'Tu es hors-la-loi — tout le monde t’inflige 1,5× de dégâts ({time} restant)',
  'hud.victory': 'Victoire',
  'hud.matchDuration': 'Durée {time} · la partie continue',
  'hud.colPlayer': 'Joueur',
  'hud.colPeakPct': 'Max %',
  'hud.colPeakTroops': 'Troupes max',

  // ── Noms des bâtiments ────────────────────────────────────────────────────────
  'building.city': 'Ville',
  'building.defense': 'Défense',
  'building.port': 'Port',
  'building.factory': 'Usine',
  'building.airport': 'Aéroport',
  'building.flak': 'DCA',

  // ── Menu radial ───────────────────────────────────────────────────────────────
  'menu.chooseAction': 'Choisir une action',
  'menu.hint.city': '+{cap} de limite de troupes/niveau',
  'menu.hint.defense': 'conquête jusqu’à {mult}× plus chère',
  'menu.hint.port': 'prérequis pour les navires',
  'menu.hint.factory': 'or via le réseau (villes/ports à portée)',
  'menu.hint.airport': 'lance des bombardiers sur une cible (or par lancement)',
  'menu.hint.flak': 'abat les bombardiers ennemis de passage',
  'menu.breakAlliance': 'Rompre l’alliance',
  'menu.breakAllianceDetail': 'trahison → proscrit · expire dans {time}',
  'menu.acceptAlliance': 'Accepter l’alliance',
  'menu.acceptAllianceDetail': 'propose une alliance',
  'menu.requestSent': 'Demande envoyée …',
  'menu.requestSentDetail': 'en attente de réponse',
  'menu.requestAlliance': 'Demander une alliance',
  'menu.requestAllianceDetail': 'proposer une alliance',
  'menu.embargoLift': 'Lever l’embargo',
  'menu.embargoImpose': 'Imposer un embargo',
  'menu.embargoLiftDetail': 'autoriser de nouveau le commerce',
  'menu.embargoImposeDetail': 'arrête le commerce',
  'menu.tradeAllowAll': 'Autoriser de nouveau le commerce',
  'menu.tradeStopAll': 'Stopper le commerce avec tous',
  'menu.tradeAllowAllDetail': 'lève tous les embargos — ports et usines commercent de nouveau',
  'menu.tradeStopAllDetail':
    'embargo contre tous — stoppe les navires marchands et les liens étrangers des usines',
  'menu.maxLevel': 'Niveau maximum',
  'menu.upgrade': 'Améliorer → L{level}',
  'menu.warshipHoldLabel': 'Navires : tenir et soigner',
  'menu.warshipPingPong': 'Navires : ping-pong',
  'menu.warshipModeDetail': 'basculer — vaut pour tous tes navires',
  'menu.trade.random': 'Commerce : aléatoire',
  'menu.trade.nearest': 'Commerce : le plus proche',
  'menu.trade.farthest': 'Commerce : le plus loin',
  'menu.trade.allies': 'Commerce : alliés seulement',
  'menu.tradeNext': 'Clic → {next}',
  'menu.warshipSpare': 'Navires : épargner les neutres',
  'menu.warshipAttackAll': 'Navires : attaquer tous',
  'menu.warshipNeutralDetail': 'basculer — épargner les marchands neutres ?',
  'menu.goldTitle': 'Or : {gold}',
  'menu.water': 'Eau',
  'menu.warship': 'Navire de guerre',
  'menu.warshipHasPort': 'patrouille et bloque le commerce ennemi',
  'menu.warshipNoPort': 'port requis (lancé depuis le port)',
  'menu.bomber': 'Lancer un bombardier',
  'menu.bomberDetail':
    'Bombarde la cible — détruit bâtiments, troupes et territoire dans le rayon de l’explosion',
  'menu.bomberCooldown': 'l’aérodrome recharge encore',
  'menu.attack': 'Attaque',
  'menu.attackDetail': '{n} troupes au front',
  'menu.boatDetail': '{n} troupes par l’eau',

  // ── Info-bulle ────────────────────────────────────────────────────────────────
  'tip.effect.city': '+{cap} de limite de troupes',
  'tip.effect.defense': '{mult}× coût de conquête · portée {range} tuiles',
  'tip.effect.port': 'navires et commerce · compte comme cible de réseau',
  'tip.effect.factory': 'or de réseau · portée {range} tuiles',
  'tip.effect.airport': 'lancement de bombardiers · recharge {cooldown}s',
  'tip.effect.flak': 'DCA · portée {range} tuiles',
  'tip.upgrade.defense': 'portée {range} tuiles',
  'tip.upgrade.airport': 'recharge {cooldown}s',
  'tip.upgrade.flak': 'portée {range} tuiles',
  'tip.dests': '{n} cibles',
  'tip.tradeShip': 'Navire marchand',
  'tip.warship': 'Navire de guerre',
  'tip.you': 'Toi',
  'tip.underConstruction': 'en construction',
  'tip.lvl': 'Niv.',
  'tip.neutralLand': 'terre neutre',
  'tip.perTile': '~{n}/tuile',
  'tip.allied': 'Allié · {time} restant',
  'tip.grudge': 'Rancune {n}',
  'tip.favor': 'Faveur {n}',
  'tip.traitor': 'Traître — proscrit (défense affaiblie)',
  'tip.loot': 'butin à la conquête ~{gold}',

  // ── Dialogues ────────────────────────────────────────────────────────────────
  'confirm.leave': 'Quitter',
  'confirm.keepPlaying': 'Continuer',
  'confirm.leaveRound': 'Quitter la partie en cours ?',
  'confirm.treason':
    '{ally} est ton allié. Une attaque est une TRAHISON : l’alliance se brise, tu deviens proscrit et subis 1,5× de dégâts de tous pendant un temps. Attaquer quand même ?',
  'loading.map': 'Génération de la carte …',

  // ── Dialogue de retour ───────────────────────────────────────────────────────
  'feedback.triggerTitle': 'Donner un retour ou signaler un bug',
  'feedback.title': 'Retour / signaler un bug',
  'feedback.kindFeedback': 'Retour',
  'feedback.kindBug': 'Bug',
  'feedback.placeholder': 'Qu’as-tu en tête ? (idée, compliment, bug …)',
  'feedback.send': 'Envoyer',
  'feedback.cancel': 'Annuler',
  'feedback.empty': 'Saisis quelque chose, s’il te plaît.',
  'feedback.sending': 'Envoi …',
  'feedback.thanks': 'Merci !',
  'feedback.error': 'Échec de l’envoi (serveur joignable ?).',

  // ── Salon multijoueur ────────────────────────────────────────────────────────
  'mp.formTitle': 'Multijoueur — territorial-loop',
  'mp.namePlaceholder': 'Toi',
  'mp.room': 'Salon',
  'mp.roomPlaceholder': 'vide = nouveau salon',
  'mp.connect': 'Se connecter',
  'mp.noUrl': 'Saisis une URL de serveur.',
  'mp.back': 'Retour',
  'mp.connecting': 'Connexion …',
  'mp.timeout':
    'Pas de connexion (délai dépassé). Le dev server (npm run dev) ou npm run server tourne-t-il ?',
  'mp.lobbyTitle': 'Salon',
  'mp.roomCode': 'Code du salon',
  'mp.copy': 'Copier',
  'mp.copied': 'Copié',
  'mp.you': 'toi',
  'mp.ready': 'prêt',
  'mp.waiting': 'en attente …',
  'mp.disconnected': 'déconnecté',
  'mp.waitingPeers': 'En attente de participants …',
  'mp.readyBtn': 'Prêt',
  'mp.matchHost': 'Partie (tu es l’hôte)',
  'mp.matchGuest': 'Partie (définie par l’hôte)',
  'mp.public': 'listée dans le navigateur de serveurs',
  'mp.private': 'privée (code/lien seulement)',
  'mp.map': 'Carte',
  'mp.terrain': 'Terrain',
  'mp.terrainFlat': 'Ouvert',
  'mp.ai': 'IA',
  'mp.wild': 'Sauvages',
  'mp.difficulty': 'Force de l’IA',
  'mp.visible': 'Visible',
  'uiscale.title': 'Taille de l’interface',
  'nation.wild': 'sauvage',
  'hud.resync': 'Resynchronisation …',
  'log.diplomacy': 'Diplomatie',
  'log.war': 'Guerre',
  'log.economy': 'Économie',
  'prompt.offersAlliance': 'propose une alliance',
  'prompt.accept': 'Accepter',
  'prompt.decline': 'Refuser',
  'prompt.ignore': 'Ignorer',
  'field.rivers': 'Rivières',
  'field.rivers.hint': 'continents/îles seulement, navigables',
}
