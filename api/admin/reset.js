import { json, requireRole, readBody } from '../_lib/http.js';
import { setState } from '../_lib/store.js';
import { DEFAULT_STATE } from '../_lib/defaults.js';

/* POST { config? } — admin only. Replaces the whole tournament.
   With no config, restores the defaults from api/_lib/defaults.js.
   config may include: name, teams, rounds, pool, matches, format. Picks and stats are cleared. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  const c = readBody(req).config || {};
  const state = structuredClone(DEFAULT_STATE);
  if (c.name) state.name = String(c.name).slice(0, 80);
  if (c.format) state.format = { ...state.format, ...c.format };
  if (c.teams) for (const t of ['a', 'b']) if (c.teams[t]) state.teams[t] = { id: t, name: String(c.teams[t].name || state.teams[t].name).slice(0, 40), captain: String(c.teams[t].captain || state.teams[t].captain).slice(0, 40) };
  if (Number(c.rounds) > 0) state.rounds = Math.min(10, Number(c.rounds));
  if (Array.isArray(c.pool) && c.pool.length) state.pool = c.pool.map(p => ({ id: String(p.id || p.name).toLowerCase().replace(/[^a-z0-9_]/g, ''), name: String(p.name).slice(0, 40), mains: String(p.mains || '').slice(0, 60) }));
  if (Array.isArray(c.matches) && c.matches.length) state.matches = c.matches.map(m => ({ map: String(m.map || 'Map').slice(0, 40), status: 'upcoming', score: [0, 0] }));
  await setState(state);
  json(res, 200, { ok: true, state });
}
