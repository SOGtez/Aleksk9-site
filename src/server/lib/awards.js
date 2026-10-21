/* AK9 Awards: the season rules shared by the API (src/pages/api/awards.js).
   A season goes soon → nominate → vote → closed → revealed. Admins set the phase; nomination and voting
   deadlines also close things on their own. */
import { PAST_SEASONS } from './awards-archive.js';

export const THEMES = ['classic', 'crime', 'spooky'];
export const PHASES = ['soon', 'nominate', 'vote', 'closed', 'revealed'];

const past = (iso) => !!iso && Date.now() > Date.parse(iso);
/* What visitors actually see right now, from the phase plus its dates. */
export function stageOf(season) {
  if (!season) return 'soon';
  switch (season.phase) {
    case 'nominate':
      if (season.nominateOpen && !past(season.nominateOpen)) return 'nominate-soon';
      return past(season.nominateDeadline) ? 'nominate-closed' : 'nominate';
    case 'vote': return past(season.voteDeadline) ? 'closed' : 'vote';
    case 'closed': return 'closed';
    case 'revealed': return 'revealed';
    default: return 'soon';
  }
}
export const showsFinalists = (stage) => ['vote', 'closed', 'revealed'].includes(stage);

/* Names typed in nominations, made comparable: "@Pedro  Sahur " and "pedro sahur" count together. */
export const normName = (s) => String(s || '').trim().replace(/^@+/, '').replace(/\s+/g, ' ').toLowerCase();

/* Vote counts per finalist. A tie gives several winners unless an admin picked the winner (award.winnerIds). */
export function computeResults(season, ballots) {
  const list = Object.values(ballots || {}).map((b) => (typeof b === 'string' ? JSON.parse(b) : b));
  const awards = (season.awards || []).map((a) => {
    const counts = {}; let total = 0;
    for (const b of list) { const pick = b.choices && b.choices[a.id]; if (pick) { counts[pick] = (counts[pick] || 0) + 1; total++; } }
    const nominees = (a.nominees || []).map((n) => ({ ...n, votes: counts[n.id] || 0 })).sort((x, y) => y.votes - x.votes);
    const top = nominees.length ? nominees[0].votes : 0;
    const manual = (a.winnerIds || []).filter((id) => nominees.some((n) => n.id === id));
    const winnerIds = manual.length ? manual : top > 0 ? nominees.filter((n) => n.votes === top).map((n) => n.id) : [];
    return { id: a.id, title: a.title, description: a.description || '', total, winnerIds, nominees };
  });
  return { totalVoters: list.length, awards };
}

/* Tally of nomination names per award, most named first. */
export function tallyNominations(season, entries) {
  const out = {};
  for (const a of season.awards || []) out[a.id] = {};
  for (const raw of Object.values(entries || {})) {
    const e = typeof raw === 'string' ? JSON.parse(raw) : raw;
    for (const [awardId, name] of Object.entries(e.choices || {})) {
      if (!out[awardId]) continue;
      const k = normName(name); if (!k) continue;
      const t = out[awardId][k] || (out[awardId][k] = { name: String(name).trim().replace(/^@+/, ''), count: 0 });
      t.count++;
    }
  }
  const res = {};
  for (const [id, m] of Object.entries(out)) res[id] = Object.values(m).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return res;
}

/* Short version of a finished season for the Hall of Fame list. */
export function hallSummary(s) {
  return {
    id: s.id, label: s.label, theme: s.theme || 'classic', totalVoters: s.totalVoters || 0, awardCount: (s.awards || []).length,
    highlights: (s.awards || []).slice(0, 4).map((a) => {
      const w = (a.nominees || []).find((n) => (a.winnerIds || []).includes(n.id));
      return { title: a.title, name: w ? w.name : '', image: w ? w.image || '' : '' };
    }),
  };
}
export const pastSeasons = () => PAST_SEASONS;

/* The test site has no database: a sample season built from July 2026 so every stage can be previewed with
   ?demo=soon|nominate|vote|closed|revealed. */
export function demoSeason(stage) {
  const july = PAST_SEASONS[0];
  const phase = ['nominate-soon', 'nominate-closed'].includes(stage) ? 'nominate' : PHASES.includes(stage) ? stage : 'vote';
  const day = 86400e3, now = Date.now();
  const season = {
    id: 'demo', label: 'Fall 2026 (sample)', theme: 'classic', phase,
    nominateOpen: stage === 'nominate-soon' ? new Date(now + 2 * day).toISOString() : '',
    nominateDeadline: stage === 'nominate-closed' ? new Date(now - day).toISOString() : new Date(now + 5 * day).toISOString(),
    voteDeadline: new Date(now + 3 * day).toISOString(),
    awards: july.awards.slice(0, 6).map((a) => ({ id: a.id, title: a.title, description: a.description, nominees: a.nominees.map(({ votes, ...n }) => n) })),
    wildcards: july.wildcards,
  };
  const ballots = {};
  /* fake ballots that reproduce July's numbers for the first six awards */
  july.awards.slice(0, 6).forEach((a) => { let i = 0; for (const n of a.nominees) for (let v = 0; v < n.votes; v++) { const k = 'v' + i++; (ballots[k] = ballots[k] || { choices: {} }).choices[a.id] = n.id; } });
  return { season, ballots };
}
