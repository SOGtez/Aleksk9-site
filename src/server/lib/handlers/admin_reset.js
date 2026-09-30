import { json, requireRole } from '../http.js';
import { setState } from '../store.js';
import { DEFAULT_STATE } from '../defaults.js';

/* POST — admin only. Clears all picks, matches, and stats.
   Teams, players, maps, and rules always come from api/_lib/defaults.js; edit that file to change them. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  const state = structuredClone(DEFAULT_STATE);
  await setState(state);
  json(res, 200, { ok: true, state });
}
