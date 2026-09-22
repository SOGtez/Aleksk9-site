import { Redis } from '@upstash/redis';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DEFAULT_STATE } from './defaults.js';

/* ---------- Spaces ----------
   Tournament data lives in a "space": '' is the live tournament, 'test' is a sandbox that the admin page
   and the AI assistant can work in without touching what the public sees. The test tournament is shown
   at /tournament-test. Only tournament data is per space: state, config override, applications, settings.
   Roles, Twitch logins, player links and caches are shared. */
export const SPACES = ['', 'test'];
const als = new AsyncLocalStorage();
export function withSpace(space, fn) { return als.run({ space: SPACES.includes(space) ? space : '' }, fn); }
export function currentSpace() { return (als.getStore() || {}).space || ''; }
/* Change the space for the rest of the current request (used by the assistant's switch_mode tool). */
export function setCurrentSpace(space) { const s = als.getStore(); if (s) s.space = SPACES.includes(space) ? space : ''; }
const spaced = (key, space) => ((space === undefined ? currentSpace() : space) === 'test' ? 'test:' : '') + key;

const KEY_STATE = 't:state';
const KEY_ROLES = 't:roles';
export const FORMAT_KEYS = ['name', 'game', 'hosts', 'format', 'rules', 'maps', 'tiers', 'quota', 'rounds'];

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
  const s = await redis().get(spaced(KEY_STATE));
  /* Config (name, teams, pool, maps, rules…) comes from defaults.js so edits in code go live on deploy,
     unless an admin has built a tournament from applications (config override in the database).
     What people do on the site (picks, matches, stats) is always read from the database. */
  const state = structuredClone(DEFAULT_STATE);
  const ov = await redis().get(spaced(KEY_OVERRIDE));
  if (ov && typeof ov === 'object') {
    if (Array.isArray(ov.teams) && ov.teams.length >= 2) { state.teams = ov.teams; state.pool = ov.pool || []; state.fromApplications = true; }
    /* Format set from the admin page or the assistant (game, tiers, maps, rules…) overrides the code defaults. */
    for (const k of ['name', 'game', 'hosts', 'rules', 'maps', 'tiers', 'quota', 'rounds']) if (ov[k] !== undefined && ov[k] !== null) state[k] = ov[k];
    if (ov.format && typeof ov.format === 'object') state.format = { ...state.format, ...ov.format };
    state.formatSet = FORMAT_KEYS.some(k => ov[k] !== undefined && ov[k] !== null);
  }
  for (const p of state.pool) if ((p.tier || 0) > state.tiers.length - 1) p.tier = state.tiers.length - 1;
  /* Twitch logins linked to players from the admin page (pictures + captain roles follow). */
  const links = (await redis().hgetall(KEY_PLAYER_TWITCH)) || {};
  for (const p of state.pool) if (links[p.id]) p.twitch = links[p.id];
  for (const t of state.teams) if (links[t.id]) t.twitch = links[t.id];
  if (s && Array.isArray(s.teams)) {
    state.draft = { ...state.draft, ...(s.draft || {}) };
    if (s.eventAt !== undefined && s.eventSet) { state.eventAt = s.eventAt; state.eventNote = s.eventNote || ''; } /* admin-set date wins; otherwise the code default */
    state.teamNames = s.teamNames && typeof s.teamNames === 'object' ? s.teamNames : {};
    /* Admin-set round-1 order: listed teams first in that order, any team not listed keeps its place after them. */
    state.teamOrder = Array.isArray(s.teamOrder) ? s.teamOrder.filter(id => state.teams.some(t => t.id === id)) : [];
    if (state.teamOrder.length) state.teams = state.teamOrder.map(id => state.teams.find(t => t.id === id)).concat(state.teams.filter(t => !state.teamOrder.includes(t.id)));
    for (const t of state.teams) if (state.teamNames[t.id]) t.name = String(state.teamNames[t.id]).slice(0, 32);
    /* Picks that point at a team or player no longer in the config (pool was changed in code) are dropped. */
    const teamIds = new Set(state.teams.map(t => t.id)), poolIds = new Set(state.pool.map(p => p.id));
    state.picks = (Array.isArray(s.picks) ? s.picks : []).filter(p => teamIds.has(p.team) && poolIds.has(p.player));
    state.matches = Array.isArray(s.matches) ? s.matches : [];
    state.stats = s.stats && typeof s.stats === 'object' ? s.stats : {};
    state.updatedAt = s.updatedAt || 0;
  }
  return state;
}
export async function setState(state) {
  state.updatedAt = Date.now();
  await redis().set(spaced(KEY_STATE), state);
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
  if (admins.includes(login) || (DEFAULT_STATE.admins || []).some(a => a.toLowerCase() === login)) return 'admin';
  /* Captains named in the active config (defaults.js, or the override built from applications) get their team's role. */
  const ov = await redis().get(spaced(KEY_OVERRIDE));
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
/* Shared counters (e.g. the AI monthly usage). Returns the new value. */
export async function counterIncr(key, ttlSeconds) { const n = await redis().incr(key); if (n === 1 && ttlSeconds) await redis().expire(key, ttlSeconds); return n; }
export async function counterGet(key) { return Number(await redis().get(key)) || 0; }
export async function counterDecr(key) { const n = await redis().decr(key); if (n < 0) await redis().set(key, 0); return Math.max(0, n); }
export async function counterReset(key) { return redis().del(key); }

/* ---------- Applications ---------- */
export const DEFAULT_SETTINGS = { open: false, captainsOpen: false, cap: 0, deadline: '', dates: [], note: '' };
export async function getSettings() { return { ...DEFAULT_SETTINGS, ...((await redis().get(spaced(KEY_SETTINGS))) || {}) }; }
export async function setSettings(patch) { const s = { ...(await getSettings()), ...patch }; await redis().set(spaced(KEY_SETTINGS), s); return s; }
export async function getApplications() { return (await redis().hgetall(spaced(KEY_APPS))) || {}; }
export async function getApplication(login) { return redis().hget(spaced(KEY_APPS), String(login).toLowerCase()); }
export async function setApplication(login, app) { return redis().hset(spaced(KEY_APPS), { [String(login).toLowerCase()]: app }); }
export async function deleteApplication(login) { return redis().hdel(spaced(KEY_APPS), String(login).toLowerCase()); }
export async function setConfigOverride(cfg) { return cfg ? redis().set(spaced(KEY_OVERRIDE), cfg) : redis().del(spaced(KEY_OVERRIDE)); }
export async function getConfigOverride() { return redis().get(spaced(KEY_OVERRIDE)); }

/* Copy one space's tournament data over another's (live → test to seed a rehearsal, test → live to promote). */
const SPACE_KEYS = [KEY_STATE, KEY_OVERRIDE, KEY_APPS, KEY_SETTINGS];
export async function copySpace(from, to) {
  if (!SPACES.includes(from) || !SPACES.includes(to) || from === to) throw new Error('Bad space copy');
  for (const k of SPACE_KEYS) {
    const isHash = k === KEY_APPS;
    const v = isHash ? await redis().hgetall(spaced(k, from)) : await redis().get(spaced(k, from));
    await redis().del(spaced(k, to));
    if (v && (!isHash || Object.keys(v).length)) { if (isHash) await redis().hset(spaced(k, to), v); else await redis().set(spaced(k, to), v); }
  }
}
export async function clearSpace(space) {
  if (space !== 'test') throw new Error('Only the test space can be cleared this way');
  for (const k of SPACE_KEYS) await redis().del(spaced(k, space));
}
export async function spaceHasData(space) {
  for (const k of SPACE_KEYS) if (await redis().exists(spaced(k, space))) return true;
  return false;
}

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
