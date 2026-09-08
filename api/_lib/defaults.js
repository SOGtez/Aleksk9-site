/* Starting tournament config. Admin can overwrite this from /api/admin/reset.
   Team ids and player ids must be unique, lowercase, no spaces. Captains are not in the pool.
   Teams are listed in ROUND 1 draft order (worst to best); the order flips every round.
   `twitch` on a team is the captain's Twitch login (lowercase); logging in with it grants the captain role.
   `twitch` on a pool player is optional and only used to show their Twitch profile picture. */
export const DEFAULT_STATE = {
  name: 'R6 5v5 Tournament',
  hosts: ['AleksK9', 'Notvash30'],
  /* Twitch logins (lowercase) who can enter scores and stats. Admins can add more from the site. */
  helpers: ['pedrosahur', 'a1iy'],
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
    { id: 'fiddle',    name: 'Team Fiddle',    captain: 'Fiddle',    info: '52 hrs · lvl 32 · Unranked',  twitch: 'fiddlediddlemiddle' },
    { id: 'mroctober', name: 'Team MrOctober', captain: 'MrOctober', info: '86 hrs · lvl 59 · Silver',    twitch: 'samurau847' },
    { id: 'leo',       name: 'Team Leo',       captain: 'Leo',       info: '102 hrs · lvl 55 · Unranked', twitch: 'bailout7xleo' },
    { id: 'alfie',     name: 'Team Alfie',     captain: 'Alfie',     info: '55 hrs · lvl 55 · Unranked',  twitch: 'alfie____8' },
    { id: 'niko',      name: 'Team Niko',      captain: 'Niko',      info: '263 hrs · lvl 65 · Bronze',   twitch: 'nikolaosthegoat10' }
  ],
  rounds: 4,
  tiers: ['Champs', 'Ranked', 'Rookies'],
  pool: [
    { id: 'duke',       name: 'Duke',       tier: 0, info: '4000+ hrs · 3x Champ' },
    { id: 'zynjto',     name: 'Zynjto',     tier: 0, info: '8000+ hrs · 6x Champ · Flex / Support' },
    { id: 'mycern',     name: 'MyCern',     tier: 0, info: '4000+ hrs · 10x Champ' },
    { id: 'vexjng',     name: 'Vexjng',     tier: 0, info: '1400+ hrs · 2x Champ' },
    { id: 'iso',        name: 'Iso',        tier: 0, info: '2000 hrs · 1x Champ' },
    { id: 'mrflex',     name: 'MrFlex',     tier: 0, info: '2000 hrs · 1x Champ' },

    { id: 'nv30',       name: 'Notvash30',  tier: 1, info: '1540 hrs · Emerald · Breacher / Anchor', twitch: 'notvash30' },
    { id: 'beebo',      name: 'Beebo',      tier: 1, info: '1409 hrs · Emerald · Intel / Anchor' },
    { id: 'noni',       name: 'Noni',       tier: 1, info: '600 hrs · Diamond (PC), Diamond roller · Flex' },
    { id: 'jake',       name: 'Jake',       tier: 1, info: '1366 hrs · Plat (PC), Diamond roller · Flex / Anchor' },
    { id: 'halo',       name: 'Halo',       tier: 1, info: '4000+ hrs · 2x Diamond · Flex / Support' },
    { id: 'tubs',       name: 'Tubs',       tier: 1, info: '962 hrs · 2x Emerald (PC) · Flex' },
    { id: 'clovs',      name: 'Clovs',      tier: 2, info: '1500 hrs · lvl 230 · Gold' },
    { id: 'nix',        name: 'Nix',        tier: 2, info: '870 hrs · lvl 140 · Gold' },
    { id: 'cash',       name: 'Cash',       tier: 2, info: '860 hrs · lvl 203 · Gold' },
    { id: 'grape',      name: 'Grape',      tier: 2, info: 'lvl 97 · Plat (PC), Gold roller' },

    { id: 'carlos',     name: 'Carlos',     tier: 2, info: '251 hrs · lvl 124 · Bronze' },
    { id: 'colin',      name: 'Colin',      tier: 1, info: '1000 hrs · 4x Plat' },
    { id: 'jimmy',      name: 'Jimmy',      tier: 2, info: '' },
    { id: 'mxlly',      name: 'Mxlly',      tier: 2, info: '202 hrs · lvl 90 · Bronze', twitch: 'darealmxlly' },
    { id: 'aleksk9',    name: 'AleksK9',    tier: 2, info: '205 hrs · lvl 89 · Silver', twitch: 'aleksk9_' },
    { id: 'newbslayer', name: 'NewbSlayer', tier: 2, info: '265 hrs · lvl 95 · Silver' },
    { id: 'abstract',   name: 'Abstract',   tier: 2, info: '300 hrs · lvl 100 · Silver' },
    { id: 'jalen',      name: 'Jalen',      tier: 2, info: '1000 hrs · lvl 112 · Silver' }
  ],
  draft: { open: false, pickSeconds: 90, turnStartedAt: 0 },   /* admin opens the draft; clock per pick */
  eventAt: '',          /* ISO date-time of the draft / event, set from the admin page */
  eventNote: '',
  teamNames: {},        /* teamId → name chosen by the captain */
  picks: [],            /* [{ team, player, by, at, auto? }] in order */
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

/* Highest rank tier mentioned in a free-text info line ("1366 hrs · Plat (PC), Diamond roller" → "Diamond"). */
const TIERS = [['Champion', /champ/i], ['Diamond', /diamond/i], ['Emerald', /emerald/i], ['Platinum', /plat/i], ['Gold', /\bgold\b/i], ['Silver', /silver/i], ['Bronze', /bronze/i], ['Copper', /copper/i], ['Unranked', /unranked/i]];
export function rankFromInfo(text) {
  for (const [name, re] of TIERS) if (re.test(String(text || ''))) return name;
  return '';
}
