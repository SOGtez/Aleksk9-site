import { json, readBody, whoami } from '../../server/lib/http.js';
import {
  hasDatabase, getAwSeason, setAwSeason, getAwEntries, addAwEntryOnce, clearAwEntries,
  listAwArchive, saveAwArchive, deleteAwArchive,
} from '../../server/lib/store.js';
import { profiles } from '../../server/lib/twitch.js';
import {
  THEMES, PHASES, stageOf, showsFinalists, computeResults, tallyNominations, hallSummary, pastSeasons, demoSeason,
} from '../../server/lib/awards.js';

/* AK9 Awards (/awards). One route for everything:
   GET                         the current season as visitors see it, your own nominations/ballot, the Hall of Fame list,
                               and the results once the season is revealed
   GET ?season=<id>            one finished season with its results (Hall of Fame page)
   GET ?view=admin             admins: everything, incl. the nomination tally and live vote counts (the reveal page uses this)
   POST { action: 'nominate', choices: { awardId: name } }       followers, once, while nominations are open
   POST { action: 'vote', choices: { awardId: nomineeId } }      followers, once, while voting is open
   POST admin: save { season } · newSeason { label, copyAwards } · archive · clear { kind: 'noms'|'votes' } · deleteArchive { id }
   Without a database (the test site) it serves a sample season: add ?demo=<stage> to preview a stage. */

const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const isIso = (v) => !!v && !isNaN(Date.parse(v));
const rid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'season';
const LOGIN_RE = /^[a-z0-9_]{3,25}$/;

function publicSeason(season, stage, counts) {
  if (!season) return null;
  return {
    id: season.id, label: season.label, theme: season.theme, phase: season.phase, stage,
    nominateOpen: season.nominateOpen || '', nominateDeadline: season.nominateDeadline || '', voteDeadline: season.voteDeadline || '',
    awards: (season.awards || []).map((a) => ({ id: a.id, title: a.title, description: a.description || '', nominees: showsFinalists(stage) ? a.nominees || [] : [] })),
    wildcards: stage === 'revealed' ? season.wildcards || [] : [],
    wildcardsBy: season.wildcardsBy || '',
    revealStyle: season.revealStyle || 'pumpkin',
    counts,
  };
}
async function withImages(names) {
  try { return await profiles(names); } catch { return {}; }
}
/* Pictures for wildcard winners (names are Twitch logins). */
async function wildcardsWithImages(list) {
  const logins = (list || []).flatMap((w) => w.winners || []).map((n) => String(n).toLowerCase());
  const pics = logins.length ? await withImages(logins) : {};
  return (list || []).map((w) => ({ ...w, people: (w.winners || []).map((n) => ({ name: n, image: (pics[String(n).toLowerCase()] || {}).avatar || '' })) }));
}
async function hall() {
  const stored = hasDatabase() ? await listAwArchive() : [];
  const all = [...stored.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)), ...pastSeasons()];
  return all.map(hallSummary);
}
async function findArchived(id) {
  const stored = hasDatabase() ? await listAwArchive() : [];
  return [...stored, ...pastSeasons()].find((s) => s.id === id) || null;
}

