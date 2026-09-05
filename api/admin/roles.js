import { json, requireRole, readBody } from '../_lib/http.js';
import { getRoles, setRole } from '../_lib/store.js';

/* GET  → { roles: { login: role } }
   POST { login, role } — role '' or null removes. Admin only. */
export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (req.method === 'GET') return json(res, 200, { roles: await getRoles(), alwaysAdmin: (process.env.ADMIN_LOGINS || '').split(',').map(s => s.trim()).filter(Boolean) });
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);
  const role = b.role || null;
  if (role && !['captain-a', 'captain-b', 'helper', 'admin'].includes(role)) return json(res, 400, { error: 'Bad role' });
  if (!b.login) return json(res, 400, { error: 'login required' });
  await setRole(b.login, role);
  json(res, 200, { ok: true, roles: await getRoles() });
}
