/* Admin actions shared by the admin buttons and the AI assistant, so both run the same code.
   Each returns a plain result or throws an Error with `.status` set to the HTTP code the caller should send. */
import { getState, setState, getSettings, setSettings, getApplications, setApplication, setConfigOverride, getConfigOverride } from './store.js';
import { DEFAULT_STATE } from './defaults.js';
import { STATUSES, suggestTier, infoLine } from './applications.js';

const fail = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

/* ---------- Applications ---------- */
export async function updateSettings(b) {
  const patch = {};
  if (typeof b.open === 'boolean') patch.open = b.open;
  if (typeof b.captainsOpen === 'boolean') patch.captainsOpen = b.captainsOpen;
  if (b.cap != null) patch.cap = Math.max(0, Math.min(200, Number(b.cap) || 0));
  if (b.deadline != null) patch.deadline = String(b.deadline).slice(0, 40);
  if (Array.isArray(b.dates)) patch.dates = b.dates.map(d => String(d).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  if (b.note != null) patch.note = String(b.note).slice(0, 300);
  return setSettings(patch);
}

/* Set status, tier, captain tick on one application. Unspecified fields are left alone. */
export async function reviewApplicant(login, b, by, apps) {
  login = String(login || '').toLowerCase();
  apps = apps || await getApplications();
  const app = apps[login];
  if (!app) throw fail(400, 'Unknown applicant: ' + login);
  if (b.status != null) { if (!STATUSES.includes(b.status)) throw fail(400, 'Bad status: ' + b.status); app.status = b.status; }
  if (b.tier === null || b.tier === '') app.tier = null; else if (b.tier != null) app.tier = Math.max(0, Math.min(5, Number(b.tier) || 0));
  if (typeof b.captain === 'boolean') app.captainPick = b.captain;
  app.reviewedBy = by; app.reviewedAt = Date.now();
  await setApplication(login, app);
  return app;
}

export async function addAcceptedToPool(by) {
  const state = await getState();
  const taken = new Set(state.teams.map(t => (t.twitch || '').toLowerCase()).concat(state.pool.map(p => (p.twitch || '').toLowerCase())).filter(Boolean));
  const ids = new Set(state.teams.map(t => t.id).concat(state.pool.map(p => p.id)));
  const fresh = Object.values(await getApplications()).filter(a => a.status === 'accepted' && !taken.has(a.login));
  if (!fresh.length) throw fail(400, 'No accepted applicants that are not already in the tournament');
  const added = fresh.map(a => {
    let id = a.login.replace(/[^a-z0-9_]/g, '') || 'p'; while (ids.has(id)) id += '_'; ids.add(id);
    return { id, name: a.name, tier: a.tier == null ? suggestTier(a) : a.tier, info: infoLine(a), twitch: a.login };
  });
  const cfg = { ...((await getConfigOverride()) || {}), teams: state.teams.map(({ avatar, ...t }) => t), pool: state.pool.map(({ avatar, ...p }) => p).concat(added), tiers: state.tiers, name: state.name, builtAt: Date.now(), by, addedFromApplications: true };
  await setConfigOverride(cfg);
  return { added: added.map(a => a.name), pool: cfg.pool.length };
}

/* Work out the teams and pool a build would create, without saving anything.
   captains: logins in round-1 order; empty → every accepted applicant ticked as captain, worst to best by hours. */
export async function planBuild(b) {
  const apps = Object.values(await getApplications()).filter(a => a.status === 'accepted');
  if (!apps.length) throw fail(400, 'No accepted applicants yet');
  let captains = apps.filter(a => a.captainPick);
  if (Array.isArray(b.captains) && b.captains.length) {
    const order = b.captains.map(l => String(l).toLowerCase());
    const missing = order.filter(l => !apps.some(a => a.login === l));
    if (missing.length) throw fail(400, 'Not accepted applicants: ' + missing.join(', '));
    captains = order.map(l => apps.find(a => a.login === l));
  } else {
    captains.sort((x, y) => (x.hours || 0) - (y.hours || 0));
  }
  if (captains.length < 2) throw fail(400, 'Mark at least two accepted applicants as captains first');
  const capLogins = new Set(captains.map(c => c.login));
  const teams = captains.map(c => ({ id: c.login.replace(/[^a-z0-9_]/g, ''), name: 'Team ' + c.name, captain: c.name, info: infoLine(c), twitch: c.login }));
  const state = await getState();
  const maxTier = state.tiers.length - 1;
  const pool = apps.filter(a => !capLogins.has(a.login)).map(a => ({ id: a.login.replace(/[^a-z0-9_]/g, ''), name: a.name, tier: Math.min(maxTier, a.tier == null ? suggestTier(a) : a.tier), info: infoLine(a), twitch: a.login }));
  const name = b.name ? String(b.name).slice(0, 80) : state.name;
  return { teams, pool, name, tiers: state.tiers };
}

/* Replace teams and pool with the plan and start a fresh draft (clears picks, matches, stats). */
export async function buildTournament(b, by) {
  const { teams, pool, name, tiers } = await planBuild(b);
  const cfg = { ...((await getConfigOverride()) || {}), teams, pool, tiers, name, builtAt: Date.now(), by };
  await setConfigOverride(cfg);
  await setState({ ...structuredClone(DEFAULT_STATE), teams, pool, tiers, name });
  return { teams: teams.length, pool: pool.length, name };
}

/* ---------- Draft settings (state) ---------- */
export async function setDraftOrder(order, state) {
  state = state || await getState();
  if (state.picks.length) throw fail(409, 'The draft has started. Undo or reset the picks before changing the order');
  const ids = state.teams.map(t => t.id);
  const clean = Array.isArray(order) ? order.map(String).filter((id, i, a) => ids.includes(id) && a.indexOf(id) === i) : [];
  state.teamOrder = clean;
  state.teams = clean.map(id => state.teams.find(t => t.id === id)).concat(state.teams.filter(t => !clean.includes(t.id)));
  await setState(state);
  return { order: state.teams.map(t => t.id) };
}
export async function setEvent(eventAt, eventNote, state) {
  state = state || await getState();
  state.eventAt = eventAt ? String(eventAt).slice(0, 40) : '';
  state.eventNote = String(eventNote || '').slice(0, 120);
  state.eventSet = true;
  await setState(state);
  return { eventAt: state.eventAt, eventNote: state.eventNote };
}
export async function setPickClock(seconds, state) {
  state = state || await getState();
  state.draft.pickSeconds = Math.max(15, Math.min(600, Number(seconds) || 90));
  await setState(state);
  return { pickSeconds: state.draft.pickSeconds };
}

/* ---------- Format (game, team size, tiers, maps, rules…) ----------
   Stored in the config override so it survives builds and can be reverted. Returns the resulting format. */
export async function setFormat(b) {
  const ov = { ...((await getConfigOverride()) || {}) };
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const strList = (a, n, max) => (Array.isArray(a) ? a : []).map(x => str(x, n)).filter(Boolean).slice(0, max);
  if (b.name != null) ov.name = str(b.name, 80) || DEFAULT_STATE.name;
  if (b.game != null) ov.game = str(b.game, 60) || DEFAULT_STATE.game;
  if (Array.isArray(b.hosts)) ov.hosts = strList(b.hosts, 40, 6);
  const fmt = { ...DEFAULT_STATE.format, ...(ov.format || {}) };
  if (b.teamSize != null) fmt.teamSize = int(b.teamSize, 1, 10);
  if (b.firstTo != null) fmt.firstTo = int(b.firstTo, 1, 99);
  if (b.otTo != null) fmt.otTo = int(b.otTo, 1, 99);
  if (b.swapEvery != null) fmt.swapEvery = int(b.swapEvery, 0, 99);
  ov.format = fmt;
  if (b.rounds != null) ov.rounds = int(b.rounds, 1, 9);
  else if (b.teamSize != null) ov.rounds = Math.max(1, fmt.teamSize - 1); /* captain plus picks = team size */
  const rounds = ov.rounds || DEFAULT_STATE.rounds;
  if (Array.isArray(b.tiers)) {
    const tiers = strList(b.tiers, 24, 8);
    if (tiers.length) { ov.tiers = tiers; ov.quota = tiers.length >= rounds ? tiers.map(() => 1) : tiers.map(() => null); }
  }
  const tiers = ov.tiers || DEFAULT_STATE.tiers;
  if (Array.isArray(b.quota)) ov.quota = tiers.map((_, i) => b.quota[i] == null ? null : int(b.quota[i], 0, 10));
  if (Array.isArray(b.maps)) ov.maps = strList(b.maps, 40, 20);
  if (Array.isArray(b.rules)) ov.rules = b.rules.filter(r => r && typeof r === 'object').map(r => ({ h: str(r.h || r.title, 40), t: str(r.t || r.text, 400) })).filter(r => r.t).slice(0, 15);
  await setConfigOverride(ov);
  const s = await getState();
  return { name: s.name, game: s.game, hosts: s.hosts, format: s.format, rounds: s.rounds, tiers: s.tiers, quota: s.quota, maps: s.maps, rules: s.rules.length };
}
