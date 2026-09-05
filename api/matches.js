import { json, requireRole, readBody } from './_lib/http.js';
import { getState, setState } from './_lib/store.js';

/* helper or admin
   POST { action:'add', teams:[tid, tid], map }
   POST { action:'update', id, score:[a,b], status:'upcoming'|'live'|'final', map }
   POST { action:'remove', id } */
export default async function handler(req, res) {
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
