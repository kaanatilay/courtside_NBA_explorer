// Use fully observed samples. An unavailable value must not silently become a
// zero or shrink one metric's denominator compared with the other metrics.
export function average(rows, key) {
  if (!rows.length || rows.some(row => !Number.isFinite(row[key]))) return null;
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

// Team periods combine published points with checked play-by-play counts.
// Players still have full-game stats only; period stats/minutes stay unavailable.
export function rowsFor(games, teamId, quarter = 'all', playerId = null) {
  return games.flatMap(game => {
    const side = game.sides[teamId];
    if (!side) return [];
    const player = playerId ? side.players.find(player => player.id === playerId && player.played) : null;
    if (playerId && !player) return [];
    const stats = playerId ? (quarter === 'all' ? player.stats : {})
      : quarter === 'all' ? side.stats : (side.periods[Number(quarter) - 1] || {});
    return [{ ...stats, id: game.id, date: game.date, source: game.source, quarterValidation: side.quarterValidation,
      opponent: Object.keys(game.sides).find(id => id !== teamId) }];
  });
}

// Roster averages use the loaded TEAM sample. A separate detail request scans
// for the selected player's own last N appearances, including earlier games.
export function playersFor(games, teamId) {
  const players = new Map();
  for (const game of games) for (const player of game.sides[teamId]?.players || []) {
    if (player.played) players.set(player.id, { id: player.id, name: player.name });
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
}
