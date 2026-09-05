import { json, requireRole, readBody } from './_lib/http.js';
import { getState, setState } from './_lib/store.js';

/* POST { index, score: [a, b], status: 'upcoming'|'live'|'final', map? } — helper or admin */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['helper', 'admin']);
  if (!me) return;
  const b = readBody(req);
  const state = await getState();
  const i = Number(b.index);
  const m = state.matches[i];
  if (!m) return json(res, 400, { error: 'Unknown match' });
  if (Array.isArray(b.score) && b.score.length === 2) m.score = b.score.map(n => Math.max(0, Math.min(99, Number(n) || 0)));
  if (['upcoming', 'live', 'final'].includes(b.status)) m.status = b.status;
  if (typeof b.map === 'string' && b.map.trim()) m.map = b.map.trim().slice(0, 40);
  m.updatedBy = me.user.login;
  await setState(state);
  json(res, 200, { ok: true, match: m, index: i });
}
