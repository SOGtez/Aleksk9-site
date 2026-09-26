/* Starting tournament config. Admin can overwrite this from /api/admin/reset.
   Team ids and player ids must be unique, lowercase, no spaces. Captains are not in the pool.
   Teams are listed in ROUND 1 draft order (worst to best); the order flips every round.
   `twitch` on a team is the captain's Twitch login (lowercase); logging in with it grants the captain role.
   `twitch` on a pool player is optional and only used to show their Twitch profile picture. */
export const DEFAULT_STATE = {
  name: 'R6 5v5 Tournament',
  game: 'Rainbow Six Siege',
  hosts: ['AleksK9', 'Notvash30'],
  /* Twitch logins (lowercase) who can enter scores and stats. Admins can add more from the site. */
  helpers: ['pedrosahur', 'a1iy'],
  /* Twitch logins (lowercase) who are admins, in addition to ADMIN_LOGINS in Vercel. */
  admins: ['cuz4n'],
  format: { teamSize: 5, firstTo: 7, otTo: 8, swapEvery: 3 },
  rules: [
    { h: 'Game', t: 'First to 7 rounds wins. Sides swap every 3 rounds. If it goes 6-6, overtime is first to 8.' },
    { h: 'Map bans', t: 'Captains ban maps until one is left. The last 3 maps standing are used for the finals.' },
    { h: 'Draft', t: 'Snake draft. Round 1 goes in the listed captain order, then the order flips every round.' },
    { h: 'Teams', t: 'Each captain drafts 1 Champ, 1 Good, 1 Decent and 1 Rookie player, so every team is built the same way.' },
    { h: 'Streaming', t: 'Leave the stream before your game. Watching it while your own game is being played can get your team disqualified (proof required).' },
    { h: 'PC players', t: 'Mouse and keyboard required. Cap at 144 fps or lower. Moss is required for every PC player to prevent cheating (you will be told who to send it to).' },
    { h: 'Conduct', t: 'No intentional team-kills, and no throwing or selling games. Everyone must be in their own team\'s voice call.' },
    { h: 'Subs', t: 'A sub has to be a similar skill level to the player they replace, to keep teams fair.' },
    { h: 'Rehosts & pauses', t: 'Each team gets 1 rehost. Pauses are 1 minute max. Intentional disconnects are punishable.' },
    { h: 'Disputes', t: 'Every dispute needs proof. No proof, no punishment. The hosts\' decisions are final.' }
  ],
  maps: ['Villa', 'Border', 'Chalet', 'Clubhouse', 'Nighthaven Labs', 'Bank', 'Lair', 'Kafe Dostoyevsky', 'Fortress'],
  teams: [
    { id: 'frankie',   name: 'Team Frankie',   captain: 'Frankie',   info: '32 hrs · lvl 18 · Unranked',  twitch: 'frankiemas8' },
    { id: 'mroctober', name: 'Team MrOctober', captain: 'MrOctober', info: '86 hrs · lvl 59 · Silver',    twitch: 'samurau847' },
    { id: 'steve',     name: 'Team Steve',     captain: 'Steve',     info: '',                           twitch: 'stavroooooooooooo' },
    { id: 'niko',      name: 'Team Niko',      captain: 'Niko',      info: '263 hrs · lvl 65 · Bronze',   twitch: 'nikolaosthegoat10' },
    { id: 'cuzan',     name: 'Team Cuzan',     captain: 'Cuzan',     info: '',                           twitch: 'cuz4n' },
    { id: 'alfie',     name: 'Team Alfie',     captain: 'Alfie',     info: '1120 hrs · Bronze',           twitch: 'alfie____8' }
  ],
  rounds: 4,
  tiers: ['Champs', 'Good', 'Decent', 'Rookies', 'Subs'],
  quota: [1, 1, 1, 1, 0],  /* max picks per team from each tier (captain not counted). 0 = subs, only draftable if nothing legal is left. The Subs column is hidden while empty. */
  pool: [
    { id: 'mycern',     name: 'MyCern',     tier: 0, info: '4000+ hrs · 10x Champ' },
    { id: 'vexjng',     name: 'Vexjng',     tier: 0, info: '1400+ hrs · 2x Champ' },
    { id: 'zynjto',     name: 'Zynjto',     tier: 0, info: '8000+ hrs · 6x Champ · Flex / Support', twitch: 'zynjto' },
    { id: 'duke',       name: 'Duke',       tier: 0, info: '4000+ hrs · 3x Champ' },
    { id: 'garfield',   name: 'Garfield',   tier: 0, info: '' },
    { id: 'l33n',       name: 'L33N',       tier: 0, info: '' },

    { id: 'nv30',       name: 'Notvash30',  tier: 1, info: '1540 hrs · Emerald · Breacher / Anchor', twitch: 'notvash30' },
    { id: 'fxbm',       name: 'Fxbm',       tier: 1, info: '1350 hrs · lvl 193 · Emerald' },
    { id: 'jake',       name: 'Jake',       tier: 1, info: '1366 hrs · Plat (PC), Diamond roller · Flex / Anchor', twitch: 'xjakex0x' },
    { id: 'noni',       name: 'Noni',       tier: 1, info: '600 hrs · Diamond (PC), Diamond roller · Flex', twitch: 'nonyuhh' },
    { id: 'lovez',      name: 'Lovez',      tier: 1, info: '1300+ hrs · lvl 300 · Emerald' },
    { id: 'brandon',    name: 'Brandon',    tier: 1, info: '' },

    { id: 'aleksk9',    name: 'AleksK9',    tier: 2, info: '205 hrs · lvl 89 · Silver', twitch: 'aleksk9_' },
    { id: 'marv',       name: 'Marv',       tier: 2, info: '191 hrs · lvl 82 · Silver' },
    { id: 'zack',       name: 'Zack',       tier: 2, info: '465 hrs · lvl 112 · Silver' },
    { id: 'klixvy',     name: 'Klixvy',     tier: 2, info: '' },
    { id: 'pocket',     name: 'Pocket',     tier: 2, info: 'Plat' },
    { id: 'colin',      name: 'Colin',      tier: 2, info: '' },

    { id: 'abstract',   name: 'Abstract',   tier: 3, info: '300 hrs · lvl 100 · Silver' },
    { id: 'cash',       name: 'Cash',       tier: 3, info: '860 hrs · lvl 203 · Gold' },
    { id: 'jalen',      name: 'Jalen',      tier: 3, info: '1000 hrs · lvl 112 · Silver' },
    { id: 'carlos',     name: 'Carlos',     tier: 3, info: '251 hrs · lvl 124 · Bronze', twitch: 'carcarshaur' },
    { id: 'clovs',      name: 'Clovs',      tier: 3, info: '' },
    { id: 'leop',       name: 'Leo',        tier: 3, info: '102 hrs · lvl 55 · Unranked', twitch: 'bailout7xleo' }
  ],
  /* Final rosters set by the hosts after the draft (Discord announcement, Sep 26). When this is not empty
     it replaces the draft picks saved in the database. Player ids, in tier order Champs → Rookies. */
  rosters: {
    frankie:   ['duke', 'noni', 'colin', 'clovs'],
    mroctober: ['garfield', 'nv30', 'aleksk9', 'jalen'],
    steve:     ['l33n', 'jake', 'marv', 'leop'],
    niko:      ['mycern', 'fxbm', 'pocket', 'carlos'],
    cuzan:     ['zynjto', 'lovez', 'zack', 'abstract'],
    alfie:     ['vexjng', 'brandon', 'klixvy', 'cash']
  },
  draft: { open: false, pickSeconds: 90, turnStartedAt: 0 },   /* admin opens the draft; clock per pick */
  eventAt: '2026-09-27T00:00:00Z',   /* Tournament start: Sat Sep 26, 8:00 PM Eastern = 5:00 PM Pacific. */
  eventNote: '5:00 PM PT · 7:00 PM CT · 8:00 PM ET',
  teamNames: {},        /* teamId → name chosen by the captain */
  teamOrder: [],        /* team ids in round-1 draft order, set by an admin (e.g. after a spin wheel); empty = the order listed above */
  picks: [],            /* [{ team, player, by, at, auto? }] in order */
  matches: [],          /* [{ id, teams:[tid, tid], map, status:'upcoming'|'live'|'final', score:[n, n] }] */
  stats: {},            /* { playerId or teamId(captain): [kills, deaths, assists] } */
  bracket: { seeds: [], bo: 1, finalBo: 3, results: {} },   /* playoff bracket, see api/_lib/bracket.js */
  updatedAt: 0
};

/* Team make-up rule. Returns '' when the pick is allowed, otherwise the reason. */
export function pickBlockReason(state, teamId, playerId) {
  const q = state.quota; if (!Array.isArray(q) || !q.length) return '';
  const pl = state.pool.find(p => p.id === playerId); if (!pl) return 'Unknown player';
  const taken = new Set(state.picks.map(p => p.player));
  const have = state.picks.filter(p => p.team === teamId).map(p => (state.pool.find(x => x.id === p.player) || {}).tier || 0);
  const count = t => have.filter(x => x === t).length;
  const legal = p => q[p.tier || 0] == null || count(p.tier || 0) < q[p.tier || 0];
  if (legal(pl)) return '';
  const anyLegal = state.pool.some(p => !taken.has(p.id) && legal(p));
  if (!anyLegal) return ''; /* nothing legal left in the pool → let them pick anyway so the draft can finish */
  const tierName = (state.tiers || [])[pl.tier || 0] || 'that tier';
  return `Team already has ${q[pl.tier || 0]} from ${tierName}`;
}
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
