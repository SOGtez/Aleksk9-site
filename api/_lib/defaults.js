/* Starting tournament config. Admin can overwrite this from /api/admin/reset.
   Player ids must be unique, lowercase, no spaces. Captains are not in the pool. */
export const DEFAULT_STATE = {
  name: 'R6 Siege Community Tournament',
  format: { teamSize: 5, bestOf: 3 },
  teams: {
    a: { id: 'a', name: 'Team A', captain: 'Captain A' },
    b: { id: 'b', name: 'Team B', captain: 'Captain B' }
  },
  rounds: 4,
  pool: [
    { id: 'player1', name: 'Player 1', mains: '' },
    { id: 'player2', name: 'Player 2', mains: '' },
    { id: 'player3', name: 'Player 3', mains: '' },
    { id: 'player4', name: 'Player 4', mains: '' },
    { id: 'player5', name: 'Player 5', mains: '' },
    { id: 'player6', name: 'Player 6', mains: '' },
    { id: 'player7', name: 'Player 7', mains: '' },
    { id: 'player8', name: 'Player 8', mains: '' }
  ],
  picks: [],            /* [{ team:'a'|'b', player:id, by:login, at:ts }] in order */
  matches: [
    { map: 'Map 1', status: 'upcoming', score: [0, 0] },
    { map: 'Map 2', status: 'upcoming', score: [0, 0] },
    { map: 'Map 3', status: 'upcoming', score: [0, 0] }
  ],
  stats: {},            /* { playerId: [kills, deaths, assists] } */
  updatedAt: 0
};

/* Snake order: round 1 = a,b · round 2 = b,a · ... */
export function pickOrder(round) { return round % 2 === 1 ? ['a', 'b'] : ['b', 'a']; }
export function nextSlot(state) {
  const total = state.rounds * 2;
  const n = state.picks.length;
  if (n >= total) return null;
  const round = Math.floor(n / 2) + 1;
  return { round, team: pickOrder(round)[n % 2], pickNo: n + 1 };
}
