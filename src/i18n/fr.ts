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
  'settings.experimental': 'Expérimental',
  'settings.experimental.body':
    'Les fonctions optionnelles à essayer apparaîtront ici sous forme de boutons — forêts, ' +
    'rivières, poissons, bruit type terrestre… Rien d’actif pour l’instant.',

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
  'event.annex': '{p} encercle {wild} et l’annexe',
  'event.annexLoot': '{p} encercle {wild} et l’annexe (+{amount} d’or)',
}
