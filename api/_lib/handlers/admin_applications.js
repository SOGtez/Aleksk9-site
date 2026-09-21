import { json, requireRole, readBody } from '../http.js';
import { getSettings, getApplications, deleteApplication, setConfigOverride, getConfigOverride, getState, getLogins, getPlayerLinks, setPlayerLink } from '../store.js';
import { suggestTier } from '../applications.js';
import { updateSettings, reviewApplicant, addAcceptedToPool, buildTournament } from '../actions.js';

/* Admin only.
   GET  → { settings, applications: [...], override: bool }
   POST { action:'settings', open, cap, deadline, dates, note }
   POST { action:'review', login, status, tier, captain }
   POST { action:'delete', login }
   POST { action:'build', name?, captains?: [login in round-1 order] } → tournament from accepted applicants
   POST { action:'addToPool' } → add accepted applicants to the CURRENT pool, draft untouched
   POST { action:'revert' } → back to the config in code */
export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (req.method === 'GET') {
    const apps = await getApplications();
    const list = Object.values(apps).sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0)).map(a => ({ ...a, suggestedTier: suggestTier(a) }));
    const logins = Object.values(await getLogins()).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    return json(res, 200, { settings: await getSettings(), applications: list, override: !!(await getConfigOverride()), logins, links: await getPlayerLinks() });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);

  if (b.action === 'settings') return json(res, 200, { ok: true, settings: await updateSettings(b) });

  if (b.action === 'review' || b.action === 'delete') {
    const login = String(b.login || '').toLowerCase();
    if (b.action === 'delete') { if (!(await getApplications())[login]) return json(res, 400, { error: 'Unknown applicant' }); await deleteApplication(login); return json(res, 200, { ok: true }); }
    try { return json(res, 200, { ok: true, application: await reviewApplicant(login, b, me.user.login) }); }
    catch (e) { return json(res, e.status || 500, { error: e.message }); }
  }

  if (b.action === 'addToPool') {
    try { return json(res, 200, { ok: true, ...(await addAcceptedToPool(me.user.login)) }); }
    catch (e) { return json(res, e.status || 500, { error: e.message }); }
  }

  if (b.action === 'link') {
    const state = await getState();
    const pid = String(b.playerId || '');
    if (!state.pool.some(p => p.id === pid) && !state.teams.some(t => t.id === pid)) return json(res, 400, { error: 'Unknown player' });
    await setPlayerLink(pid, b.login ? String(b.login).toLowerCase().replace(/^@/, '') : null);
    return json(res, 200, { ok: true, links: await getPlayerLinks() });
  }

  if (b.action === 'revert') {
    await setConfigOverride(null);
    return json(res, 200, { ok: true });
  }

  if (b.action === 'build') {
    try { return json(res, 200, { ok: true, ...(await buildTournament(b, me.user.login)) }); }
    catch (e) { return json(res, e.status || 500, { error: e.message }); }
  }

  json(res, 400, { error: 'Unknown action' });
}
