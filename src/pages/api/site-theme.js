import { json, readBody, whoami } from '../../server/lib/http.js';
import { hasDatabase, getSiteThemeRaw, setSiteThemeRaw } from '../../server/lib/store.js';
import { parseSetting } from '../../server/lib/site-theme.js';
import { SEASONS, SETTINGS, DEFAULT_SETTING, isSeasonId, isSetting, resolveSeason, seasonForDate } from '../../resources/seasons';

/* The site theme (holiday look).
   GET                     { setting, season }: what the site shows now (season = colours, logos, dot art). Cached ~30 s.
   GET ?preview=<id>       that theme's data, for trying a theme with ?theme=<id> before switching it on
   GET ?view=admin         admins: the setting plus every theme, for the Site theme tab
   POST { theme }          admins: switch the site to 'auto' | 'normal' | 'halloween' | 'thanksgiving' | 'christmas' */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query.preview) {
      const id = String(req.query.preview);
      if (!isSeasonId(id)) return json(res, 404, { error: 'Unknown theme' });
      return json(res, 200, { setting: id, season: SEASONS[id], preview: true });
    }
    const setting = hasDatabase() ? parseSetting(await getSiteThemeRaw()) : DEFAULT_SETTING;
    if (req.query.view === 'admin') {
      const me = await whoami(req);
      if (me.role !== 'admin') return json(res, 403, { error: 'Admins only' });
      const raw = hasDatabase() ? await getSiteThemeRaw() : null;
      return json(res, 200, { setting, season: resolveSeason(setting), autoNow: seasonForDate(), settings: SETTINGS, seasons: SEASONS, by: (raw && raw.by) || '', at: (raw && raw.at) || 0, demo: !hasDatabase() });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return json(res, 200, { setting, season: resolveSeason(setting) });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const me = await whoami(req);
  if (me.role !== 'admin') return json(res, 403, { error: 'Admins only' });
  const b = readBody(req);
  if (!isSetting(b.theme)) return json(res, 400, { error: 'Pick auto, normal, halloween, thanksgiving or christmas' });
  if (!hasDatabase()) return json(res, 400, { error: 'The test site has no database, so the theme cannot be saved here.' });
  await setSiteThemeRaw({ theme: b.theme, by: (me.user && me.user.login) || '', at: Date.now() });
  /* Rebuild the main pages now instead of waiting for their 30 s cache. Best effort. */
  await Promise.all(['/', '/about', '/blog', '/calendar', '/awards', '/credits'].map((p) => res.revalidate(p).catch(() => {})));
  return json(res, 200, { ok: true, setting: b.theme, season: resolveSeason(b.theme) });
}
