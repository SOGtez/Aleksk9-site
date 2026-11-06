import { hasDatabase, getAwLive, setAwLive, getAwLiveTaps, addAwLiveTaps } from './store.js';
import { computeResults, revealStyleFor } from './awards.js';

/* Live reveal: while Aleks runs /awards/reveal with "Go live" on, each step he shows is saved as a frame, and
   everyone else's reveal page polls for the newest frame that is older than the stream delay, so the site
   never runs ahead of the stream. A frame only ever carries what is on Aleks's screen: no vote counts or
   winners until the reveal itself, and finalists in the season's order (results are sorted by votes).
   Viewer taps on the pumpkin are counted per step; polls are served from a short per-instance cache and taps
   are added up in memory and written in one go, so a full chat polling costs a few Redis calls a second. */

const MAX_FRAMES = 40, CACHE_MS = 1500, MAX_TAPS = 40;
let mem = null, memTaps = {};                  /* no database (test site) */
let cache = { at: 0, live: null, taps: {} }, pending = {};

const readLive = async () => (hasDatabase() ? getAwLive() : mem);
const readTaps = async (sid) => (hasDatabase() ? getAwLiveTaps(sid) : memTaps[sid] || {});

async function fresh() {
  if (Date.now() - cache.at < CACHE_MS) return cache;
  const live = await readLive();
  const sid = live && live.sid;
  if (sid) {
    for (const [k, n] of Object.entries(pending)) {
      const [s, step] = k.split('|'); if (s !== sid || !n) continue;
      if (hasDatabase()) await addAwLiveTaps(sid, step, n); else { const t = memTaps[sid] || (memTaps[sid] = {}); t[step] = (Number(t[step]) || 0) + n; }
    }
  }
  pending = {};
  cache = { at: Date.now(), live, taps: sid ? await readTaps(sid) : {} };
  return cache;
}

/* What viewers get: the newest frame Aleks showed at least `delay` seconds ago, and the crowd's taps. */
export async function liveView(tap) {
  if (tap && tap.sid && Number.isInteger(tap.step) && tap.n > 0) {
    const k = tap.sid + '|' + tap.step; pending[k] = (pending[k] || 0) + Math.min(MAX_TAPS, Math.floor(tap.n));
  }
  const { live, taps } = await fresh();
  if (!live || !live.on) return { on: false, ended: !!(live && live.endedAt && Date.now() - live.endedAt < 3 * 3600 * 1000) };   /* "the show has ended" for 3 hours */
  const cut = Date.now() - (live.delay || 0) * 1000;
  const frame = [...(live.frames || [])].reverse().find((f) => f.at <= cut) || null;
  const t = {}; for (const [k, v] of Object.entries(taps)) t[k] = Number(v) || 0;
  for (const [k, n] of Object.entries(pending)) { const [s, step] = k.split('|'); if (s === live.sid) t[step] = (t[step] || 0) + n; }
  return { on: true, sid: live.sid, delay: live.delay || 0, frame, taps: t };
}

/* The steps, in the same order as RevealStage: intro, then title + reveal for each award, wildcards, outro. */
function stepAt(season, step) {
  const s = [{ kind: 'intro' }];
  (season.awards || []).forEach((_, i) => s.push({ kind: 'award', i }, { kind: 'win', i }));
  if ((season.wildcards || []).length) s.push({ kind: 'wild' });
  s.push({ kind: 'outro' });
  return s[step] || null;
}

export function buildFrame(season, votes, wildcards, b) {
  const step = Math.floor(Number(b.step)), cur = stepAt(season, step);
  if (!cur) return null;
  const phase = ['idle', 'suspense', 'pumpkin', 'burst', 'shown'].includes(b.phase) ? b.phase : 'idle';
  const r = computeResults(season, votes);
  const f = {
    at: Date.now(), step, kind: cur.kind, phase, hits: Math.max(0, Math.min(3, Math.floor(Number(b.hits) || 0))),
    label: season.label, theme: season.theme, revealStyle: revealStyleFor(season), wildcardsBy: season.wildcardsBy || '',
    totalVoters: r.totalVoters, nAwards: (season.awards || []).length,
  };
  if (cur.kind === 'award' || cur.kind === 'win') {
    const a = r.awards[cur.i], order = ((season.awards[cur.i] || {}).nominees || []).map((n) => n.id);
    const open = cur.kind === 'win' && (phase === 'burst' || phase === 'shown');
    const nominees = [...a.nominees].sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id))
      .map((n) => ({ id: n.id, name: n.name, login: n.login || '', image: n.image || '', ...(open ? { votes: n.votes } : {}) }));
    f.i = cur.i;
    f.award = { id: a.id, title: a.title, description: a.description, nominees, winnerIds: open ? a.winnerIds : [], ...(open ? { total: a.total } : {}) };
  }
  if (cur.kind === 'wild') f.wildcards = wildcards;
  return f;
}

/* Host updates. `on` starts (new session id) or ends the live show; a frame is added whenever one is sent. */
export async function setLive(b, frame, host) {
  let live = (await readLive()) || { on: false, frames: [] };
  if (b.on === true && (!live.on || b.sid !== live.sid)) live = { on: true, sid: 'L' + Date.now().toString(36), host, delay: live.delay ?? 5, frames: [] };
  if (b.on === false) live = { ...live, on: false, endedAt: Date.now() };
  if (b.delay != null) live.delay = Math.max(0, Math.min(60, Math.round(Number(b.delay) || 0)));
  if (frame && live.on) live.frames = [...(live.frames || []), frame].slice(-MAX_FRAMES);
  if (hasDatabase()) await setAwLive(live); else mem = live;
  cache.at = 0;
  return { on: !!live.on, sid: live.sid, delay: live.delay || 0 };
}
/* For admins (view=admin): includes where Aleks is right now, with no delay, for the private winners list. */
export async function liveStatus() {
  const l = await readLive(); if (!l) return { on: false, delay: 5 };
  const f = (l.frames || [])[(l.frames || []).length - 1];
  return { on: !!l.on, sid: l.sid, delay: l.delay || 0, host: l.host || '', ...(l.on && f ? { step: f.step, phase: f.phase, at: f.at } : {}) };
}
