import { json, requireRole, readBody } from '../http.js';
import { getApplication, setApplication } from '../store.js';
import { lookup, session } from '../ubi.js';

/* POST { login }                 → look up the applicant's Ubisoft stats, store on the application as `verified`
   POST { name, platform }        → ad-hoc lookup (no storage)
   POST { action:'relogin' }      → force a fresh Ubisoft session
   Admin only. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  const b = readBody(req);
  try {
    if (b.action === 'relogin') { await session(true); return json(res, 200, { ok: true }); }
    if (b.login) {
      const app = await getApplication(String(b.login).toLowerCase());
      if (!app) return json(res, 400, { error: 'Unknown applicant' });
      if (!app.ign || !app.platform) return json(res, 400, { error: 'Application has no in-game name or platform' });
      const v = await lookup(app.ign, app.platform);
      app.verified = v;
      await setApplication(app.login, app);
      return json(res, 200, { ok: true, verified: v });
    }
    if (b.name && b.platform) return json(res, 200, { ok: true, verified: await lookup(String(b.name), String(b.platform)) });
    return json(res, 400, { error: 'Send { login } or { name, platform }' });
  } catch (e) {
    return json(res, 502, { error: e.message, step: e.step || 'unknown' });
  }
}
