import { Redis } from '@upstash/redis';
import { DEFAULT_STATE } from './defaults.js';

const KEY_STATE = 't:state';
const KEY_ROLES = 't:roles';

let client;
function redis() {
  if (!client) {
    /* Vercel's Upstash integration uses KV_REST_API_*; Upstash's own console uses UPSTASH_REDIS_REST_*. Accept either. */
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Redis env vars missing (add Upstash Redis in Vercel → Storage and redeploy)');
    client = new Redis({ url, token });
  }
  return client;
}

export async function getState() {
  const s = await redis().get(KEY_STATE);
  /* No state yet, or state from the old 2-team shape → start from the current defaults. */
  if (!s || !Array.isArray(s.teams)) return structuredClone(DEFAULT_STATE);
  return s;
}
export async function setState(state) {
  state.updatedAt = Date.now();
  await redis().set(KEY_STATE, state);
  return state;
}

/* Roles: { twitchLogin: 'captain-a' | 'captain-b' | 'helper' | 'admin' } */
export async function getRoles() {
  const r = await redis().hgetall(KEY_ROLES);
  return r || {};
}
export async function setRole(login, role) {
  login = String(login).toLowerCase().replace(/^@/, '');
  if (!role) return redis().hdel(KEY_ROLES, login);
  return redis().hset(KEY_ROLES, { [login]: role });
}
export async function roleFor(login) {
  if (!login) return 'viewer';
  login = login.toLowerCase();
  const admins = (process.env.ADMIN_LOGINS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (admins.includes(login)) return 'admin';
  const roles = await getRoles();
  return roles[login] || 'viewer';
}

export async function cacheGet(key) { return redis().get(key); }
export async function cacheSet(key, value, ttlSeconds) { return redis().set(key, value, { ex: ttlSeconds }); }
