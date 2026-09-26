import { json, requireRole, readBody , spaced } from './_lib/http.js';
import { getState, setState, cooldown } from './_lib/store.js';
import { DEFAULT_BRACKET, bracketOf, findMatch } from './_lib/bracket.js';

/* helper or admin
   POST { action:'add', teams:[tid, tid], map }
   POST { action:'update', id, score:[a,b], status:'upcoming'|'live'|'final', map }
   POST { action:'remove', id } */
async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['helper', 'admin']);
  if (!me) return;
  const b = readBody(req);
  const state = await getState();
  const teamIds = new Set(state.teams.map(t => t.id));
  const cleanMap = v => String(v || '').trim().slice(0, 40);

  if (b.action === 'add') {
    const t = Array.isArray(b.teams) ? b.teams.map(String) : [];
    if (t.length !== 2 || !teamIds.has(t[0]) || !teamIds.has(t[1]) || t[0] === t[1]) return json(res, 400, { error: 'Pick two different teams' });
    const m = { id: 'm' + Date.now().toString(36), teams: t, map: cleanMap(b.map) || 'TBD', status: 'upcoming', score: [0, 0], by: me.user.login };
    state.matches.push(m);
    await setState(state);
    return json(res, 200, { ok: true, match: m });
  }

  if (String(b.action || '').startsWith('bracket-')) return bracket(req, res, me, b, state, teamIds, cleanMap);

  const m = state.matches.find(x => x.id === b.id);
  if (!m) return json(res, 400, { error: 'Unknown match' });

  if (b.action === 'remove') {
    state.matches = state.matches.filter(x => x.id !== b.id);
    await setState(state);
    return json(res, 200, { ok: true });
  }

  if (Array.isArray(b.score) && b.score.length === 2) m.score = b.score.map(n => Math.max(0, Math.min(99, Number(n) || 0)));
  if (['upcoming', 'live', 'final'].includes(b.status)) m.status = b.status;
  if (b.map != null && cleanMap(b.map)) m.map = cleanMap(b.map);
  m.updatedBy = me.user.login;
  await setState(state);
  json(res, 200, { ok: true, match: m });
}
/* Playoff bracket (see api/_lib/bracket.js). helper or admin unless noted.
   POST { action:'bracket-seeds', seeds:[tid, …] }   seed 1 first; a partial list fills slots one at a time
   POST { action:'bracket-result', id, games:[{ map, score:[a,b] }], status:'live'|'upcoming', winner? }
   POST { action:'bracket-clear-match', id }
   POST { action:'bracket-reset' }                    admin: wipe seeds and every result
   Helpers can save a score (result or clear) once a minute; admins have no limit. */
const HELPER_COOLDOWN = 60;
async function helperWait(me, res) {
  if (me.role !== 'helper') return false;
  const wait = await cooldown('t:cool:score:' + me.user.login, HELPER_COOLDOWN);
  if (!wait) return false;
  json(res, 429, { error: `You can save a score once a minute. Try again in ${wait}s`, retryAfter: wait });
  return true;
}
async function bracket(req, res, me, b, state, teamIds, cleanMap) {
  const br = state.bracket = { ...DEFAULT_BRACKET, ...(state.bracket || {}) };
  br.results = br.results || {};

  if (b.action === 'bracket-reset') {
    if (me.role !== 'admin') return json(res, 403, { error: 'Only admins can reset the bracket' });
    state.bracket = { ...DEFAULT_BRACKET, bo: br.bo, finalBo: br.finalBo, results: {} };
    await setState(state);
    return json(res, 200, { ok: true });
  }

  if (b.action === 'bracket-seeds') {
    if (Object.keys(br.results).length) return json(res, 409, { error: 'Matches have results already. An admin has to reset the bracket to change seeds' });
    const seeds = Array.isArray(b.seeds) ? b.seeds.map(String) : [];
    if (seeds.some((id, i) => !teamIds.has(id) || seeds.indexOf(id) !== i)) return json(res, 400, { error: 'Each team can only be seeded once' });
    br.seeds = seeds;
    await setState(state);
    return json(res, 200, { ok: true, seeds });
  }

  const view = bracketOf(state);
  const m = findMatch(view, String(b.id || ''));
  if (!m || m.bye) return json(res, 400, { error: 'Unknown match' });

  if (b.action === 'bracket-clear-match') {
    if (await helperWait(me, res)) return;
    delete br.results[m.id];
    await setState(state);
    return json(res, 200, { ok: true });
  }

  if (b.action === 'bracket-result') {
    if (!m.teams[0] || !m.teams[1]) return json(res, 409, { error: 'Both teams for this match are not known yet' });
    const games = (Array.isArray(b.games) ? b.games : []).slice(0, m.bo).map(g => ({
      map: cleanMap(g && g.map) || 'TBD',
      score: (Array.isArray(g && g.score) ? g.score : [0, 0]).slice(0, 2).map(n => Math.max(0, Math.min(99, Number(n) || 0)))
    }));
    const r = { teams: m.teams.slice(), games, status: b.status === 'live' ? 'live' : 'upcoming', updatedBy: me.user.login, at: Date.now() };
    if (b.winner) { if (!m.teams.includes(b.winner)) return json(res, 400, { error: 'Winner must be one of the two teams' }); r.winner = b.winner; }
    if (await helperWait(me, res)) return;
    br.results[m.id] = r;
    await setState(state);
    return json(res, 200, { ok: true, match: findMatch(bracketOf(state), m.id), cooldown: me.role === 'helper' ? HELPER_COOLDOWN : 0 });
  }
  return json(res, 400, { error: 'Unknown bracket action' });
}
export default spaced(handler);
