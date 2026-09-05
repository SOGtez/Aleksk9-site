import { randomState, cookieHeader } from '../_lib/session.js';
import { baseUrl } from '../_lib/http.js';

export default function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return res.status(500).send('TWITCH_CLIENT_ID is not set');
  const state = randomState();
  const redirect = `${baseUrl(req)}/api/auth/callback`;
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', '');
  url.searchParams.set('state', state);
  res.setHeader('Set-Cookie', cookieHeader('ak9_oauth_state', state, { maxAge: 600 }));
  res.redirect(302, url.toString());
}
