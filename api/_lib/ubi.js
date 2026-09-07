/* Minimal client for Ubisoft's (unofficial) Rainbow Six Siege stats services.
   Logs in with a throwaway Ubisoft account (UBI_EMAIL / UBI_PASSWORD) and caches the session in Redis.
   Everything here can break when Ubisoft changes things, so every step reports what it was doing. */
import { cacheGet, cacheSet } from './store.js';

/* Ubisoft's bot wall blocks browser-looking requests from servers. Identifying as the Ubisoft Connect
   client (its app id + the UbiServices SDK user agent) gets through. Verified 2026-09-06. */
const APP_ID = 'e3d5ea9e-50bd-43b7-88bf-39794f4e3d40';
const UA = 'UbiServices_SDK_2020.Release.58_PC64_ansi_static';

export const PLATFORMS = {
  PC:          { type: 'uplay', space: '5172a557-50b5-4665-b7db-e3f2e8c5041d', sandbox: 'OSBOR_PC_LNCH_A',      family: 'pc' },
  PlayStation: { type: 'psn',   space: '05bfb3f7-6c21-4c42-be1f-97a33fb5cf66', sandbox: 'OSBOR_PS4_LNCH_A',     family: 'console' },
  Xbox:        { type: 'xbl',   space: '98a601e5-ca91-4440-b1c5-753f601a2c90', sandbox: 'OSBOR_XBOXONE_LNCH_A', family: 'console' }
};
const SKILL_SPACE = '0d2ae42d-4c27-4cb7-af6c-2099062302bb';

const RANK_NAMES = ['Unranked', 'Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Champion'];
export function rankName(id) {
  id = Number(id) || 0;
  if (id <= 0) return 'Unranked';
  if (id >= 36) return 'Champion';
  const tier = RANK_NAMES[Math.ceil(id / 5)];
  const div = ['V', 'IV', 'III', 'II', 'I'][(id - 1) % 5];
  return tier + ' ' + div;
}
export function rankTier(id) { id = Number(id) || 0; return id <= 0 ? 'Unranked' : id >= 36 ? 'Champion' : RANK_NAMES[Math.ceil(id / 5)]; }

class UbiError extends Error { constructor(step, status, detail) { super(`${step} failed (${status})${detail ? ': ' + detail : ''}`); this.step = step; this.status = status; } }

async function ubiFetch(step, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, 'Ubi-AppId': APP_ID, 'Ubi-LocaleCode': 'en-US', 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not json */ }
  if (!r.ok) throw new UbiError(step, r.status, (body && (body.message || body.errorCode)) || text.slice(0, 120));
  return body;
}

export async function session(force) {
  if (!force) { const c = await cacheGet('ubi:session'); if (c && c.expiration && Date.parse(c.expiration) - Date.now() > 5 * 60 * 1000) return c; }
  const email = process.env.UBI_EMAIL, pass = process.env.UBI_PASSWORD;
  if (!email || !pass) throw new UbiError('login', 500, 'UBI_EMAIL / UBI_PASSWORD are not set in Vercel');
  const body = await ubiFetch('login', 'https://public-ubiservices.ubi.com/v3/profiles/sessions', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(email + ':' + pass).toString('base64') },
    body: JSON.stringify({ rememberMe: true })
  });
  const s = { ticket: body.ticket, sessionId: body.sessionId, expiration: body.expiration, userId: body.userId };
  if (!s.ticket) throw new UbiError('login', 500, 'no ticket in response');
  await cacheSet('ubi:session', s, 60 * 60 * 2);
  return s;
}
function auth(s) { return { Authorization: 'Ubi_v1 t=' + s.ticket, 'Ubi-SessionId': s.sessionId }; }

export async function findProfile(name, platformLabel) {
  const p = PLATFORMS[platformLabel];
  if (!p) throw new UbiError('platform', 400, 'unknown platform ' + platformLabel);
  const s = await session();
  const body = await ubiFetch('profile search', `https://public-ubiservices.ubi.com/v3/profiles?nameOnPlatform=${encodeURIComponent(name)}&platformType=${p.type}`, { headers: auth(s) });
  const prof = (body.profiles || [])[0];
  if (!prof) throw new UbiError('profile search', 404, `no ${platformLabel} player named "${name}"`);
  return { profileId: prof.profileId, userId: prof.userId, name: prof.nameOnPlatform, platform: platformLabel, p };
}

/* Level, playtime, and ranked profile. Partial results are returned with an `errors` list. */
export async function lookup(name, platformLabel) {
  const prof = await findProfile(name, platformLabel);
  const s = await session();
  const out = { name: prof.name, platform: platformLabel, profileId: prof.profileId, level: null, hours: null, rank: '', rankTier: '', peakRank: '', peakRankTier: '', mmr: null, kills: null, deaths: null, kd: null, wins: null, losses: null, errors: [], checkedAt: Date.now() };
  const { space, sandbox, family } = prof.p;

  try {
    const b = await ubiFetch('level', `https://public-ubiservices.ubi.com/v1/spaces/${space}/sandboxes/${sandbox}/r6playerprofile/playerprofile/progressions?profile_ids=${prof.profileId}`, { headers: auth(s) });
    const pr = (b.player_profiles || [])[0]; if (pr) out.level = pr.level;
  } catch (e) { out.errors.push(e.message); }

  try {
    const stats = 'generalpvp_timeplayed,rankedpvp_timeplayed,casualpvp_timeplayed,unrankedpvp_timeplayed';
    const b = await ubiFetch('playtime', `https://public-ubiservices.ubi.com/v1/spaces/${space}/sandboxes/${sandbox}/playerstats2/statistics?populations=${prof.profileId}&statistics=${stats}`, { headers: auth(s) });
    const r = (b.results || {})[prof.profileId] || {};
    const secs = Object.keys(r).filter(k => k.indexOf('generalpvp_timeplayed') === 0).reduce((a, k) => a + (Number(r[k]) || 0), 0);
    if (secs) out.hours = Math.round(secs / 3600);
  } catch (e) { out.errors.push(e.message); }

  try {
    const b = await ubiFetch('rank', `https://public-ubiservices.ubi.com/v2/spaces/${SKILL_SPACE}/title/r6s/skill/full_profiles?profile_ids=${prof.profileId}&platform_families=${family}`, { headers: auth(s) });
    const boards = ((b.platform_families_full_profiles || [])[0] || {}).board_ids_full_profiles || [];
    const ranked = boards.find(x => x.board_id === 'ranked') || boards[0];
    const fp = ranked && (ranked.full_profiles || [])[0];
    if (fp && fp.profile) {
      out.rank = rankName(fp.profile.rank); out.rankTier = rankTier(fp.profile.rank);
      out.peakRank = rankName(fp.profile.max_rank); out.peakRankTier = rankTier(fp.profile.max_rank);
      out.mmr = fp.profile.rank_points;
      const ss = fp.season_statistics || {};
      out.kills = ss.kills ?? null; out.deaths = ss.deaths ?? null;
      if (out.kills != null && out.deaths != null) out.kd = Math.round((out.kills / Math.max(out.deaths, 1)) * 100) / 100;
      const mo = ss.match_outcomes || {}; out.wins = mo.wins ?? null; out.losses = mo.losses ?? null;
    } else out.errors.push('rank: no ranked profile returned');
  } catch (e) { out.errors.push(e.message); }

  return out;
}
