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
/* The address people actually see. aleksk9.com goes through Cloudflare and an nginx proxy to Vercel, so the
   Host header here is still the vercel.app one. Trust the page that sent them (Referer) when it is one of our
   domains; otherwise a Cloudflare header means the request came in through aleksk9.com. */
export const PUBLIC_HOSTS = ['aleksk9.com', 'www.aleksk9.com', 'aleksk9-website.vercel.app'];
export function publicBase(req) {
  try {
    const ref = new URL(req.headers.referer || '');
    if (PUBLIC_HOSTS.includes(ref.host)) return `https://${ref.host === 'www.aleksk9.com' ? 'aleksk9.com' : ref.host}`;
  } catch { /* no referer */ }
  if (req.headers['cf-ray'] || req.headers['cf-connecting-ip']) return 'https://aleksk9.com';
  return baseUrl(req);
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
