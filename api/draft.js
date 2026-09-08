import { json, requireRole, readBody } from './_lib/http.js';
import { getState, setState } from './_lib/store.js';
import { nextSlot } from './_lib/defaults.js';

/* POST { action:'pick', player }        — captain on the clock (draft must be open), or admin
   POST { action:'rename', name, teamId? } — captain renames own team; admin any team
   Admin only:
   POST { action:'open' | 'close' }       — open/close the draft (open also starts the clock)
   POST { action:'skip' }                 — auto-pick for the captain on the clock (best available)
   POST { action:'clock', seconds }       — seconds per pick
   POST { action:'event', eventAt, eventNote } — event date/time shown on the page
   POST { action:'undo' | 'reset' } */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['captain', 'admin']);
  if (!me) return;
  const body = readBody(req);
  const state = await getState();
  const isAdmin = me.role === 'admin';
  const myTeam = me.role.startsWith('captain:') ? me.role.slice(8) : null;

  if (body.action === 'rename') {
    const tid = isAdmin && body.teamId ? String(body.teamId) : myTeam;
    if (!tid || !state.teams.some(t => t.id === tid)) return json(res, 403, { error: 'You can only rename your own team' });
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    if (!name) delete state.teamNames[tid]; else state.teamNames[tid] = name;
    await setState(state);
    return json(res, 200, { ok: true, name: name || null });
  }

  if (['open', 'close', 'skip', 'clock', 'event', 'undo', 'reset'].includes(body.action)) {
    if (!isAdmin) return json(res, 403, { error: 'Admins only' });
    if (body.action === 'open') { state.draft.open = true; state.draft.turnStartedAt = Date.now(); }
    if (body.action === 'close') state.draft.open = false;
    if (body.action === 'clock') state.draft.pickSeconds = Math.max(15, Math.min(600, Number(body.seconds) || 90));
    if (body.action === 'event') { state.eventAt = body.eventAt ? String(body.eventAt).slice(0, 40) : ''; state.eventNote = String(body.eventNote || '').slice(0, 120); }
    if (body.action === 'undo') { state.picks.pop(); state.draft.turnStartedAt = Date.now(); }
    if (body.action === 'reset') { state.picks = []; state.draft.turnStartedAt = Date.now(); }
    if (body.action === 'skip') {
      const slot = nextSlot(state);
      if (!slot) return json(res, 409, { error: 'The draft is already complete' });
      const taken = new Set(state.picks.map(p => p.player));
      const best = state.pool.slice().sort((a, b) => (a.tier || 0) - (b.tier || 0)).find(p => !taken.has(p.id));
      if (!best) return json(res, 409, { error: 'No players left' });
      state.picks.push({ team: slot.team, player: best.id, by: me.user.login, at: Date.now(), auto: true });
      state.draft.turnStartedAt = Date.now();
    }
    await setState(state);
    return json(res, 200, { ok: true, draft: state.draft, picks: state.picks, next: nextSlot(state), eventAt: state.eventAt });
  }

  /* pick */
  const slot = nextSlot(state);
  if (!slot) return json(res, 409, { error: 'The draft is already complete' });
  if (!state.draft.open && !isAdmin) return json(res, 409, { error: 'The draft has not been opened yet' });
  const onClock = state.teams.find(t => t.id === slot.team);
  if (!isAdmin && myTeam !== slot.team) return json(res, 409, { error: `It is ${onClock.captain}'s pick, not yours` });
  const pid = String(body.player || '');
  if (!state.pool.some(p => p.id === pid)) return json(res, 400, { error: 'Unknown player' });
  if (state.picks.some(p => p.player === pid)) return json(res, 409, { error: 'That player is already drafted' });
  state.picks.push({ team: slot.team, player: pid, by: me.user.login, at: Date.now() });
  state.draft.turnStartedAt = Date.now();
  await setState(state);
  json(res, 200, { ok: true, pick: state.picks[state.picks.length - 1], next: nextSlot(state) });
}
