import { randomState, cookieHeader } from '../_lib/session.js';
import { baseUrl } from '../_lib/http.js';

/* GET /api/auth/login[?scope=follows][&next=/apply]
   scope=follows also asks Twitch for permission to see the user's followed channels
   (only the application page needs this). next = where to land afterwards (same-site path). */
export default function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return res.status(500).send('TWITCH_CLIENT_ID is not set');
  const state = randomState();
  const wantFollows = req.query.scope === 'follows';
  let next = String(req.query.next || '/tournament');
  if (!/^\/[a-z0-9\-\/]*$/i.test(next)) next = '/tournament';
  const redirect = `${baseUrl(req)}/api/auth/callback`;
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', wantFollows ? 'user:read:follows' : '');
  url.searchParams.set('state', state);
  res.setHeader('Set-Cookie', [
    cookieHeader('ak9_oauth_state', state, { maxAge: 600 }),
    cookieHeader('ak9_oauth_next', (wantFollows ? 'F' : 'N') + next, { maxAge: 600 })
  ]);
  res.redirect(302, url.toString());
}
