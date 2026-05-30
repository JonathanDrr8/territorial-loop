/** English strings (ADR-0014). Missing keys fall back to German (`de`). */
export const en: Record<string, string> = {
  'app.tagline': 'Browser RTS on an edgeless world',

  'nav.play': 'Play',
  'nav.multiplayer': 'Multiplayer',
  'nav.settings': 'Settings',
  'nav.changelog': 'Changelog',
  'nav.help': 'Help',

  'header.name': 'Name',
  'header.namePlaceholder': 'Your name',
  'footer.feedback': 'Feedback',
  'footer.sourcecode': 'Source',
  'lang.label': 'Language',

  // ── Tab "Play" (match setup) ───────────────────────────────────────────────
  'section.world': 'World',
  'section.opponents': 'Opponents',
  'section.match': 'Match',
  'field.map': 'Map (W × H)',
  'field.terrain': 'Map type',
  'field.aiCount': 'AI count',
  'field.wildCount': 'Wild nations',
  'field.difficulty': 'AI difficulty',
  'field.victory': 'Victory %',
  'field.seed': 'Seed (optional)',
  'field.seedPlaceholder': 'empty = random',
  'terrain.flat': 'Open (no water)',
  'terrain.continents': 'Continents',
  'terrain.islands': 'Islands',
  'terrain.world': 'World (geo)',
  'terrain.europe': 'Europe (geo)',
  'terrain.africa': 'Africa (geo)',
  'terrain.australia': 'Australia (geo)',
  'difficulty.easy': 'Easy',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Hard',
  'play.start': 'Start match',
  'play.spectate': 'Spectate',

  // ── Tab "Settings" ─────────────────────────────────────────────────────────
  'settings.intro': 'Display & optional features. They apply to the next match.',
  'settings.display': 'Display',
  'field.camera': 'Camera',
  'field.sound': 'Sound',
  'toggle.on': 'on',
  'toggle.off': 'off',
  'camera.tiles': 'Tiles (as before)',
  'camera.period': 'Box (seamless)',
  'camera.fixed': 'Box (fixed)',
  'camera.dynamic': 'Dynamic box',
  'settings.buildings': 'Allowed buildings',
  'settings.buildings.body':
    'Disabled buildings cannot be built by anyone in the match — not even the AI.',
  'settings.world': 'World',

  // ── Tab "Multiplayer" ──────────────────────────────────────────────────────
  'mp.intro': 'Join an open game or create your own lobby.',
  'mp.openDialog': 'Create lobby / join by code',
  'mp.reconnect': '⟳ Reconnect — room {room}',

  // Lobby browser (open lobbies + live games)
  'lobby.openTitle': 'Open lobbies',
  'lobby.runningTitle': 'Live games',
  'lobby.refresh': '↻ Refresh',
  'lobby.emptyOpen': 'No open lobbies. Start one via "Multiplayer".',
  'lobby.emptyRunning': 'No live games right now.',
  'lobby.spectate': 'Watch',
  'lobby.unreachable': 'Server unreachable.',
  'lobby.loading': 'Loading …',
  'lobby.players': 'players',
  'lobby.spectators': 'watching',

  // Tips / info area (landing page, right column)
  'info.title': 'Tips & tricks',
  'info.feedback': 'Feedback / report a bug',
  'info.tip.1':
    'Troops grow fastest at around 42 % of your cap — spend them on attacks instead of hoarding.',
  'info.tip.2':
    'Factories produce gold per linked city/port — and triple for links to foreign nations.',
  'info.tip.3':
    'Shift+left-click attacks along the whole border; Shift+wheel fine-tunes the attack size.',
  'info.tip.4':
    'The world is a torus: leaving on the left brings you back on the right — use the edges to flank.',
  'info.tip.5': 'Warships blockade enemy trade routes and seize the cargo.',
  'info.tip.6': 'Found a bug or have an idea? Tell us via "Feedback / report a bug".',

  'changelog.openFull': 'Open full changelog',

  'changelog.title': "What's new",
  'changelog.loading': 'Loading changelog …',
  'changelog.error': 'Could not load the changelog.',

  // ── Help: game mechanics ───────────────────────────────────────────────────
  'help.title': 'Game mechanics',
  'help.intro':
    'territorial-loop is a real-time territorial RTS on a world without edges: ' +
    'leaving on the left brings you back on the right (a torus). The goal is to control a large share of the map.',

  'help.goal.title': 'Goal',
  'help.goal.body':
    'Conquer territory until you hold the share of the map set for the match (victory %). ' +
    'Lose all your territory and you are out.',

  'help.expansion.title': 'Expanding & attacking',
  'help.expansion.body':
    'The slider sets how many troops an attack gets. Clicking neutral land expands you; clicking ' +
    'a nation attacks along the border. A 2:1 advantage is enough to take everything; evenly ' +
    'matched fronts get grindy. Troops grow up to a cap that rises with your territory.',

  'help.buildings.title': 'Buildings',
  'help.buildings.body':
    'Spend gold on a City (higher troop cap), Defense post (bonus + range against attacks), Port ' +
    '(trade & ships) and Factory (economy). Buildings are upgradeable; on conquest the new owner ' +
    'keeps them — except defense posts.',

  'help.economy.title': 'Economy (factory networks)',
  'help.economy.body':
    'Gold does not come from territory size but from factories: a factory links by line-of-sight ' +
    'to your cities/ports/factories in range and produces gold per linked target. Links to foreign ' +
    'nations yield 3× gold (and goodwill) — cooperation pays off. So build City + Port + Factory ' +
    'close together and network them.',

  'help.ships.title': 'Ships & trade',
  'help.ships.body':
    'Transport boats carry troops over water to other islands/flanks (recallable). Trade ships ' +
    'shuttle between ports and pay gold to both owners. Warships patrol, blockade/loot enemy trade ' +
    'ships and fight each other.',

  'help.diplomacy.title': 'Diplomacy',
  'help.diplomacy.body':
    'You can form alliances (allies do not attack each other and share goodwill) and impose ' +
    'embargoes. Alliances expire automatically. Use the right-click radial menu for all of this.',

  'help.treason.title': 'Treason',
  'help.treason.body':
    'Attacking an ally is treason: the alliance breaks and you are outlawed for a while — everyone ' +
    'else then deals 1.5× damage to you. The game asks for confirmation before such an attack.',

  'help.relations.title': 'Relations (grudge & goodwill)',
  'help.relations.body':
    'Naval war and embargoes build grudge; trade and factory neighbourhood build goodwill. Both ' +
    'fade over time, tint the borders (red/green) and steer who the AI attacks or spares.',

  'help.wild.title': 'Wild nations',
  'help.wild.body':
    'Wild nations are passive: they spread into the wilderness, attack only hesitantly, do not ' +
    'build and have a smaller cap — a conquerable buffer and loot.',

  'help.camera.title': 'World & camera',
  'help.camera.body':
    'The map is a torus (no edge). Zoom with the mouse wheel, move the camera by dragging or with ' +
    'WASD. Choose the display style (tiles / box) in Settings.',

  'help.controls.title': 'Controls',
  'help.controls.body':
    'Left-click: attack/expand · Shift+left-click: all around along the whole border · ' +
    'Shift+wheel: fine-tune attack size · Right-click: radial menu (build/boat/warship/diplomacy) · ' +
    '1–4: buildings · B: boat mode · R: ship ranges · Space: pause · Esc: menu.',

  'help.growth.title': 'Troop growth',
  'help.growth.body':
    'Each nation has a troop cap that rises with your tile count (sublinearly — twice the land ≠ ' +
    'twice the cap). Growth per second is not constant: near 0 troops you grow slowly, fastest at a ' +
    'medium stock, and the closer to the cap the more it brakes. The optimum is around 42 % of the ' +
    'cap. Spending troops on attacks keeps you in the high-growth zone; hoarding near the cap nearly ' +
    'stalls growth.',

  // ── Event log ──────────────────────────────────────────────────────────────
  'event.allianceExpired': 'Alliance between {a} and {b} expired',
  'event.breakTraitor': '{a} ends the alliance with traitor {b}',
  'event.betray': '{a} betrays {b}!',
  'event.allied': '{a} and {b} are allied',
  'event.allianceOffer': '{a} offers {b} an alliance',
  'event.allianceDecline': '{a} declines {b}’s alliance',
  'event.embargoOn': '{a} imposes an embargo on {b}',
  'event.embargoOff': '{a} lifts the embargo on {b}',
  'event.tradeMode.random': 'Trade targets: random',
  'event.tradeMode.nearest': 'Trade targets: nearest',
  'event.tradeMode.farthest': 'Trade targets: farthest',
  'event.tradeMode.allies': 'Trade targets: allies only',
  'event.warshipNeutralSpare': 'Warships: spare neutrals',
  'event.warshipNeutralAll': 'Warships: attack all',
  'event.warshipHold': '{p}: warships hold & heal',
  'event.warshipPatrol': '{p}: warships patrol',
  'event.warshipLimit': '{p}: warship limit reached',
  'event.warshipNoGold': '{p}: not enough gold for a warship',
  'event.warshipNoRoute': '{p}: no port with a sea route to the target',
  'event.noCoast': '{p}: no coast of your own — conquer land by water first',
  'event.noWaterway': '{p}: no sea route to this target',
  'event.boatAttack': '⚠ {defender} is being attacked by {player} via transport boat',
  'event.boatSent': '{p} sends a transport boat',
  'event.boatLand': '{p} lands troops',
  'event.defend': '{p} fends off the attack from {attacker}',
  'event.warshipSent': '{p} sends out a warship',
  'event.boatSunk': 'Transport boat of {p} sunk',
  'event.tradeBlocked': 'Trade ship blocked',
  'event.warshipSunk': 'Warship of {p} sunk',
  'event.eliminated': '{p} was eliminated',
  'event.victory': '{p} has won the match!',
  'event.loot': '{p} loots {amount} gold from {from}',
  'event.lootWild': '{p} loots {amount} gold from the wilds',
  'event.annex': '{p} surrounds a wild nation and annexes it',
  'event.annexLoot': '{p} surrounds a wild nation and annexes it (+{amount} gold)',
  'event.annexFragment': '{p} swallows enclosed land of {victim}',
  'event.annexFragmentLoot': '{p} swallows enclosed land of {victim} (+{amount} gold)',

  // ── HUD ──────────────────────────────────────────────────────────────────────
  'hud.tooltip.city': 'City — +{cap} max troops per level.',
  'hud.tooltip.defense':
    'Defense post — within range {range} (+{per}/level) conquest costs up to {mult}× more.',
  'hud.tooltip.port': 'Port — needed for transport & trade ships (only buildable on water).',
  'hud.tooltip.factory':
    'Factory — links by line of sight to your own cities/ports/factories and produces gold per connected city/port.',
  'hud.tooltip.airport':
    'Airport — hangar for {slots} plane per level; launches bombers (buy plane + ammo per drop).',
  'hud.tooltip.flak': 'Anti-air — shoots down enemy bombers within range {range} (+{per}/level).',
  'hud.controls': 'Controls',
  'hud.controlsBody':
    'Left click: attack · B: boat mode (target on another island) · 7: bomber mode · 8: warship<br/>Right click: menu (build/attack/boat/warship/diplomacy)<br/>Drag (left/right) or WASD: camera · Wheel: zoom<br/>1–6: buildings (city/defense/port/factory/airport/anti-air) · R: ship ranges · Space: pause<br/>, / . : speed · Esc: menu<br/>Click attack panel: cancel / boat · ship back',
  'hud.rank': 'Ranking',
  'hud.troops': 'Troops',
  'hud.gold': 'Gold',
  'hud.boat': 'Transport boat',
  'hud.bomber': 'Bomber',
  'hud.warship': 'Warship',
  'hud.boatHintShort': 'target on another island',
  'hud.boatModeHint': 'Boat mode: click a coastal target on another landmass · Esc ends',
  'route.direct': 'direct',
  'route.arc-left': 'arc left',
  'route.arc-right': 'arc right',
  'hud.bomberModeHint':
    'Bomber mode · Route: {route} · Shift+wheel switches · Click = target · Esc ends',
  'hud.bomberWarnShot': 'Will be shot down!',
  'hud.warshipModeHint': 'Warship mode: click a water target (needs a port + gold) · Esc ends',
  'hud.attack': 'Attack: {pct}%',
  'hud.newMatch': 'New match',
  'hud.pauseOverlay': 'PAUSED',
  'hud.pause': 'Pause',
  'hud.inCombat': 'in combat {n}',
  'hud.ecoNote': '{factories} factory(ies) · {dests} targets',
  'hud.ecoBase': 'Base gold',
  'hud.ecoFactory': 'Factory network',
  'hud.ecoTrade': 'Trade',
  'hud.ecoSum': 'Total',
  'hud.wilderness': 'Wilderness',
  'hud.cancelling': 'cancelling…',
  'hud.cancelNow': 'Cancel immediately',
  'hud.cancelAttack': 'Cancel attack (~2.5s retreat)',
  'hud.returning': 'returning',
  'hud.enRoute': 'en route',
  'hud.recallBoat': 'Recall boat',
  'hud.recallWarship': 'Recall warship',
  'hud.defendTitle': 'Defend — commit troops 1:1 (slider boost)',
  'hud.defendWith': 'Defend with {troops} troops',
  'hud.jumpToBattle': 'Jump to the attack',
  'hud.attacks': 'Attacks',
  'hud.traitorTitle': 'Traitor — outlawed, weakened defense ({time} left)',
  'hud.alliedTitle': 'Allied · expires in {time}',
  'hud.less': 'Less ▴',
  'hud.showAll': 'Show all {n} ▾ (+{hidden})',
  'hud.running': 'running',
  'hud.ended': 'ended · winner {winner}',
  'hud.time': 'Time',
  'hud.traitorBanner': 'You are outlawed — everyone deals you 1.5× damage ({time} left)',
  'hud.victory': 'Victory',
  'hud.matchDuration': 'Duration {time} · match continues',
  'hud.colPlayer': 'Player',
  'hud.colPeakPct': 'Peak %',
  'hud.colPeakTroops': 'Peak troops',

  // ── Building names ────────────────────────────────────────────────────────────
  'building.city': 'City',
  'building.defense': 'Defense',
  'building.port': 'Port',
  'building.factory': 'Factory',
  'building.airport': 'Airport',
  'building.flak': 'Anti-air',

  // ── Radial menu ───────────────────────────────────────────────────────────────
  'menu.chooseAction': 'Choose an action',
  'menu.hint.city': '+{cap} troop cap/level',
  'menu.hint.defense': 'conquest up to {mult}× costlier',
  'menu.hint.port': 'prerequisite for ships',
  'menu.hint.factory': 'gold via network (cities/ports in range)',
  'menu.hint.airport': 'launches bombers at a target (gold per launch)',
  'menu.hint.flak': 'shoots down enemy bombers flying past',
  'menu.breakAlliance': 'Break alliance',
  'menu.breakAllianceDetail': 'betrayal → outlawed · expires in {time}',
  'menu.acceptAlliance': 'Accept alliance',
  'menu.acceptAllianceDetail': 'offers an alliance',
  'menu.requestSent': 'Request sent …',
  'menu.requestSentDetail': 'awaiting reply',
  'menu.requestAlliance': 'Request alliance',
  'menu.requestAllianceDetail': 'propose an alliance',
  'menu.embargoLift': 'Lift embargo',
  'menu.embargoImpose': 'Impose embargo',
  'menu.embargoLiftDetail': 'allow trade again',
  'menu.embargoImposeDetail': 'stops trade',
  'menu.tradeAllowAll': 'Allow trade again',
  'menu.tradeStopAll': 'Stop trade with everyone',
  'menu.tradeAllowAllDetail': 'lifts all embargoes — ports & factories trade again',
  'menu.tradeStopAllDetail': 'embargo on everyone — stops trade ships & factory foreign links',
  'menu.maxLevel': 'Maximum level',
  'menu.upgrade': 'Upgrade → L{level}',
  'menu.warshipHoldLabel': 'Ships: hold & heal',
  'menu.warshipPingPong': 'Ships: ping-pong',
  'menu.warshipModeDetail': 'toggle — applies to all your warships',
  'menu.trade.random': 'Trade: random',
  'menu.trade.nearest': 'Trade: nearest',
  'menu.trade.farthest': 'Trade: farthest',
  'menu.trade.allies': 'Trade: allies only',
  'menu.tradeNext': 'Click → {next}',
  'menu.warshipSpare': 'Ships: spare neutrals',
  'menu.warshipAttackAll': 'Ships: attack all',
  'menu.warshipNeutralDetail': 'toggle — spare neutral trade ships?',
  'menu.goldTitle': 'Gold: {gold}',
  'menu.water': 'Water',
  'menu.warship': 'Warship',
  'menu.warshipHasPort': 'patrols & blocks enemy trade',
  'menu.warshipNoPort': 'port needed (launched from port)',
  'menu.bomber': 'Launch bomber',
  'menu.bomberDetail':
    'Bomb the target — destroys buildings, troops and territory in the blast radius',
  'menu.bomberCooldown': 'airfield still reloading',
  'menu.bomberFull': 'hangar full or no plane',
  'menu.attack': 'Attack',
  'menu.attackDetail': '{n} troops to the front',
  'menu.boatDetail': '{n} troops across the water',

  // ── Hover tooltip ────────────────────────────────────────────────────────────
  'tip.effect.city': '+{cap} troop cap',
  'tip.effect.defense': '{mult}× conquest cost · range {range} tiles',
  'tip.effect.port': 'ships & trade · counts as a network target',
  'tip.effect.factory': 'network gold · range {range} tiles',
  'tip.effect.airport': 'hangar · {slots} plane slots',
  'tip.effect.flak': 'anti-air · range {range} tiles',
  'tip.upgrade.defense': 'range {range} tiles',
  'tip.upgrade.airport': 'hangar {slots} slots',
  'tip.upgrade.flak': 'range {range} tiles',
  'tip.dests': '{n} targets',
  'tip.tradeShip': 'Trade ship',
  'tip.warship': 'Warship',
  'tip.you': 'You',
  'tip.underConstruction': 'under construction',
  'tip.lvl': 'Lvl',
  'tip.neutralLand': 'neutral land',
  'tip.perTile': '~{n}/tile',
  'tip.allied': 'Allied · {time} left',
  'tip.grudge': 'Grudge {n}',
  'tip.favor': 'Favor {n}',
  'tip.traitor': 'Traitor — outlawed (weakened defense)',
  'tip.loot': 'loot on conquest ~{gold}',

  // ── Dialogs ──────────────────────────────────────────────────────────────────
  'confirm.leave': 'Leave',
  'confirm.keepPlaying': 'Keep playing',
  'confirm.leaveRound': 'Leave the current round?',
  'confirm.treason':
    '{ally} is allied with you. An attack is TREASON: the alliance breaks, you become outlawed and take 1.5× damage from everyone for a while. Attack anyway?',
  'loading.map': 'Generating map …',

  // ── Feedback dialog ──────────────────────────────────────────────────────────
  'feedback.triggerTitle': 'Give feedback or report a bug',
  'feedback.title': 'Feedback / report a bug',
  'feedback.kindFeedback': 'Feedback',
  'feedback.kindBug': 'Bug',
  'feedback.placeholder': 'What’s on your mind? (idea, praise, bug …)',
  'feedback.send': 'Send',
  'feedback.cancel': 'Cancel',
  'feedback.empty': 'Please type something.',
  'feedback.sending': 'Sending …',
  'feedback.thanks': 'Thanks!',
  'feedback.error': 'Could not send (is the server reachable?).',

  // ── Multiplayer lobby ────────────────────────────────────────────────────────
  'mp.formTitle': 'Multiplayer — territorial-loop',
  'mp.namePlaceholder': 'You',
  'mp.room': 'Room',
  'mp.roomPlaceholder': 'empty = new room',
  'mp.connect': 'Connect',
  'mp.noUrl': 'Please enter a server URL.',
  'mp.back': 'Back',
  'mp.connecting': 'Connecting …',
  'mp.timeout':
    'No connection (timeout). Is the dev server (npm run dev) or npm run server running?',
  'mp.lobbyTitle': 'Lobby',
  'mp.roomCode': 'Room code',
  'mp.copy': 'Copy',
  'mp.copied': 'Copied',
  'mp.you': 'you',
  'mp.ready': 'ready',
  'mp.waiting': 'waiting …',
  'mp.disconnected': 'disconnected',
  'mp.waitingPeers': 'Waiting for participants …',
  'mp.readyBtn': 'Ready',
  'mp.matchHost': 'Match (you are host)',
  'mp.matchGuest': 'Match (set by host)',
  'mp.public': 'listed in the server browser',
  'mp.private': 'private (code/link only)',
  'mp.map': 'Map',
  'mp.terrain': 'Terrain',
  'mp.terrainFlat': 'Open',
  'mp.ai': 'AI',
  'mp.wild': 'Wild',
  'mp.difficulty': 'AI strength',
  'mp.visible': 'Visible',
  'uiscale.title': 'UI size',
  'nation.wild': 'wild',
  'hud.resync': 'Resyncing …',
  'log.diplomacy': 'Diplomacy',
  'log.war': 'War',
  'log.economy': 'Economy',
  'prompt.offersAlliance': 'offers an alliance',
  'prompt.accept': 'Accept',
  'prompt.decline': 'Decline',
  'prompt.ignore': 'Ignore',
  'field.rivers': 'Rivers',
  'field.rivers.hint': 'continents/islands only, navigable',
}
