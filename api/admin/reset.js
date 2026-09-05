import { json, requireRole, readBody } from '../_lib/http.js';
import { setState } from '../_lib/store.js';
import { DEFAULT_STATE } from '../_lib/defaults.js';

/* POST { config? } — admin only. Replaces the whole tournament.
   With no config, restores api/_lib/defaults.js. Picks, matches, and stats are cleared. */
const slug = v => String(v || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  const c = readBody(req).config || {};
  const state = structuredClone(DEFAULT_STATE);
  if (c.name) state.name = String(c.name).slice(0, 80);
  if (Array.isArray(c.hosts)) state.hosts = c.hosts.map(h => String(h).slice(0, 40));
  if (c.format) state.format = { ...state.format, ...c.format };
  if (Array.isArray(c.rules)) state.rules = c.rules.map(r => String(r).slice(0, 200));
  if (Array.isArray(c.maps) && c.maps.length) state.maps = c.maps.map(m => String(m).slice(0, 40));
  if (Array.isArray(c.tiers)) state.tiers = c.tiers.map(t => String(t).slice(0, 30));
  if (Array.isArray(c.teams) && c.teams.length >= 2) state.teams = c.teams.map(t => ({ id: slug(t.id || t.captain), name: String(t.name || 'Team ' + t.captain).slice(0, 40), captain: String(t.captain).slice(0, 40), info: String(t.info || '').slice(0, 80) }));
  if (Number(c.rounds) > 0) state.rounds = Math.min(10, Number(c.rounds));
  if (Array.isArray(c.pool) && c.pool.length) state.pool = c.pool.map(p => ({ id: slug(p.id || p.name), name: String(p.name).slice(0, 40), tier: Math.max(0, Number(p.tier) || 0), info: String(p.info || '').slice(0, 80) }));
  await setState(state);
  json(res, 200, { ok: true, state });
}
