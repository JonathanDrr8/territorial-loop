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
  'settings.experimental': 'Experimental',
  'settings.experimental.body':
    'Opt-in features to try out land here as their own switches — forests, rivers, fish, ' +
    'earth-like noise … Nothing active yet.',

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
}
