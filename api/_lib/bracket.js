/* Single-elimination bracket built from the seeds in state.bracket.
   Seed 1 plays the lowest seed, etc. When the team count is not a power of two the top seeds get byes
   (6 teams: 1 and 2 go straight to the semis, 4 v 5 and 3 v 6 play the quarterfinals).
   Every match is best of `bo`, the final is best of `finalBo`. Results are stored per match id:
   state.bracket.results[id] = { teams:[tid, tid], status:'upcoming'|'live', games:[{ map, score:[a, b] }], winner? }
   `winner` is a manual override (forfeit). A result is ignored when the teams it was saved for are no longer
   the ones in that slot (an earlier result was changed). */

export const DEFAULT_BRACKET = { seeds: [], bo: 1, finalBo: 3, results: {} };

/* Standard seed order for a bracket of `size` (power of two): 8 → [1,8,4,5,2,7,3,6]. */
function seedOrder(size) {
  let order = [1];
  while (order.length < size) { const n = order.length * 2 + 1; order = order.flatMap(s => [s, n - s]); }
  return order;
}
function roundName(fromEnd) { return ['Final', 'Semifinals', 'Quarterfinals', 'Round of 16'][fromEnd] || 'Round of ' + Math.pow(2, fromEnd + 1); }
function matchLabel(fromEnd, n) { return fromEnd === 0 ? 'Final' : ({ 1: 'Semifinal', 2: 'Quarterfinal', 3: 'R16' }[fromEnd] || 'Match') + ' ' + n; }

/* Is a single map finished? First to `firstTo`; at (firstTo-1)-(firstTo-1) it goes to overtime, first to `otTo`. */
export function gameWinner(score, format) {
  const f = format || {}, to = Number(f.firstTo) || 7, ot = Number(f.otTo) || 0;
  const [a, b] = (score || [0, 0]).map(n => Number(n) || 0);
  if (a === b) return -1;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  const done = ot > to ? (hi >= to && lo <= to - 2) || hi >= ot : hi >= to;
  return done ? (a > b ? 0 : 1) : -1;
}

export function bracketOf(state) {
  const br = { ...DEFAULT_BRACKET, ...(state.bracket || {}) };
  const teamIds = state.teams.map(t => t.id);
  const seeds = (br.seeds || []).filter((id, i, a) => teamIds.includes(id) && a.indexOf(id) === i);
  const N = teamIds.length;
  const size = Math.max(2, Math.pow(2, Math.ceil(Math.log2(Math.max(2, N)))));
  const total = Math.log2(size);
  const ready = seeds.length === N && N >= 2;
  const bySeed = s => (s <= N ? seeds[s - 1] || null : null);
  const order = seedOrder(size);
  const rounds = [];
  let prev = null;
  for (let r = 0; r < total; r++) {
    const fromEnd = total - 1 - r, count = size / Math.pow(2, r + 1), list = [];
    for (let i = 0; i < count; i++) {
      const m = { id: 'r' + (r + 1) + 'm' + (i + 1), round: r, fromEnd, label: '', bo: fromEnd === 0 ? (br.finalBo || 3) : (br.bo || 1), teams: [null, null], seeds: [null, null], from: [null, null], bye: false, status: 'upcoming', games: [], wins: [0, 0], winner: null };
      for (let k = 0; k < 2; k++) {
        if (r === 0) {
          const s = order[i * 2 + k];
          if (s > N) { m.bye = true; continue; }
          m.seeds[k] = s; m.teams[k] = ready ? bySeed(s) : null;
        } else {
          const src = prev[i * 2 + k];
          if (src.bye) { m.seeds[k] = src.seeds[0] || src.seeds[1]; m.teams[k] = src.winner; }
          else { m.from[k] = src.label; m.teams[k] = src.winner; m.seeds[k] = src.winner ? src.seeds[src.teams.indexOf(src.winner)] : null; }
        }
      }
      if (!m.bye) m.label = matchLabel(fromEnd, list.filter(x => !x.bye).length + 1);
      if (m.bye) { m.winner = m.teams[0] || m.teams[1] || null; m.status = 'bye'; list.push(m); continue; }
      const res = (br.results || {})[m.id];
      if (res && m.teams[0] && m.teams[1] && Array.isArray(res.teams) && res.teams[0] === m.teams[0] && res.teams[1] === m.teams[1]) {
        m.games = Array.isArray(res.games) ? res.games : [];
        for (const g of m.games) { const w = gameWinner(g.score, state.format); if (w >= 0) m.wins[w]++; }
        const need = Math.floor(m.bo / 2) + 1;
        if (res.winner && m.teams.includes(res.winner)) { m.winner = res.winner; m.forfeit = true; }
        else if (m.wins[0] >= need) m.winner = m.teams[0];
        else if (m.wins[1] >= need) m.winner = m.teams[1];
        m.status = m.winner ? 'final' : (res.status === 'live' || m.games.some(g => (g.score || []).some(n => n > 0))) ? 'live' : 'upcoming';
        if (res.updatedBy) m.updatedBy = res.updatedBy;
      }
      list.push(m);
    }
    rounds.push({ name: roundName(fromEnd), matches: list });
    prev = list;
  }
  const final = rounds[rounds.length - 1].matches[0];
  return { seeds, ready, size, bo: br.bo || 1, finalBo: br.finalBo || 3, rounds, champion: final.winner || null, started: Object.keys(br.results || {}).length > 0 };
}
export function findMatch(view, id) {
  for (const r of view.rounds) for (const m of r.matches) if (m.id === id) return m;
  return null;
}
