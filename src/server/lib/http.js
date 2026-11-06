import { getSession } from './session.js';
import { roleFor, withSpace } from './store.js';
import { CHANNEL_LOGIN } from './twitch.js';
import { DEFAULT_STATE } from './defaults.js';
import { logActivity } from './activity.js';

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
  /* The channel's own account cannot follow itself, so it always counts as a follower (awards, applications). */
  const follows = !!user?.follows || (user?.login || '').toLowerCase() === CHANNEL_LOGIN;
  /* `awards`: may see the AK9 Awards behind the scenes. Admins and the AK9 Awards role, minus defaults.js awardsBlocked. */
  const blocked = (DEFAULT_STATE.awardsBlocked || []).some(b => b.toLowerCase() === (user?.login || '').toLowerCase());
  const awards = !!user && (role === 'admin' || role === 'awards') && !blocked;
  const owner = !!user && (DEFAULT_STATE.owners || []).some(o => o.toLowerCase() === user.login.toLowerCase());
  return { user: user ? { id: user.id, login: user.login, name: user.name, avatar: user.avatar, follows, followedAt: user.followedAt || '', followChecked: user.followChecked || 0 } : null, role, awards, owner };
}
export async function requireRole(req, res, allowed) {
  const me = await whoami(req);
  if (!me.user) { json(res, 401, { error: 'Log in with Twitch first' }); return null; }
  const ok = allowed.includes(me.role) || (allowed.includes('captain') && me.role.startsWith('captain:'));
  const path = String(req.url || '').split('?')[0];
  if (!ok) { await logActivity(req, me, 'refused', `${req.method} ${path}`, { once: 600, onceKey: path }); json(res, 403, { error: 'You do not have permission to do that' }); return null; }
  /* Activity log: opening a protected area once per half hour, and every change with its main fields. */
  if (req.method === 'GET') await logActivity(req, me, 'opened', path, { once: 1800, onceKey: path });
  else await logActivity(req, me, 'change', `${path} ${summary(readBody(req))}`.trim());
  return me;
}
function summary(b) {
  return ['action', 'login', 'role', 'playerId', 'team', 'id', 'status', 'theme'].filter(k => b && b[k] != null && typeof b[k] !== 'object').map(k => `${k}=${String(b[k]).slice(0, 40)}`).join(' ');
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
