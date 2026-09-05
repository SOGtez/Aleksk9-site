import { Redis } from '@upstash/redis';
import { DEFAULT_STATE } from './defaults.js';

const KEY_STATE = 't:state';
const KEY_ROLES = 't:roles';

let client;
function redis() {
  if (!client) {
    if (!process.env.KV_REST_API_URL) throw new Error('KV_REST_API_URL is not set (add Upstash Redis in Vercel → Storage)');
    client = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  }
  return client;
}

export async function getState() {
  const s = await redis().get(KEY_STATE);
  return s || structuredClone(DEFAULT_STATE);
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
