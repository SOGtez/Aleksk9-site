import { json, requireRole, readBody } from './_lib/http.js';
import { getState, setState } from './_lib/store.js';
import { nextSlot } from './_lib/defaults.js';

/* POST { action: 'pick', player } — captain on the clock, or admin
   POST { action: 'undo' | 'reset' } — admin only */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['captain', 'admin']);
  if (!me) return;
  const body = readBody(req);
  const state = await getState();

  if (body.action === 'undo' || body.action === 'reset') {
    if (me.role !== 'admin') return json(res, 403, { error: 'Admins only' });
    if (body.action === 'undo') state.picks.pop(); else state.picks = [];
    await setState(state);
    return json(res, 200, { ok: true, picks: state.picks, next: nextSlot(state) });
  }

  const slot = nextSlot(state);
  if (!slot) return json(res, 409, { error: 'The draft is already complete' });
  const myTeam = me.role.startsWith('captain:') ? me.role.slice(8) : null;
  const onClock = state.teams.find(t => t.id === slot.team);
  if (me.role !== 'admin' && myTeam !== slot.team) return json(res, 409, { error: `It is ${onClock.captain}'s pick, not yours` });

  const pid = String(body.player || '');
  if (!state.pool.some(p => p.id === pid)) return json(res, 400, { error: 'Unknown player' });
  if (state.picks.some(p => p.player === pid)) return json(res, 409, { error: 'That player is already drafted' });

  state.picks.push({ team: slot.team, player: pid, by: me.user.login, at: Date.now() });
  await setState(state);
  json(res, 200, { ok: true, pick: state.picks[state.picks.length - 1], next: nextSlot(state) });
}
