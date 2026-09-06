import { cacheGet, cacheSet } from './store.js';

const H = () => ({ 'Client-Id': process.env.TWITCH_CLIENT_ID });

export async function appToken() {
  const cached = await cacheGet('twitch:app_token');
  if (cached) return cached;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' })
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
        const r = await fetch('https://api.twitch.tv/helix/users?' + qs, { headers: { ...H(), Authorization: 'Bearer ' + token } });
        if (!r.ok) continue;
        for (const u of (await r.json()).data || []) cached[u.login.toLowerCase()] = { avatar: u.profile_image_url, name: u.display_name };
      }
      for (const l of missing) if (!cached[l]) cached[l] = { avatar: '', name: '' }; /* unknown login: remember so we do not ask every time */
      await cacheSet('twitch:profiles', cached, 60 * 60 * 12);
    } catch { /* leave whatever we have */ }
  }
  const out = {};
  for (const l of want) if (cached[l] && cached[l].avatar) out[l] = cached[l];
  return out;
}
