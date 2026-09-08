import { json, whoami, readBody } from './_lib/http.js';
import { cacheGet, cacheSet } from './_lib/store.js';
import { broadcasterId, appToken } from './_lib/twitch.js';

/* Homepage chat box.
   GET  → { user, canChat, count }        canChat = we hold a chat token for this user
   POST { message } → sends the message to the channel's Twitch chat as the user; returns today's count */
const CID = () => process.env.TWITCH_CLIENT_ID;
const dayKey = uid => 'chat:count:' + uid + ':' + new Date().toISOString().slice(0, 10);

async function userToken(uid) {
  const t = await cacheGet('tw:tok:' + uid);
  if (!t) return null;
  if (t.expiresAt - Date.now() > 60 * 1000) return t.access;
  if (!t.refresh) return null;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID(), client_secret: process.env.TWITCH_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: t.refresh })
  });
  if (!r.ok) return null;
  const n = await r.json();
  await cacheSet('tw:tok:' + uid, { access: n.access_token, refresh: n.refresh_token || t.refresh, expiresAt: Date.now() + (n.expires_in || 3600) * 1000 }, 60 * 60 * 24 * 30);
  return n.access_token;
}

/* Badge images (global + channel) as { "set/version": url }. Cached 12h. */
async function badges() {
  const cached = await cacheGet('twitch:badges');
  if (cached) return cached;
  const token = await appToken(), bid = await broadcasterId(token);
  const H = { 'Client-Id': CID(), Authorization: 'Bearer ' + token };
  const out = {};
  for (const url of ['https://api.twitch.tv/helix/chat/badges/global', 'https://api.twitch.tv/helix/chat/badges?broadcaster_id=' + bid]) {
    const r = await fetch(url, { headers: H }); if (!r.ok) continue;
    for (const set of (await r.json()).data || []) for (const v of set.versions || []) out[set.set_id + '/' + v.id] = { url: v.image_url_2x || v.image_url_1x, title: v.title };
  }
  await cacheSet('twitch:badges', out, 60 * 60 * 12);
  return out;
}

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.badges) {
    try { res.setHeader('Cache-Control', 'public, max-age=3600'); return res.status(200).json(await badges()); }
    catch { return json(res, 200, {}); }
  }
  const me = await whoami(req);
  if (req.method === 'GET') {
    const uid = me.user?.id;
    const tok = uid ? await cacheGet('tw:tok:' + uid) : null;
    const count = uid ? Number(await cacheGet(dayKey(uid))) || 0 : 0;
    return json(res, 200, { user: me.user, canChat: !!tok, count, channel: process.env.TWITCH_CHANNEL || 'aleksk9_' });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  if (!me.user) return json(res, 401, { error: 'Log in with Twitch to chat' });
  const msg = String(readBody(req).message || '').trim().slice(0, 500);
  if (!msg) return json(res, 400, { error: 'Type something first' });

  const last = await cacheGet('chat:last:' + me.user.id);
  if (last && Date.now() - last < 1500) return json(res, 429, { error: 'Slow down a little' });

  const access = await userToken(me.user.id);
  if (!access) return json(res, 403, { error: 'relogin', message: 'Log in again to enable chat' });
  const bid = await broadcasterId();
  const r = await fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: { 'Client-Id': CID(), Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcaster_id: bid, sender_id: me.user.id, message: msg })
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) return json(res, 403, { error: 'relogin', message: 'Log in again to enable chat' });
  if (!r.ok) return json(res, 502, { error: body.message || ('Twitch refused the message (' + r.status + ')') });
  const d = (body.data || [])[0] || {};
  if (d.is_sent === false) return json(res, 400, { error: (d.drop_reason && d.drop_reason.message) || 'Twitch dropped the message' });

  await cacheSet('chat:last:' + me.user.id, Date.now(), 60);
  const count = (Number(await cacheGet(dayKey(me.user.id))) || 0) + 1;
  await cacheSet(dayKey(me.user.id), count, 60 * 60 * 26);
  json(res, 200, { ok: true, count });
}
