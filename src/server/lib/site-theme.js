import { DEFAULT_SETTING, isSetting } from '../../resources/seasons';

/* Where the site theme setting lives in Redis: { theme: 'auto' | 'normal' | 'halloween' | …, by, at }. */
export const SITE_THEME_KEY = 'site:theme';

export const parseSetting = (raw) => {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* a bare string */ } }
  const t = v && typeof v === 'object' ? v.theme : v;
  return isSetting(t) ? t : DEFAULT_SETTING;
};

/* For the Next.js layout: read straight from the Upstash REST API with a 30 s cache, so the pages stay static
   and pick up a change from the admin page within about half a minute. No database: the default. */
export async function readSiteThemeSetting() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return DEFAULT_SETTING;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/get/${encodeURIComponent(SITE_THEME_KEY)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30, tags: ['site-theme'] },
    });
    if (!r.ok) return DEFAULT_SETTING;
    const j = await r.json();
    return j && j.result != null ? parseSetting(j.result) : DEFAULT_SETTING;
  } catch {
    return DEFAULT_SETTING;
  }
}
