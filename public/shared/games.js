// Every game the server hosts, in the order the TV lobby's "Game" row cycles
// through them. `tv` is the TV page, `pad` the phone controller page.
export const GAMES = [
  { id: 'kart', name: '🏎️ GoKart', tv: '/', pad: '/play' },
  { id: 'hockey', name: '🏒 Air Hockey', tv: '/hockey/', pad: '/hockey/play' },
  { id: 'sumo', name: '🥋 Ice Sumo', tv: '/sumo/', pad: '/sumo/play' },
  { id: 'cook', name: '🍳 Kitchen Rush', tv: '/cook/', pad: '/cook/play' },
];

export function gameAfter(id, dir = 1) {
  const i = GAMES.findIndex((g) => g.id === id);
  return GAMES[(i + (Math.sign(dir) || 1) + GAMES.length) % GAMES.length];
}

// Leave for another game, taking the phones along: they're told to open that
// game's controller, which re-joins the new TV automatically.
export function switchGame(from, dir, sendToAll, roomKey) {
  const next = gameAfter(from, dir);
  sendToAll({ t: 'switch', url: `${next.pad}?auto=1` });
  try {
    sessionStorage.removeItem(roomKey);
  } catch {}
  setTimeout(() => (location.href = next.tv), 150);
}
