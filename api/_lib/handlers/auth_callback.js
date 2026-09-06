import { setSession, cookieHeader, getSession } from '../session.js';
import { baseUrl } from '../http.js';
import { followsChannel } from '../twitch.js';

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const nextRaw = String(req.cookies?.ak9_oauth_next || 'N/tournament');
  const wantFollows = nextRaw.charAt(0) === 'F';
  let back = nextRaw.slice(1) || '/tournament';
  if (!/^\/[a-z0-9\-\/]*$/i.test(back)) back = '/tournament';
  const clear = [cookieHeader('ak9_oauth_state', '', { maxAge: 0 }), cookieHeader('ak9_oauth_next', '', { maxAge: 0 })];
  const fail = why => { res.setHeader('Set-Cookie', clear); res.redirect(302, `${back}?login=${why}`); };

  if (error) return fail('denied');
  const expected = req.cookies?.ak9_oauth_state;
  if (!code || !state || !expected || state !== expected) return fail('badstate');

  const redirect = `${baseUrl(req)}/api/auth/callback`;
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirect })
  });
  if (!tokenRes.ok) return fail('tokenfail');
  const token = await tokenRes.json();

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${token.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID }
  });
  if (!userRes.ok) return fail('userfail');
  const u = (await userRes.json()).data?.[0];
  if (!u) return fail('userfail');

  /* Keep any earlier follow result unless this login asked for follow permission and can refresh it. */
  const prev = getSession(req) || {};
  let follow = { follows: !!prev.follows, followedAt: prev.followedAt || '', followChecked: prev.followChecked || 0 };
  if (wantFollows && (token.scope || []).includes('user:read:follows')) {
    try { const f = await followsChannel(token.access_token, u.id); follow = { follows: f.follows, followedAt: f.followedAt, followChecked: Date.now() }; } catch { /* keep prev */ }
  }

  fetch('https://id.twitch.tv/oauth2/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, token: token.access_token })
  }).catch(() => {});

  setSession(res, { id: u.id, login: u.login.toLowerCase(), name: u.display_name, avatar: u.profile_image_url, ...follow });
  res.setHeader('Set-Cookie', [res.getHeader('Set-Cookie'), ...clear]);
  res.redirect(302, `${back}?login=ok`);
}
