import { json } from './_lib/http.js';
import { getState } from './_lib/store.js';
import { nextSlot, rankFromInfo } from './_lib/defaults.js';
import { getApplications } from './_lib/store.js';
import { profiles } from './_lib/twitch.js';

/* Public read of the whole tournament. The page polls this.
   Adds `avatar` (Twitch profile picture) to every team and pool entry that has a `twitch` login. */
export default async function handler(req, res) {
  const state = await getState();
  const logins = state.teams.map(t => t.twitch).concat(state.pool.map(p => p.twitch));
  const pics = await profiles(logins);
  /* Rank badge: a verified lookup (from the admin page) wins; otherwise whatever the info line says. */
  let verified = {};
  try { const apps = await getApplications(); for (const a of Object.values(apps)) if (a.verified && (a.verified.peakRankTier || a.verified.rankTier)) verified[a.login] = a.verified.peakRankTier || a.verified.rankTier; } catch { /* optional */ }
  const withPic = x => {
    const login = (x.twitch || '').toLowerCase();
    return { ...x, avatar: login && pics[login] ? pics[login].avatar : '', rank: (login && verified[login]) || rankFromInfo(x.info), rankVerified: !!(login && verified[login]) };
  };
  json(res, 200, { ...state, teams: state.teams.map(withPic), pool: state.pool.map(withPic), next: nextSlot(state) });
}
