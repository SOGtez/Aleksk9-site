import { setSession, cookieHeader } from '../_lib/session.js';
import { baseUrl } from '../_lib/http.js';

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  const back = '/tournament';
  if (error) return res.redirect(302, `${back}?login=denied`);
  const expected = req.cookies?.ak9_oauth_state;
  if (!code || !state || !expected || state !== expected) return res.redirect(302, `${back}?login=badstate`);

  const redirect = `${baseUrl(req)}/api/auth/callback`;
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code, grant_type: 'authorization_code', redirect_uri: redirect
    })
  });
  if (!tokenRes.ok) return res.redirect(302, `${back}?login=tokenfail`);
  const token = await tokenRes.json();

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${token.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID }
  });
  if (!userRes.ok) return res.redirect(302, `${back}?login=userfail`);
  const u = (await userRes.json()).data?.[0];
  if (!u) return res.redirect(302, `${back}?login=userfail`);

  /* We only needed the token to identify the user; revoke it so nothing lingers. */
  fetch('https://id.twitch.tv/oauth2/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, token: token.access_token })
  }).catch(() => {});

  setSession(res, { id: u.id, login: u.login.toLowerCase(), name: u.display_name, avatar: u.profile_image_url });
  res.setHeader('Set-Cookie', [res.getHeader('Set-Cookie'), cookieHeader('ak9_oauth_state', '', { maxAge: 0 })]);
  res.redirect(302, `${back}?login=ok`);
}