function sanitizeSeason(input, prev) {
  const s = input || {};
  const awards = (Array.isArray(s.awards) ? s.awards : []).slice(0, 40).map((a) => {
    const nominees = (Array.isArray(a.nominees) ? a.nominees : []).slice(0, 12).map((n) => {
      const login = clean(n.login, 25).toLowerCase().replace(/^@/, '');
      return { id: clean(n.id, 40) || rid('n'), name: clean(n.name, 60) || login, login: LOGIN_RE.test(login) ? login : '', image: /^https:\/\//.test(clean(n.image, 400)) ? clean(n.image, 400) : '' };
    }).filter((n) => n.name);
    const ids = nominees.map((n) => n.id);
    return { id: clean(a.id, 60) || rid('a'), title: clean(a.title, 80), description: clean(a.description, 400), nominees,
      winnerIds: (Array.isArray(a.winnerIds) ? a.winnerIds : []).map((x) => clean(x, 40)).filter((x) => ids.includes(x)) };
  }).filter((a) => a.title);
  const wildcards = (Array.isArray(s.wildcards) ? s.wildcards : []).slice(0, 10).map((w) => ({
    title: clean(w.title, 80), winners: (Array.isArray(w.winners) ? w.winners : []).map((x) => clean(x, 40).replace(/^@/, '')).filter(Boolean).slice(0, 4),
  })).filter((w) => w.title && w.winners.length);
  return {
    id: (prev && prev.id) || slug(clean(s.label, 60)) + '-' + Date.now().toString(36).slice(-4),
    label: clean(s.label, 60) || (prev && prev.label) || 'AK9 Awards',
    theme: THEMES.includes(s.theme) ? s.theme : 'classic',
    phase: PHASES.includes(s.phase) ? s.phase : 'soon',
    nominateOpen: isIso(s.nominateOpen) ? new Date(s.nominateOpen).toISOString() : '',
    nominateDeadline: isIso(s.nominateDeadline) ? new Date(s.nominateDeadline).toISOString() : '',
    voteDeadline: isIso(s.voteDeadline) ? new Date(s.voteDeadline).toISOString() : '',
    wildcardsBy: clean(s.wildcardsBy, 30),
    revealStyle: s.revealStyle === 'spotlight' ? 'spotlight' : 'pumpkin',
    awards, wildcards, updatedAt: Date.now(),
  };
}
/* Finalists with a Twitch login get their profile picture filled in. */
async function fillImages(season) {
  const need = season.awards.flatMap((a) => a.nominees).filter((n) => n.login && !n.image).map((n) => n.login);
  if (!need.length) return season;
  const pics = await withImages(need);
  for (const a of season.awards) for (const n of a.nominees) if (n.login && !n.image && pics[n.login]) n.image = pics[n.login].avatar;
  return season;
}

export default async function handler(req, res) {
  const me = await whoami(req);
  const isAdmin = me.role === 'admin';

  /* ---------- test site: sample data ---------- */
  if (!hasDatabase()) {
    const demoStage = clean(req.query.demo, 20) || 'vote';
    const { season, ballots } = demoSeason(demoStage);
    const stage = stageOf(season);
    if (req.method === 'POST') {
      const b = readBody(req);
      if (b.action === 'nominate' || b.action === 'vote') return json(res, 200, { ok: true, demo: true });
      return json(res, 400, { error: 'The test site has no database, so admin changes are not saved here.' });
    }
    if (req.query.season) { const s = await findArchived(clean(req.query.season, 60)); if (!s) return json(res, 404, { error: 'Not found' }); return json(res, 200, { season: { ...s, wildcards: await wildcardsWithImages(s.wildcards) }, demo: true }); }
    const results = computeResults(season, ballots);
    const counts = { nominators: 31, voters: results.totalVoters };
    if (req.query.view === 'admin') return json(res, 200, { season, stage, counts, results, tally: tallyNominations(season, {}), demo: true });
    return json(res, 200, {
      demo: true, season: publicSeason(season, stage, counts),
      me: { loggedIn: true, login: 'demo_viewer', name: 'demo_viewer', avatar: '', follows: true, isAdmin: true, nominated: null, voted: null },
      results: stage === 'revealed' ? { ...results, wildcards: await wildcardsWithImages(season.wildcards) } : null,
      hall: await hall(),
    });
  }

  const season = await getAwSeason();
  const stage = stageOf(season);

  if (req.method === 'GET') {
    if (req.query.season) {
      const s = await findArchived(clean(req.query.season, 60));
      if (!s) return json(res, 404, { error: 'Not found' });
      return json(res, 200, { season: { ...s, wildcards: await wildcardsWithImages(s.wildcards) } });
    }
    const [noms, votes] = season ? await Promise.all([getAwEntries('noms', season.id), getAwEntries('votes', season.id)]) : [{}, {}];
    const counts = { nominators: Object.keys(noms).length, voters: Object.keys(votes).length };
    if (req.query.view === 'admin') {
      if (!isAdmin) return json(res, 403, { error: 'Admins only' });
      return json(res, 200, { season, stage, counts, results: season ? computeResults(season, votes) : null, tally: season ? tallyNominations(season, noms) : {} });
    }
    const mine = me.user && season ? { nominated: (noms[me.user.login] || {}).choices || null, voted: (votes[me.user.login] || {}).choices || null } : { nominated: null, voted: null };
    return json(res, 200, {
      season: publicSeason(season, stage, counts),
      me: me.user ? { loggedIn: true, login: me.user.login, name: me.user.name, avatar: me.user.avatar, follows: !!me.user.follows, isAdmin, ...mine } : { loggedIn: false, isAdmin: false },
      results: season && stage === 'revealed' ? { ...computeResults(season, votes), wildcards: await wildcardsWithImages(season.wildcards) } : null,
      hall: await hall(),
    });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);

  /* ---------- viewers ---------- */
  if (b.action === 'nominate' || b.action === 'vote') {
    if (!me.user) return json(res, 401, { error: 'Log in with Twitch first' });
    if (!me.user.follows) return json(res, 403, { error: 'follow_required' });
    if (!season) return json(res, 400, { error: 'The awards are not open yet' });
    const awards = season.awards || [], c = b.choices || {}, choices = {};
    if (b.action === 'nominate') {
      if (stage !== 'nominate') return json(res, 400, { error: 'Nominations are not open' });
      for (const a of awards) { const v = clean(c[a.id], 60).replace(/[<>]/g, ''); if (!v) return json(res, 400, { error: 'Name someone for every award' }); choices[a.id] = v; }
    } else {
      if (stage !== 'vote') return json(res, 400, { error: 'Voting is not open' });
      for (const a of awards) { const v = clean(c[a.id], 40); if (!(a.nominees || []).some((n) => n.id === v)) return json(res, 400, { error: 'Pick a finalist for every award' }); choices[a.id] = v; }
    }
    const kind = b.action === 'nominate' ? 'noms' : 'votes';
    const ok = await addAwEntryOnce(kind, season.id, me.user.login, { choices, name: me.user.name || me.user.login, at: Date.now() });
    if (!ok) return json(res, 409, { error: b.action === 'nominate' ? 'already_nominated' : 'already_voted' });
    return json(res, 200, { ok: true, choices });
  }

  /* ---------- admins ---------- */
  if (!isAdmin) return json(res, 403, { error: 'Admins only' });
  if (b.action === 'save') {
    const next = await fillImages(sanitizeSeason(b.season, season));
    return json(res, 200, { ok: true, season: await setAwSeason(next) });
  }
  if (b.action === 'newSeason') {
    const label = clean(b.label, 60);
    if (!label) return json(res, 400, { error: 'Give the season a name, like "Winter 2026"' });
    const awards = b.copyAwards && season ? season.awards.map((a) => ({ id: rid('a'), title: a.title, description: a.description, nominees: [], winnerIds: [] })) : [];
    const next = { id: slug(label) + '-' + Date.now().toString(36).slice(-4), label, theme: (season && season.theme) || 'classic', revealStyle: (season && season.revealStyle) || 'pumpkin', phase: 'soon', nominateOpen: '', nominateDeadline: '', voteDeadline: '', awards, wildcards: [], updatedAt: Date.now() };
    return json(res, 200, { ok: true, season: await setAwSeason(next) });
  }
  if (!season) return json(res, 400, { error: 'Start a season first' });
  if (b.action === 'archive') {
    const votes = await getAwEntries('votes', season.id);
    const r = computeResults(season, votes);
    const archived = { id: season.id, label: season.label, theme: season.theme, totalVoters: r.totalVoters, awards: r.awards, wildcards: season.wildcards || [], wildcardsBy: season.wildcardsBy || '', revealStyle: season.revealStyle || 'pumpkin', archivedAt: Date.now() };
    await saveAwArchive(archived);
    await setAwSeason({ ...season, phase: 'revealed', updatedAt: Date.now() });
    return json(res, 200, { ok: true, archived: hallSummary(archived) });
  }
  if (b.action === 'clear') {
    if (!['noms', 'votes'].includes(b.kind)) return json(res, 400, { error: 'kind must be noms or votes' });
    await clearAwEntries(b.kind, season.id);
    return json(res, 200, { ok: true });
  }
  if (b.action === 'deleteArchive') {
    await deleteAwArchive(clean(b.id, 60));
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { error: 'Unknown action' });
}
