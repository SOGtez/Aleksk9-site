import { cacheGet, cacheSet } from './store.js';

const CID = () => process.env.TWITCH_CLIENT_ID;
const CHANNEL = () => (process.env.TWITCH_CHANNEL || 'aleksk9_').toLowerCase();

export async function appToken() {
  const cached = await cacheGet('twitch:app_token');
  if (cached) return cached;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID(), client_secret: process.env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' })
  });
  if (!r.ok) throw new Error('twitch token failed');
  const t = await r.json();
  await cacheSet('twitch:app_token', t.access_token, Math.max(60, (t.expires_in || 3600) - 300));
  return t.access_token;
}

/* Profile pictures for a list of Twitch logins → { login: { avatar, name } }. Cached 12h. */
export async function profiles(logins) {
  const want = Array.from(new Set(logins.filter(Boolean).map(l => l.toLowerCase())));
  if (!want.length) return {};
  const cached = (await cacheGet('twitch:profiles')) || {};
  const missing = want.filter(l => !cached[l]);
  if (missing.length) {
    try {
      const token = await appToken();
      for (let i = 0; i < missing.length; i += 100) {
        const qs = missing.slice(i, i + 100).map(l => 'login=' + encodeURIComponent(l)).join('&');
        const r = await fetch('https://api.twitch.tv/helix/users?' + qs, { headers: { 'Client-Id': CID(), Authorization: 'Bearer ' + token } });
        if (!r.ok) continue;
        for (const u of (await r.json()).data || []) cached[u.login.toLowerCase()] = { avatar: u.profile_image_url, name: u.display_name };
      }
      for (const l of missing) if (!cached[l]) cached[l] = { avatar: '', name: '' };
      await cacheSet('twitch:profiles', cached, 60 * 60 * 12);
    } catch { /* leave whatever we have */ }
  }
  const out = {};
  for (const l of want) if (cached[l] && cached[l].avatar) out[l] = cached[l];
  return out;
}

/* Numeric Twitch id of the channel people must follow. Cached 24h. */
export async function broadcasterId(token) {
  const cached = await cacheGet('twitch:broadcaster_id');
  if (cached) return cached;
  const r = await fetch('https://api.twitch.tv/helix/users?login=' + encodeURIComponent(CHANNEL()), { headers: { 'Client-Id': CID(), Authorization: 'Bearer ' + (token || await appToken()) } });
  const u = (await r.json()).data?.[0];
  if (!u) throw new Error('channel not found');
  await cacheSet('twitch:broadcaster_id', u.id, 60 * 60 * 24);
  return u.id;
}

/* Does this user follow the channel? Needs the USER's token with user:read:follows.
   Returns { follows: boolean, followedAt: iso string | '' }. */
export async function followsChannel(userToken, userId) {
  const bid = await broadcasterId(userToken);
  const r = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${encodeURIComponent(userId)}&broadcaster_id=${encodeURIComponent(bid)}`, {
    headers: { 'Client-Id': CID(), Authorization: 'Bearer ' + userToken }
  });
  if (!r.ok) return { follows: false, followedAt: '', error: 'follow check failed (' + r.status + ')' };
  const d = (await r.json()).data?.[0];
  return { follows: !!d, followedAt: d ? d.followed_at : '' };
}
