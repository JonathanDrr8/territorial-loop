/** English strings (ADR-0014). Missing keys fall back to German (`de`). */
export const en: Record<string, string> = {
  'app.tagline': 'Browser RTS on an edgeless world',

  'nav.play': 'Play',
  'nav.multiplayer': 'Multiplayer',
  'nav.ranking': 'Ranking',
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
  'section.mode': 'Mode',
  'field.captureMode': 'Capital mode',
  'field.teamMode': 'Teams',
  'teamMode.off': 'Off (free-for-all)',
  'teamMode.allied': 'Teams (allied)',
  'teamMode.shared': 'Shared nation',
  'field.teamCount': 'Team count',
  'field.teamSize': 'Team size',
  'section.match': 'Match',
  'field.map': 'Map (W × H)',
  'field.terrain': 'Map type',
  'field.aiCount': 'AI count',
  'field.wildCount': 'Wild nations',
  'field.difficulty': 'AI difficulty',
  'field.victory': 'Victory %',
  'field.seed': 'Seed (optional)',
  'field.seedPlaceholder': 'empty = random',
  'field.reroll': 'Reroll',
  'preset.title': 'Presets',
  'preset.sub': '{ai} foes · {wild} wild',
  'preset.small': 'Small',
  'preset.standard': 'Standard',
  'preset.large': 'Large',
  'preset.chaos': 'Chaos',
  'terrain.flat': 'Open (no water)',
  'terrain.continents': 'Continents',
  'terrain.islands': 'Islands',
  'terrain.world': 'World (geo)',
  'terrain.europe': 'Europe (geo)',
  'terrain.africa': 'Africa (geo)',
  'terrain.australia': 'Australia (geo)',
  'difficulty.beginner': 'Beginner',
  'difficulty.easy': 'Easy',
  'difficulty.standard': 'Standard',
  'difficulty.advanced': 'Advanced',
  'difficulty.expert': 'Expert',
  'play.start': 'Start match',
  'play.spectate': 'Spectate',
  'play.ranked': 'Ranked',
  'play.tutorial': 'Tutorial',

  // ── Tab "Settings" ─────────────────────────────────────────────────────────
  'settings.intro': 'Display & optional features. They apply to the next match.',
  'settings.display': 'Display',
  'settings.audio': 'Audio',
  'field.camera': 'Camera',
  'field.master': 'Master',
  'field.sound': 'Sound effects',
  'field.music': 'Music (beta)',
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
  'settings.hud': 'HUD & Appearance',
  'settings.hud.theme': 'Appearance',
  'settings.hud.hint':
    'The entire HUD can be freely customized in a match — press Esc in-game and choose "Customize HUD": move, resize, show or hide panels.',
  'settings.hud.layout': 'HUD layout',
  'settings.hud.resetLayout': 'Reset to default',
  'settings.hud.reset.done': 'Reset',

  // ── Tab "Multiplayer" ──────────────────────────────────────────────────────
  'mp.intro': 'Join an open game or create your own lobby.',
  'mp.openDialog': 'Create lobby / join by code',
  'mp.reconnect': '⟳ Reconnect — room {room}',

  // Online ranking (ADR-0027)
  'ranking.title': 'Online ranking',
  'ranking.intro':
    'Your ranked ELO from solo matches against the AI, saved worldwide. Multiplayer games do not change it.',
  'ranking.myElo': 'Your ELO',
  'ranking.myPeak': 'Best',
  'ranking.loading': 'Loading …',
  'ranking.empty': 'No entries yet — play a ranked match!',
  'ranking.colName': 'Name',
  'ranking.colElo': 'ELO',
  'ranking.colRecord': 'W/L',
  'ranking.hideMe': 'Hide me from the ranking',
  'ranking.hidden': 'Hidden',
  'ranking.visible': 'Visible',

  // Account / login (ADR-0027 phase 2)
  'account.signIn': 'Sign in',
  'account.title.account': 'Account',
  'account.title.login': 'Sign in',
  'account.title.register': 'Create account',
  'account.title.recover': 'Reset password',
  'account.loggedInAs': 'Signed in as {name}',
  'account.intro':
    'Optional: keep your ELO across devices. Without an account you keep playing as a guest.',
  'account.username': 'Username',
  'account.password': 'Password',
  'account.newPassword': 'New password',
  'account.email': 'Email (optional)',
  'account.recoveryCode': 'Recovery code',
  'account.btn.login': 'Sign in',
  'account.btn.register': 'Create account',
  'account.btn.recover': 'Reset',
  'account.btn.logout': 'Sign out',
  'account.btn.close': 'Close',
  'account.btn.savedIt': "I've saved it",
  'account.switch.toRegister': 'No account yet? Create one',
  'account.switch.toLogin': 'Already have an account? Sign in',
  'account.switch.toRecover': 'Forgot password?',
  'account.recoveryTitle': 'Your recovery code',
  'account.recoveryHint':
    'Keep it safe — it is the only way to reset your password without email. It is shown only this once.',
  'account.error.invalid': 'Wrong username or password.',
  'account.error.taken': 'That username is already taken.',
  'account.error.username': 'Username: 3–24 characters (letters, digits, _ and -).',
  'account.error.password': 'Password: at least 6 characters.',
  'account.error.offline': 'Server unreachable.',

  // Tutorial (guided match)
  'tutorial.title': 'Tutorial',
  'tutorial.btn.next': 'Next',
  'tutorial.btn.finish': 'Done',
  'tutorial.step.welcome.goal': 'Welcome',
  'tutorial.step.welcome.text':
    'Welcome to territorial-loop! The colored area in the middle is your nation. Your goal: spread out and conquer the island. We will go through the basics step by step.',
  'tutorial.step.expand.goal': 'Spread out',
  'tutorial.step.expand.text':
    'Click an adjacent gray area along your border — your troops spread there.',
  'tutorial.step.size.goal': 'Attack size',
  'tutorial.step.size.text':
    'With Shift+mouse wheel you set how much of your troops an attack commits. More troops conquer faster but leave your core thinner. Feel free to try it.',
  'tutorial.step.wild.goal': 'Conquer the wild',
  'tutorial.step.wild.text':
    'The gray "wild" nations are passive and thinly settled — perfect for growing. Conquer the wild nation next to you; conquering loots its gold.',
  'tutorial.step.city.goal': 'Build a city',
  'tutorial.step.city.text':
    'With gold you construct buildings. We are giving you some gold to practice. Press key 1 and place a city on your territory — a city raises your troop limit, so you can hold more troops.',
  'tutorial.step.factory.goal': 'Build a factory',
  'tutorial.step.factory.text':
    'Gold is the key to everything. Build a factory (key 4) — it links to your cities and produces gold continuously. Factories are the backbone of your economy. Here is gold for it.',
  'tutorial.step.grow.goal': 'Keep growing',
  'tutorial.step.grow.text':
    'Strong! Growing is what matters most. Keep spreading out and conquering more land — the bigger your nation, the more troops and gold.',
  'tutorial.step.airport.goal': 'Build an airport',
  'tutorial.step.airport.text':
    'Time for air power. Build an airport (key 5) — bombers launch from here. We are giving you the gold for it.',
  'tutorial.step.bomber.goal': 'Launch a bomber',
  'tutorial.step.bomber.text':
    'Press key 7 to build a bomber, then click an enemy (gray) area. The bomber flies there and drops a bomb that kills troops, neutralizes territory and destroys buildings — careful, it spares no one, not even allies.',
  'tutorial.step.finish.goal': 'Done',
  'tutorial.step.finish.text':
    'Done! You have the basics: spreading out, conquering, economy (cities + factories) and air war. Ports and ships, diplomacy and the game modes are best learned in a real match. Good luck!',

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
    '(trade & ships), Factory (economy), Airport (launches bombers) and Anti-air post (shoots down ' +
    'enemy bombers). Buildings are upgradeable; on conquest the new owner keeps them — except defense posts.',

  'help.economy.title': 'Economy (factory networks)',
  'help.economy.body':
    'Gold does not come from territory size but from factories: a factory supplies your cities ' +
    'and ports that are reachable over contiguous own land (gold carts travel your roads) and ' +
    'produces gold per connected target. A factory near a foreign nation yields 3× gold (and ' +
    'goodwill) for that link. Important: a freshly captured factory only produces once it is ' +
    'connected to your cities via your own territory. Build City + Port + Factory close together.',

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
    '1–6: buildings · 7: bomber · 8: warship · B: boat mode · R: ship ranges · ' +
    '"." / ",": speed · Space: pause · Esc: menu (also "Customize HUD").',

  'help.growth.title': 'Troop growth',
  'help.growth.body':
    'Each nation has a troop cap that rises with your tile count (sublinearly — twice the land ≠ ' +
    'twice the cap). Growth per second is not constant: near 0 troops you grow slowly, fastest at a ' +
    'medium stock, and the closer to the cap the more it brakes. The optimum is around 42 % of the ' +
    'cap. Spending troops on attacks keeps you in the high-growth zone; hoarding near the cap nearly ' +
    'stalls growth.',

  'help.air.title': 'Air war (bombers & anti-air)',
  'help.air.body':
    'An airport lets you launch bombers. A bomber flies to the target and drops a bomb: it tears ' +
    'a crater, kills troops in the blast radius and turns the hit land neutral. This generates ' +
    'strong grudge with the target (and fear in everyone else). An anti-air post shoots down enemy ' +
    'bombers within range — use it to protect your cities and factories.',

  'help.rivers.title': 'Rivers',
  'help.rivers.body':
    'Optional (enabled in the Experimental panel or lobby): on Continents and Islands maps, real ' +
    'navigable rivers are carved into the terrain — from the mountains down to the sea. They are ' +
    'wide enough for ships, which can sail deep inland and flank.',

  'help.hud.title': 'Customizing the HUD',
  'help.hud.body':
    'In a match, press Esc → "Customize HUD" to open the editor: freely move, resize and ' +
    'show/hide panels (a list shows all elements), change the theme and reset everything to ' +
    'default. Also accessible from the main-menu settings. Your layout is saved locally.',

  'help.multiplayer.title': 'Multiplayer & ranked',
  'help.multiplayer.body':
    'Multiplayer: via "Multiplayer" you open a room (share the code) or join one — everyone plays ' +
    'server-synchronized in the same match. Ranked mode: solo against an AI at your skill level; ' +
    'win and your ELO rises, so you can track your progress. AI difficulty ranges from Beginner ' +
    'to Expert.',

  // ── Event log ──────────────────────────────────────────────────────────────
  'event.allianceExpired': 'Alliance between {a} and {b} expired',
  'event.breakTraitor': '{a} ends the alliance with traitor {b}',
  'event.betray': '{a} betrays {b}!',
  'event.allied': '{a} and {b} are allied',
  'event.allianceOffer': '{a} offers {b} an alliance',
  'event.allianceDecline': '{a} declines {b}’s alliance',
  'event.embargoOn': '{a} imposes an embargo on {b}',
  'event.donateGold': '{a} gifts {b} {n} gold',
  'event.donateTroops': '{a} sends {b} {n} troops in support',
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
  'event.boatAttack': '{defender} is being attacked by {player} via transport boat',
  'event.boatSent': '{p} sends a transport boat',
  'event.boatLand': '{p} lands troops',
  'event.defend': '{p} fends off the attack from {attacker}',
  'event.warshipSent': '{p} sends out a warship',
  'event.boatSunk': 'Transport boat of {p} sunk',
  'event.tradeBlocked': 'Your trade blocked — {amount} gold lost',
  'event.warshipSunk': 'Warship of {p} sunk',
  'event.eliminated': '{p} was eliminated',
  'event.capitalCaptured': '{p} captures {victim}’s capital and seizes their empire',
  'event.capitalBombed': '{victim}’s capital is destroyed — their empire reverts to wilderness',
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
  'hud.tab.feed': 'Messages',
  'hud.troops': 'Troops',
  'hud.land': 'Land',
  'hud.gold': 'Gold',
  'pause.title': 'Pause',
  'pause.resume': 'Resume',
  'pause.leave': 'Leave round',
  'pause.settings': 'Settings',
  'settings.radialSize': 'Radial menu size',
  'settings.radialSize.small': 'Small',
  'settings.radialSize.normal': 'Normal',
  'settings.radialSize.large': 'Large',
  'settings.offscreenLabels': 'Edge labels (nearest …)',
  'settings.keybinds': 'Key bindings',
  'settings.keybinds.reset': 'Reset',
  'keybind.press': 'Press a key…',
  'keybind.center': 'Center on your nation',
  'keybind.radial': 'Open action menu',
  'keybind.boat': 'Transport boat mode',
  'keybind.bomber': 'Bomber mode',
  'keybind.warship': 'Warship mode',
  'keybind.shipRanges': 'Show ship ranges',
  'keybind.speedUp': 'Speed up',
  'keybind.speedDown': 'Slow down',
  'keybind.buildCity': 'Build: City',
  'keybind.buildDefense': 'Build: Defense',
  'keybind.buildPort': 'Build: Port',
  'keybind.buildFactory': 'Build: Factory',
  'keybind.buildAirport': 'Build: Airport',
  'keybind.buildFlak': 'Build: Anti-air',
  'hud.editor.open': 'Customize HUD',
  'hud.editor.done': 'Done',
  'hud.editor.reset': 'Default',
  'hud.editor.export': 'Export',
  'hud.editor.copied': 'Copied',
  'hud.editor.slider': 'Slider',
  'hud.editor.slider.action': 'Actions',
  'hud.editor.slider.resource': 'Troops',
  'hud.editor.buttons': 'Buttons',
  'hud.editor.buttons.row': 'Row',
  'hud.editor.buttons.numpad': 'Numpad',
  'hud.editor.merged': 'Bundle',
  'hud.editor.split': 'Split',
  'hud.editor.panel.troopsNum': 'Troop count',
  'hud.editor.panel.troopsBar': 'Troop bar',
  'hud.editor.panel.gold': 'Gold',
  'hud.editor.panel.buys': 'Purchases',
  'hud.editor.panel.boat': 'Transport boat',
  'hud.editor.theme': 'Theme',
  'hud.editor.hidden': 'Hidden',
  'hud.editor.elements': 'Elements',
  'hud.editor.tab.layout': 'Layout',
  'hud.editor.quickConfig': 'Quick config',
  'quickcfg.standard': 'Standard',
  'quickcfg.mouse': 'Mouse',
  'quickcfg.wheel': 'Nav wheel',
  'hud.editor.presets.templates': 'Templates',
  'hud.editor.presets.custom': 'Custom',
  'hud.editor.presets.load': 'Load',
  'hud.editor.presets.save': 'Save',
  'hud.editor.presets.delete': 'Delete',
  'hud.editor.presets.slotName': 'Layout {n}',
  'hud.editor.presets.saveInto': 'Save to…',
  'hud.editor.presets.newSlot': 'New slot',
  'hud.editor.panel.attacks': 'Ongoing attacks',
  'hud.editor.emptyHint': 'shown in-game',
  'hud.editor.hint': 'Drag = move · Corners = resize · × = hide',
  'hud.editor.resizePanel': 'Resize the toolbar',
  'hud.editor.panel.info': 'Game time',
  'hud.editor.panel.rank': 'Ranking',
  'hud.editor.panel.resource': 'Troops & Build',
  'hud.editor.panel.action': 'Action bar',
  'hud.editor.panel.minimap': 'Minimap',
  'hud.editor.panel.feed': 'Messages',
  'hud.editor.panel.wheel': 'Action wheel',
  'hud.editor.panel.topbar': 'Status bar',
  'hud.editor.panel.attackbar': 'Attack size',
  'hud.editor.panel.menu': 'Menu button',
  'hud.editor.panel.feedback': 'Feedback button',
  'hud.editor.troopStyle': 'Troop display',
  'hud.editor.troopStyle.bar': 'Bar',
  'hud.editor.troopStyle.orb': 'Orb',
  'hud.editor.control': 'Controls',
  'hud.editor.control.auto': 'Auto',
  'hud.editor.control.desktop': 'Desktop',
  'hud.editor.control.touch': 'Mouse / Wheel',
  'hud.boat': 'Transport boat',
  'hud.bomber': 'Bomber',
  'hud.warship': 'Warship',
  'hud.boatHintShort': 'target on another island',
  'wheel.title': 'Actions',
  'wheel.back': 'Back',
  'wheel.build': 'Build',
  'wheel.ships': 'Attacks',
  'minimap.collapse': 'Collapse minimap',
  'minimap.expand': 'Expand minimap',
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
  'hud.keepWatching': 'Keep watching',
  'hud.keepSpectating': 'Keep spectating',
  'hud.defeatTitle': 'You were defeated',
  'hud.defeatSub': 'Your nation was completely conquered.',
  'hud.troopStyleToggle': 'Toggle display: bar ↔ ball',
  'hud.andMore': '… and {n} more',
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
  'menu.donateGold': 'Gift gold',
  'menu.donateGoldParent': 'Buy goodwill / ease resentment',
  'menu.donateGoldDetail': 'Gifts {n} gold',
  'menu.donateSlider': 'Slider amount',
  'menu.donateTroops': 'Gift troops',
  'menu.donateTroopsDetail': 'Sends {n} troops in support',
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
  'mp.team': 'Team',
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
  'field.riverDensity': 'River Frequency',
}
