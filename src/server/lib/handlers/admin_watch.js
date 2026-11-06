import { json, requireRole, readBody } from '../http.js';
import { getActivity, getLogins, getSeen, getWatch, setWatch, roleFor, getAwSeason, getAwEntry } from '../store.js';
import { twitchUsers } from '../twitch.js';
import { logActivity } from '../activity.js';

/* The owners' watch list (admin Watch tab). Site owners only (defaults.js owners).
   GET  → { watch: [profile] }: Twitch account, site logins, last seen, AK9 Awards ballots, every activity entry,
          entries from their browsers or connection while logged out, and other accounts sharing a browser or connection.
   POST { login, on } → add to / remove from the list. */
const LOGIN_RE = /^[a-z0-9_]{2,25}$/;

async function profile(login, log, logins, seen, season) {
  const mine = log.filter(a => a.login === login);
  const devs = new Set(mine.map(a => a.dev).filter(Boolean)), nets = new Set(mine.map(a => a.net).filter(Boolean));
  const s = seen[login];
  if (s) { if (s.dev) devs.add(s.dev); if (s.net) nets.add(s.net); }
  /* Other accounts on one of their browsers or connections. */
  const linked = {};
  const link = (other, how, at) => {
    if (!other || other === login) return;
    const l = linked[other] = linked[other] || { login: other, browser: 0, network: 0, last: 0 };
    l[how]++; if (at > l.last) l.last = at;
  };
  for (const a of log) { if (devs.has(a.dev)) link(a.login, 'browser', a.at); else if (nets.has(a.net)) link(a.login, 'network', a.at); }
  for (const [other, v] of Object.entries(seen)) { if (devs.has(v.dev)) link(other, 'browser', v.at); else if (nets.has(v.net)) link(other, 'network', v.at); }
  const anon = log.filter(a => !a.login && (devs.has(a.dev) || nets.has(a.net)));
  const ballots = {};
  if (season) {
    const names = {};
    for (const a of season.awards || []) for (const n of a.nominees || []) names[n.id] = n.name;
    for (const kind of ['noms', 'votes']) {
      const raw = await getAwEntry(kind, season.id, login);
      const e = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (e) ballots[kind] = { at: e.at || 0, picks: (season.awards || []).map(a => ({ award: a.title, pick: kind === 'votes' ? names[e.choices?.[a.id]] || '' : e.choices?.[a.id] || '' })) };
    }
  }
  return {
    login, site: logins[login] || null, seen: s || null, role: await roleFor(login), season: season ? season.label : '',
    ballots, activity: mine.slice(0, 400), anon: anon.slice(0, 200), browsers: [...devs], networks: [...nets],
    linked: Object.values(linked).sort((a, b) => b.last - a.last),
  };
}

export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (!me.owner) return json(res, 403, { error: 'Only the site owners can see the watch list' });
  if (req.method === 'POST') {
    const b = readBody(req);
    const login = String(b.login || '').toLowerCase().replace(/^@/, '').trim();
    if (!LOGIN_RE.test(login)) return json(res, 400, { error: 'That is not a Twitch username' });
    await setWatch(login, !!b.on);
    await logActivity(req, me, 'change', `watch list ${b.on ? '+' : '−'} @${login}`);
    return json(res, 200, { ok: true, watch: await getWatch() });
  }
  const [list, log, logins, seen, season] = await Promise.all([getWatch(), getActivity(5000), getLogins(), getSeen(), getAwSeason()]);
  const profiles = await Promise.all(list.map(l => profile(l, log, logins, seen, season)));
  const tw = await twitchUsers(list.concat(profiles.flatMap(p => p.linked.map(l => l.login)))).catch(() => ({}));
  for (const p of profiles) {
    p.twitch = tw[p.login] || null;
    for (const l of p.linked) { const u = tw[l.login] || {}; l.name = u.name || (logins[l.login] || {}).name || l.login; l.avatar = u.avatar || ''; l.createdAt = u.createdAt || (logins[l.login] || {}).createdAt || ''; }
  }
  json(res, 200, { watch: profiles });
}
