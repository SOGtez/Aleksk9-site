/* Starting tournament config. Admin can overwrite this from /api/admin/reset.
   Team ids and player ids must be unique, lowercase, no spaces. Captains are not in the pool.
   Teams are listed in ROUND 1 draft order (worst to best); the order flips every round.
   `twitch` is the captain's Twitch login (lowercase); logging in with it grants the captain role. */
export const DEFAULT_STATE = {
  name: 'R6 5v5 Tournament',
  hosts: ['AleksK9', 'NV30'],
  format: { teamSize: 5, firstTo: 7, otTo: 8, swapEvery: 3 },
  rules: [
    'First to 7 rounds wins. If it goes 6-6, overtime is first to 8.',
    'Sides swap every 3 rounds.',
    'Pro League operator bans.',
    'Shields allowed. Roaming allowed. Spawn peeks allowed.',
    'Snake draft. Round 1 goes worst captain to best, then the order flips every round.'
  ],
  maps: ['Kafe Dostoyevsky', 'Border', 'Clubhouse', 'Bank', 'Consulate', 'Lair', 'Nighthaven Labs', 'Fortress', 'Chalet'],
  teams: [
    { id: 'frankie',   name: 'Team Frankie',   captain: 'Frankie',   info: '32 hrs · lvl 18 · Unranked',  twitch: 'frankiemas8' },
    { id: 'leo',       name: 'Team Leo',       captain: 'Leo',       info: '102 hrs · lvl 55 · Unranked', twitch: 'leogotmotionissosexy' },
    { id: 'mroctober', name: 'Team MrOctober', captain: 'MrOctober', info: '86 hrs · lvl 59 · Silver',    twitch: '' },
    { id: 'mxlly',     name: 'Team Mxlly',     captain: 'Mxlly',     info: '202 hrs · lvl 90 · Bronze',   twitch: 'darealmxlly' },
    { id: 'niko',      name: 'Team Niko',      captain: 'Niko',      info: '263 hrs · lvl 65 · Bronze',   twitch: 'nikolaosthegoat10' },
    { id: 'fiddle',    name: 'Team Fiddle',    captain: 'Fiddle',    info: '52 hrs · lvl 32 · Unranked',  twitch: 'alfie____8' }
  ],
  rounds: 4,
  tiers: ['Champs', 'Ranked', 'Rookies'],
  pool: [
    { id: 'duke',       name: 'Duke',       tier: 0, info: '4000+ hrs · 3x Champ' },
    { id: 'zynjto',     name: 'Zynjto',     tier: 0, info: '8000+ hrs · 6x Champ · Flex / Support' },
    { id: 'mycern',     name: 'MyCern',     tier: 0, info: '4000+ hrs · 10x Champ' },
    { id: 'vexjng',     name: 'Vexjng',     tier: 0, info: '1400+ hrs · 2x Champ' },
    { id: 'iso',        name: 'Iso',        tier: 0, info: '2000 hrs · 1x Champ' },

    { id: 'nv30',       name: 'NV30',       tier: 1, info: '1540 hrs · Emerald · Breacher / Anchor' },
    { id: 'beebo',      name: 'Beebo',      tier: 1, info: '1409 hrs · Emerald · Intel / Anchor' },
    { id: 'noni',       name: 'Noni',       tier: 1, info: '600 hrs · Diamond (PC), Diamond roller · Flex' },
    { id: 'jake',       name: 'Jake',       tier: 1, info: '1366 hrs · Plat (PC), Diamond roller · Flex / Anchor' },
    { id: 'halo',       name: 'Halo',       tier: 1, info: '4000+ hrs · 2x Diamond · Flex / Support' },
    { id: 'tubs',       name: 'Tubs',       tier: 1, info: '962 hrs · 2x Emerald (PC) · Flex' },

    { id: 'carlos',     name: 'Carlos',     tier: 2, info: '251 hrs · lvl 124 · Bronze' },
    { id: 'colin',      name: 'Colin',      tier: 2, info: '' },
    { id: 'pocket',     name: 'Pocket',     tier: 2, info: 'Plat' },
    { id: 'jimmy',      name: 'Jimmy',      tier: 2, info: '' },
    { id: 'alfe',       name: 'Alfe',       tier: 2, info: '55 hrs · lvl 55 · Unranked' },
    { id: 'aleksk9',    name: 'AleksK9',    tier: 2, info: '205 hrs · lvl 89 · Silver' },
    { id: 'angel',      name: 'Angel',      tier: 2, info: '98 hrs · lvl 66 · Silver' },
    { id: 'niko2',      name: 'Niko',       tier: 2, info: '86 hrs · lvl 42 · Unranked' },
    { id: 'newbslayer', name: 'NewbSlayer', tier: 2, info: '265 hrs · lvl 95 · Silver' }
  ],
  picks: [],            /* [{ team, player, by, at }] in order */
  matches: [],          /* [{ id, teams:[tid, tid], map, status:'upcoming'|'live'|'final', score:[n, n] }] */
  stats: {},            /* { playerId or teamId(captain): [kills, deaths, assists] } */
  updatedAt: 0
};

/* Snake order: odd rounds use the team list order, even rounds reverse it. */
export function pickOrder(state, round) {
  const ids = state.teams.map(t => t.id);
  return round % 2 === 1 ? ids : ids.slice().reverse();
}
export function nextSlot(state) {
  const T = state.teams.length;
  const n = state.picks.length;
  if (n >= state.rounds * T || n >= state.pool.length) return null;
  const round = Math.floor(n / T) + 1;
  return { round, team: pickOrder(state, round)[n % T], pickNo: n + 1, total: Math.min(state.rounds * T, state.pool.length) };
}
