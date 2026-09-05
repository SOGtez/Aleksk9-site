import crypto from 'node:crypto';

const COOKIE = 'ak9_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}
function b64u(buf) { return Buffer.from(buf).toString('base64url'); }
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.exp && p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

export function cookieHeader(name, value, opts = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV !== 'development') parts.push('Secure');
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join('; ');
}

export function setSession(res, user) {
  const token = sign({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  res.setHeader('Set-Cookie', cookieHeader(COOKIE, token, { maxAge: MAX_AGE }));
}
export function clearSession(res) {
  res.setHeader('Set-Cookie', cookieHeader(COOKIE, '', { maxAge: 0 }));
}
export function getSession(req) {
  return verify(req.cookies?.[COOKIE]);
}
export function randomState() { return crypto.randomBytes(16).toString('hex'); }
