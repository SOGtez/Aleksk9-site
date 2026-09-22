import { getSession } from './session.js';
import { roleFor, withSpace } from './store.js';

export function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
export function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}`;
}
/* Returns { user, role }. user is null when logged out. */
export async function whoami(req) {
  const user = getSession(req);
  const role = await roleFor(user?.login);
  return { user: user ? { id: user.id, login: user.login, name: user.name, avatar: user.avatar, follows: !!user.follows, followedAt: user.followedAt || '', followChecked: user.followChecked || 0 } : null, role };
}
export async function requireRole(req, res, allowed) {
  const me = await whoami(req);
  if (!me.user) { json(res, 401, { error: 'Log in with Twitch first' }); return null; }
  const ok = allowed.includes(me.role) || (allowed.includes('captain') && me.role.startsWith('captain:'));
  if (!ok) { json(res, 403, { error: 'You do not have permission to do that' }); return null; }
  return me;
}
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

/* Space for this request: ?space=test (or the JSON body's `space`) selects the sandbox tournament. */
export function spaceOf(req) {
  const q = req.query && req.query.space;
  const b = req.body && typeof req.body === 'object' ? req.body.space : undefined;
  return String(q || b || '') === 'test' ? 'test' : '';
}
/* Wrap a handler so every store call inside it targets the requested space. */
export function spaced(handler) {
  return (req, res) => withSpace(spaceOf(req), () => handler(req, res));
}
