import { json, requireRole } from '../_lib/http.js';
import { setState } from '../_lib/store.js';
import { DEFAULT_STATE } from '../_lib/defaults.js';

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
