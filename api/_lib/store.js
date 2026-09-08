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

const KEY_SETTINGS = 't:settings';
const KEY_APPS = 't:applications';
const KEY_OVERRIDE = 't:config_override';
const KEY_LOGINS = 'tw:logins';          /* hash login → { id, login, name, avatar, firstAt, lastAt, count, chat } */
const KEY_PLAYER_TWITCH = 't:player_twitch'; /* hash playerId/teamId → twitch login, set from the admin page */

export async function getState() {
  const s = await redis().get(KEY_STATE);
  /* Config (name, teams, pool, maps, rules…) comes from defaults.js so edits in code go live on deploy,
     unless an admin has built a tournament from applications (config override in the database).
     What people do on the site (picks, matches, stats) is always read from the database. */
  const state = structuredClone(DEFAULT_STATE);
  const ov = await redis().get(KEY_OVERRIDE);
  if (ov && Array.isArray(ov.teams) && ov.teams.length >= 2) {
    state.teams = ov.teams; state.pool = ov.pool || []; if (ov.tiers) state.tiers = ov.tiers; if (ov.name) state.name = ov.name;
    state.fromApplications = true;
  }
  /* Twitch logins linked to players from the admin page (pictures + captain roles follow). */
  const links = (await redis().hgetall(KEY_PLAYER_TWITCH)) || {};
  for (const p of state.pool) if (links[p.id]) p.twitch = links[p.id];
  for (const t of state.teams) if (links[t.id]) t.twitch = links[t.id];
  if (s && Array.isArray(s.teams)) {
    state.draft = { ...state.draft, ...(s.draft || {}) };
    state.eventAt = s.eventAt || ''; state.eventNote = s.eventNote || '';
    state.teamNames = s.teamNames && typeof s.teamNames === 'object' ? s.teamNames : {};
    for (const t of state.teams) if (state.teamNames[t.id]) t.name = String(state.teamNames[t.id]).slice(0, 32);
    state.picks = Array.isArray(s.picks) ? s.picks : [];
    state.matches = Array.isArray(s.matches) ? s.matches : [];
    state.stats = s.stats && typeof s.stats === 'object' ? s.stats : {};
    state.updatedAt = s.updatedAt || 0;
  }
  return state;
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
  /* Captains named in the active config (defaults.js, or the override built from applications) get their team's role. */
  const ov = await redis().get(KEY_OVERRIDE);
  const teams = ov && Array.isArray(ov.teams) && ov.teams.length >= 2 ? ov.teams : DEFAULT_STATE.teams;
  const links = (await redis().hgetall(KEY_PLAYER_TWITCH)) || {};
  const t = teams.find(t => (links[t.id] || t.twitch || '').toLowerCase() === login);
  if (t) return 'captain:' + t.id;
  if ((DEFAULT_STATE.helpers || []).some(h => h.toLowerCase() === login)) return 'helper';
  const roles = await getRoles();
  return roles[login] || 'viewer';
}

export async function cacheGet(key) { return redis().get(key); }
export async function cacheSet(key, value, ttlSeconds) { return redis().set(key, value, { ex: ttlSeconds }); }

/* ---------- Applications ---------- */
export const DEFAULT_SETTINGS = { open: true, captainsOpen: false, cap: 0, deadline: '', dates: [], note: '' };
export async function getSettings() { return { ...DEFAULT_SETTINGS, ...((await redis().get(KEY_SETTINGS)) || {}) }; }
export async function setSettings(patch) { const s = { ...(await getSettings()), ...patch }; await redis().set(KEY_SETTINGS, s); return s; }
export async function getApplications() { return (await redis().hgetall(KEY_APPS)) || {}; }
export async function getApplication(login) { return redis().hget(KEY_APPS, String(login).toLowerCase()); }
export async function setApplication(login, app) { return redis().hset(KEY_APPS, { [String(login).toLowerCase()]: app }); }
export async function deleteApplication(login) { return redis().hdel(KEY_APPS, String(login).toLowerCase()); }
export async function setConfigOverride(cfg) { return cfg ? redis().set(KEY_OVERRIDE, cfg) : redis().del(KEY_OVERRIDE); }
export async function getConfigOverride() { return redis().get(KEY_OVERRIDE); }

/* ---------- Twitch login log + player links ---------- */
export async function recordLogin(u, chat) {
  const key = u.login.toLowerCase();
  const prev = (await redis().hget(KEY_LOGINS, key)) || {};
  const now = Date.now();
  await redis().hset(KEY_LOGINS, { [key]: { id: u.id, login: key, name: u.name, avatar: u.avatar, firstAt: prev.firstAt || now, lastAt: now, count: (prev.count || 0) + 1, chat: !!(prev.chat || chat) } });
}
export async function getLogins() { return (await redis().hgetall(KEY_LOGINS)) || {}; }
export async function getPlayerLinks() { return (await redis().hgetall(KEY_PLAYER_TWITCH)) || {}; }
export async function setPlayerLink(playerId, login) {
  if (!login) return redis().hdel(KEY_PLAYER_TWITCH, playerId);
  return redis().hset(KEY_PLAYER_TWITCH, { [playerId]: String(login).toLowerCase() });
}
