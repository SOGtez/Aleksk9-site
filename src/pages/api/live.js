import { json } from '../../server/lib/http.js';
import { cacheGet, cacheSet } from '../../server/lib/store.js';
import { appToken, CHANNEL_LOGIN } from '../../server/lib/twitch.js';

/* Public: is the channel live? Cached 60s so Twitch is not hammered. */
export default async function handler(req, res) {
  const channel = CHANNEL_LOGIN;
  try {
    const cached = await cacheGet('twitch:live:' + channel);
    if (cached) return json(res, 200, cached);
    const token = await appToken();
    const r = await fetch('https://api.twitch.tv/helix/streams?user_login=' + encodeURIComponent(channel), {
      headers: { Authorization: 'Bearer ' + token, 'Client-Id': process.env.TWITCH_CLIENT_ID }
    });
    const d = (await r.json()).data?.[0];
    const out = d
      ? { live: true, title: d.title, game: d.game_name, viewers: d.viewer_count, startedAt: d.started_at }
      : { live: false };
    await cacheSet('twitch:live:' + channel, out, 60);
    json(res, 200, out);
  } catch (e) {
    json(res, 200, { live: false, error: 'unavailable' });
  }
}
