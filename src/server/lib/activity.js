import crypto from 'node:crypto';
import { hasDatabase, pushActivity, onceEvery, setSeen } from './store.js';

/* Activity log for the admin page (Twitch logins tab): who did what, from which browser and roughly where.
   `dev` is a random id kept in the ak9_dev cookie (set at login), so two accounts used in the same browser
   share it. Older sessions without the cookie get "~" + a hash of IP and browser instead. `net` is a hash of
   the internet connection (the IP address itself is never stored), so accounts on the same Wi-Fi share it.
   Logging never throws or blocks the request it describes. */
export const DEVICE_COOKIE = 'ak9_dev';

function device(ua) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' on ') || 'Unknown';
}
/* The site runs behind Cloudflare, so Vercel's own location headers describe Cloudflare's server (everyone came out
   as New Haven, CT). Behind Cloudflare use its visitor headers: cf-ipcountry always, and cf-ipcity / cf-region-code
   once "Add visitor location headers" is on (Cloudflare → Rules → Transform Rules → Managed Transforms). */
function place(h) {
  const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); } };
  if (h['cf-connecting-ip']) {
    const c = h['cf-ipcountry'] && !['XX', 'T1'].includes(h['cf-ipcountry']) ? h['cf-ipcountry'] : '';
    return [dec(h['cf-ipcity']), h['cf-region-code'], c].filter(Boolean).join(', ');
  }
  return [dec(h['x-vercel-ip-city']), h['x-vercel-ip-country-region'], h['x-vercel-ip-country']].filter(Boolean).join(', ');
}
export function deviceId(req) {
  const c = req.cookies?.[DEVICE_COOKIE];
  if (c && /^[a-z0-9]{6,16}$/i.test(c)) return c;
  const ip = ipOf(req);
  return '~~' + crypto.createHash('sha256').update((process.env.SESSION_SECRET || '') + ip + (req.headers['user-agent'] || '')).digest('hex').slice(0, 7);
}
/* The visitor's address: Cloudflare's header first (x-forwarded-for is Cloudflare's own server, the same for everyone). */
const ipOf = (req) => String(req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0]).trim();
/* 'c' ids are real connections. Ids logged before Nov 6 2026 start with 'n' and were Cloudflare's server for everyone,
   so they never link accounts (OLD_NET). */
export const OLD_NET = (net) => typeof net === 'string' && net[0] === 'n';
/* Same for browser ids guessed without a cookie: before the fix they were '~' + hash of Cloudflare's address; now '~~'. */
export const OLD_DEV = (dev) => typeof dev === 'string' && dev[0] === '~' && dev[1] !== '~';
export function netId(req) {
  const ip = ipOf(req);
  return ip ? 'c' + crypto.createHash('sha256').update('net' + (process.env.SESSION_SECRET || '') + ip).digest('hex').slice(0, 7) : '';
}
/* Last seen: at most one write per account per 5 minutes. */
export async function touchSeen(req, me) {
  try {
    const login = me?.user?.login;
    if (!login || !hasDatabase() || !(await onceEvery('seen:' + login, 300))) return;
    await setSeen(login, { at: Date.now(), dev: deviceId(req), net: netId(req), device: device(String(req.headers['user-agent'] || '')), where: place(req.headers) });
  } catch { /* never block the request */ }
}
export function newDeviceId() { return crypto.randomBytes(5).toString('hex'); }

/* who: { login, name, role } (or a whoami() result). opts.once = seconds: log this action (with these details,
   or opts.onceKey) for this person at most once per window. */
export async function logActivity(req, who, action, detail = '', opts = {}) {
  try {
    if (!hasDatabase()) return;
    const u = who?.user || who || {};
    const login = String(u.login || '').toLowerCase();
    const dev = opts.dev || deviceId(req);
    if (opts.once && !(await onceEvery(`${action}:${login || dev}:${opts.onceKey || detail || ''}`, opts.once))) return;
    let from = '';
    try { from = new URL(req.headers.referer || '').pathname; } catch { /* none */ }
    await pushActivity({
      at: Date.now(), login, name: u.name || login, role: who?.role || u.role || '',
      action, detail: String(detail || '').slice(0, 200), from,
      dev, net: netId(req), device: device(String(req.headers['user-agent'] || '')), where: place(req.headers),
    });
  } catch { /* never block the request */ }
}
