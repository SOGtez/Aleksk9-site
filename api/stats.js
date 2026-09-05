import { json, requireRole, readBody } from './_lib/http.js';
import { getState, setState } from './_lib/store.js';

/* POST { player, kills, deaths, assists }  or  POST { bulk: { playerId: [k,d,a], ... } } — helper or admin */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['helper', 'admin']);
  if (!me) return;
  const b = readBody(req);
  const state = await getState();
  const valid = new Set(state.pool.map(p => p.id).concat(['a', 'b'].map(t => state.teams[t].captain.toLowerCase())));
  const clean = v => Math.max(0, Math.min(999, Number(v) || 0));

  if (b.bulk && typeof b.bulk === 'object') {
    for (const [pid, arr] of Object.entries(b.bulk)) {
      if (!valid.has(pid) || !Array.isArray(arr)) continue;
      state.stats[pid] = [clean(arr[0]), clean(arr[1]), clean(arr[2])];
    }
  } else {
    const pid = String(b.player || '');
    if (!valid.has(pid)) return json(res, 400, { error: 'Unknown player' });
    state.stats[pid] = [clean(b.kills), clean(b.deaths), clean(b.assists)];
  }
  await setState(state);
  json(res, 200, { ok: true, stats: state.stats });
}
