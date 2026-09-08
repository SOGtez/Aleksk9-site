/* Rainbow Six Siege player stats lookup.
   Ubisoft's unofficial login endpoint has answered every third-party client with 429 since mid-2025
   (and can lock the account that tries), so this uses the R6 Arenyze API instead:
   https://r6.arenyze.com/api-docs — set ARENYZE_API_KEY in Vercel (free tier available). */
import { cacheGet, cacheSet } from './store.js';

const BASE = 'https://public-api.arenyze.com/r6/api';
export const PLATFORMS = { PC: 'uplay', PlayStation: 'psn', Xbox: 'xbl' };
const RANK_NAMES = ['Unranked', 'Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Champion'];

class LookupError extends Error { constructor(step, status, detail) { super(`${step} failed (${status})${detail ? ': ' + detail : ''}`); this.step = step; this.status = status; } }

async function call(step, path, params) {
  const key = process.env.ARENYZE_API_KEY;
  if (!key) throw new LookupError('setup', 500, 'ARENYZE_API_KEY is not set in Vercel (get one at r6.arenyze.com)');
  const url = BASE + path + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { 'api-key': key, Accept: 'application/json' } });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not json */ }
  if (!r.ok) throw new LookupError(step, r.status, (body && (body.message || body.error || body.detail)) || text.slice(0, 160));
  return body;
}

/* Walk any JSON and return the first value found under one of the candidate key names (case-insensitive). */
function dig(obj, names, want) {
  const seen = new Set(); const stack = [obj]; const lower = names.map(n => n.toLowerCase());
  while (stack.length) {
    const o = stack.shift();
    if (!o || typeof o !== 'object' || seen.has(o)) continue; seen.add(o);
    for (const [k, v] of Object.entries(o)) {
      if (lower.includes(k.toLowerCase()) && (want === 'any' || typeof v === want)) return v;
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') stack.push(v);
  }
  return null;
}
export function rankName(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const id = Number(v) || 0;
  if (id <= 0) return 'Unranked'; if (id >= 36) return 'Champion';
  return RANK_NAMES[Math.ceil(id / 5)] + ' ' + ['V', 'IV', 'III', 'II', 'I'][(id - 1) % 5];
}
export function rankTier(name) { const t = String(name || '').split(' ')[0]; return RANK_NAMES.includes(t) ? t : (name ? String(name) : ''); }

/* Level, playtime, and ranked profile for a player. Cached 6h per name+platform. */
export async function lookup(name, platformLabel) {
  const platformType = PLATFORMS[platformLabel];
  if (!platformType) throw new LookupError('platform', 400, 'unknown platform ' + platformLabel);
  const ck = 'r6:lookup:' + platformType + ':' + name.toLowerCase();
  const cached = await cacheGet(ck); if (cached) return cached;

  const params = { nameOnPlatform: name, platformType };
  const profile = await call('profile search', '/v2/profile', params);
  const player = profile && profile.player;
  if (!profile || !player || !(player.nameOnPlatform || player.profileId || player.userId)) throw new LookupError('profile search', 404, `no ${platformLabel} player named "${name}"`);
  let stats = null, statsErr = '';
  try { stats = await call('stats', '/v2/fullstats', { ...params, modes: 'ranked' }); } catch (e) { statsErr = e.message; }

  const both = { profile, stats };
  /* Documented layout: profile.account.level, profile.stats.platform_families_full_profiles[].board_ids_full_profiles[] */
  let ranked = null;
  try {
    const fams = (profile.stats && profile.stats.platform_families_full_profiles) || [];
    for (const f of fams) for (const b of f.board_ids_full_profiles || []) if (!ranked && (b.board_id === 'ranked' || !ranked)) { const fp = (b.full_profiles || [])[0]; if (fp && b.board_id === 'ranked') ranked = fp; else if (fp && !ranked) ranked = fp; }
  } catch { /* fall through to heuristics */ }
  const out = {
    name: player.nameOnPlatform || name,
    platform: platformLabel,
    level: (profile.account && typeof profile.account.level === 'number') ? profile.account.level : dig(both, ['level', 'accountLevel', 'clearanceLevel'], 'number'),
    hours: null, rank: '', rankTier: '', peakRank: '', peakRankTier: '', mmr: null, kills: null, deaths: null, kd: null, wins: null, losses: null,
    errors: statsErr ? [statsErr] : [], checkedAt: Date.now(),
    raw: JSON.stringify(both).slice(0, 4000)
  };
  const secs = dig(both, ['timePlayed', 'time_played', 'playtime', 'playTime', 'totalTimePlayed', 'total_time_played'], 'number');
  const hrs = dig(both, ['hours', 'hoursPlayed', 'playtimeHours'], 'number');
  if (hrs != null) out.hours = Math.round(hrs); else if (secs != null) out.hours = Math.round(secs > 100000 ? secs / 3600 : secs);
  const rp = ranked && ranked.profile, ss = ranked && ranked.season_statistics;
  const rank = rp ? rp.rank : dig(both, ['rankName', 'rank_name', 'currentRank', 'rank'], 'any');
  const peak = rp ? rp.max_rank : dig(both, ['maxRankName', 'max_rank_name', 'peakRank', 'maxRank', 'max_rank', 'topRank'], 'any');
  out.rank = rankName(rank); out.rankTier = rankTier(out.rank);
  out.peakRank = rankName(peak); out.peakRankTier = rankTier(out.peakRank);
  out.mmr = rp && typeof rp.rank_points === 'number' ? rp.rank_points : dig(both, ['rankPoints', 'rank_points', 'mmr', 'skillMean'], 'number');
  out.kills = ss && typeof ss.kills === 'number' ? ss.kills : dig(both, ['kills'], 'number');
  out.deaths = ss && typeof ss.deaths === 'number' ? ss.deaths : dig(both, ['deaths'], 'number');
  if (ss && ss.match_outcomes) { out.wins = ss.match_outcomes.wins ?? null; out.losses = ss.match_outcomes.losses ?? null; }
  const kd = dig(both, ['kd', 'kdRatio', 'kd_ratio', 'killDeathRatio'], 'number');
  out.kd = kd != null ? Math.round(kd * 100) / 100 : (out.kills != null && out.deaths != null ? Math.round((out.kills / Math.max(out.deaths, 1)) * 100) / 100 : null);
  if (out.wins == null) out.wins = dig(both, ['wins', 'matchesWon'], 'number'); if (out.losses == null) out.losses = dig(both, ['losses', 'matchesLost'], 'number');

  await cacheSet(ck, out, 60 * 60 * 6);
  return out;
}
export async function session() { return { ok: true }; } /* kept so the admin "relogin" action stays harmless */
