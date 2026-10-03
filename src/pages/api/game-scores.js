import { json, readBody, whoami } from '../../server/lib/http.js';
import { addGameScore, topGameScores, deleteGameScore, cooldown, hasDatabase } from '../../server/lib/store.js';

/* Chat Survivors leaderboard (the game on /game).
   GET                                        anyone: { scores: [...best 10] }
   POST { name, rooms, t, kills }             anyone: adds a run, returns { rank }. One run per 20 s per visitor.
   POST { action: 'delete', id }              admin: removes an entry (bad names)
   Scores are sent by the browser, so this is a fun board, not a cheat-proof one: values are clamped to what
   a real run could reach. Logged-in Twitch users are saved under their Twitch name.
   Without a database (the test site) GET returns offline: true and the game keeps a board on the device. */
const cleanName = (v) => String(v || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

export default async function handler(req, res) {
  if (!hasDatabase()) return json(res, 200, { scores: [], offline: true });
  if (req.method === 'GET') return json(res, 200, { scores: await topGameScores(10) });
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);
  const me = await whoami(req);

  if (b.action === 'delete') {
    if (me.role !== 'admin') return json(res, 403, { error: 'Admins only' });
    await deleteGameScore(String(b.id || '').slice(0, 40));
    return json(res, 200, { ok: true });
  }

  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const wait = await cooldown('game:cd:' + (me.user ? 'u:' + me.user.login : 'ip:' + ip), 20);
  if (wait) return json(res, 429, { error: `Wait ${wait}s before submitting again` });

  const rooms = int(b.rooms, 1, 999), t = int(b.t, 0, 6 * 3600), kills = int(b.kills, 0, 100000);
  /* Every cleared room takes at least ~8 seconds and 10 bans, so a run that doesn't add up is refused. */
  if (t < (rooms - 1) * 8 || kills < (rooms - 1) * 10) return json(res, 400, { error: "That run doesn't add up." });
  const name = me.user ? (me.user.name || me.user.login).slice(0, 16) : cleanName(b.name) || 'anon';
  const entry = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, rooms, t, kills,
    twitch: me.user ? me.user.login : '', at: Date.now() };
  const rank = await addGameScore(entry, rooms * 1e6 + t);
  return json(res, 200, { ok: true, rank, entry });
}
