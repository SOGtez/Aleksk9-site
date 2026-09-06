import { json, requireRole, readBody } from '../http.js';
import { getSettings, setSettings, getApplications, setApplication, deleteApplication, setConfigOverride, getConfigOverride, setState } from '../store.js';
import { DEFAULT_STATE } from '../defaults.js';
import { STATUSES, suggestTier, infoLine } from '../applications.js';

/* Admin only.
   GET  → { settings, applications: [...], override: bool }
   POST { action:'settings', open, cap, deadline, dates, note }
   POST { action:'review', login, status, tier, captain }
   POST { action:'delete', login }
   POST { action:'build', name?, captains?: [login in round-1 order] } → tournament from accepted applicants
   POST { action:'revert' } → back to the config in code */
export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (req.method === 'GET') {
    const apps = await getApplications();
    const list = Object.values(apps).sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0)).map(a => ({ ...a, suggestedTier: suggestTier(a) }));
    return json(res, 200, { settings: await getSettings(), applications: list, override: !!(await getConfigOverride()) });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);

  if (b.action === 'settings') {
    const patch = {};
    if (typeof b.open === 'boolean') patch.open = b.open;
    if (b.cap != null) patch.cap = Math.max(0, Math.min(200, Number(b.cap) || 0));
    if (b.deadline != null) patch.deadline = String(b.deadline).slice(0, 40);
    if (Array.isArray(b.dates)) patch.dates = b.dates.map(d => String(d).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
    if (b.note != null) patch.note = String(b.note).slice(0, 300);
    return json(res, 200, { ok: true, settings: await setSettings(patch) });
  }

  if (b.action === 'review' || b.action === 'delete') {
    const login = String(b.login || '').toLowerCase();
    const apps = await getApplications();
    const app = apps[login];
    if (!app) return json(res, 400, { error: 'Unknown applicant' });
    if (b.action === 'delete') { await deleteApplication(login); return json(res, 200, { ok: true }); }
    if (STATUSES.includes(b.status)) app.status = b.status;
    if (b.tier === null || b.tier === '') app.tier = null; else if (b.tier != null) app.tier = Math.max(0, Math.min(5, Number(b.tier) || 0));
    if (typeof b.captain === 'boolean') app.captainPick = b.captain;
    app.reviewedBy = me.user.login; app.reviewedAt = Date.now();
    await setApplication(login, app);
    return json(res, 200, { ok: true, application: app });
  }

  if (b.action === 'revert') {
    await setConfigOverride(null);
    return json(res, 200, { ok: true });
  }

  if (b.action === 'build') {
    const apps = Object.values(await getApplications()).filter(a => a.status === 'accepted');
    if (!apps.length) return json(res, 400, { error: 'No accepted applicants yet' });
    let captains = apps.filter(a => a.captainPick);
    if (Array.isArray(b.captains) && b.captains.length) {
      const order = b.captains.map(l => String(l).toLowerCase());
      captains = order.map(l => apps.find(a => a.login === l)).filter(Boolean);
    } else {
      captains.sort((x, y) => (x.hours || 0) - (y.hours || 0)); /* worst to best by hours */
    }
    if (captains.length < 2) return json(res, 400, { error: 'Mark at least two accepted applicants as captains first' });
    const capLogins = new Set(captains.map(c => c.login));
    const teams = captains.map(c => ({ id: c.login.replace(/[^a-z0-9_]/g, ''), name: 'Team ' + c.name, captain: c.name, info: infoLine(c), twitch: c.login }));
    const pool = apps.filter(a => !capLogins.has(a.login)).map(a => ({ id: a.login.replace(/[^a-z0-9_]/g, ''), name: a.name, tier: a.tier == null ? suggestTier(a) : a.tier, info: infoLine(a), twitch: a.login }));
    const cfg = { teams, pool, tiers: DEFAULT_STATE.tiers, name: b.name ? String(b.name).slice(0, 80) : DEFAULT_STATE.name, builtAt: Date.now(), by: me.user.login };
    await setConfigOverride(cfg);
    /* A new roster means a fresh draft: clear picks, matches, stats. */
    await setState({ ...structuredClone(DEFAULT_STATE), teams, pool, tiers: cfg.tiers, name: cfg.name });
    return json(res, 200, { ok: true, teams: teams.length, pool: pool.length });
  }

  json(res, 400, { error: 'Unknown action' });
}
