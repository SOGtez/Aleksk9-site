import { randomState, cookieHeader } from '../session.js';
import { baseUrl } from '../http.js';

/* GET /api/auth/login[?scope=follows,chat][&next=/apply]
   scope=follows → permission to see the user's followed channels (application page)
   scope=chat    → permission to send chat messages as the user (homepage chat box)
   next = where to land afterwards (same-site path). */
export default function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return res.status(500).send('TWITCH_CLIENT_ID is not set');
  const state = randomState();
  const want = String(req.query.scope || '').split(',').map(s => s.trim()).filter(Boolean);
  const scopes = [];
  if (want.includes('follows')) scopes.push('user:read:follows');
  if (want.includes('chat')) scopes.push('user:write:chat');
  let next = String(req.query.next || '/tournament');
  if (!/^\/[a-z0-9\-\/]*$/i.test(next)) next = '/tournament';
  const redirect = `${baseUrl(req)}/api/auth/callback`;
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  res.setHeader('Set-Cookie', [
    cookieHeader('ak9_oauth_state', state, { maxAge: 600 }),
    cookieHeader('ak9_oauth_next', want.join(',') + '|' + next, { maxAge: 600 })
  ]);
  res.redirect(302, url.toString());
}
