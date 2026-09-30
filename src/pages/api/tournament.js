import { json, spaced, whoami } from '../../server/lib/http.js';
import { getState } from '../../server/lib/store.js';
import { nextSlot, rankFromInfo } from '../../server/lib/defaults.js';
import { getApplications } from '../../server/lib/store.js';
import { profiles } from '../../server/lib/twitch.js';
import { bracketOf } from '../../server/lib/bracket.js';

/* Public read of the whole tournament. The page polls this.
   Adds `avatar` (Twitch profile picture) to every team and pool entry that has a `twitch` login. */
async function handler(req, res) {
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
  /* The bracket stays secret until an admin reveals it. Admins preview it with ?preview=1. The raw seeds are never sent. */
  const revealed = !!(state.bracket && state.bracket.revealed);
  let bracketView = bracketOf(state);
  if (!revealed) {
    const admin = req.query.preview ? (await whoami(req)).role === 'admin' : false;
    bracketView = admin ? { ...bracketView, preview: true } : { hidden: true, size: bracketView.size, bo: bracketView.bo, finalBo: bracketView.finalBo, seeds: [], rounds: [], ready: false, champion: null, started: false };
  }
  const { bracket, ...pub } = state;
  json(res, 200, { ...pub, teams: state.teams.map(withPic), pool: state.pool.map(withPic), next: nextSlot(state), bracketView, bracketRevealed: revealed });
}
export default spaced(handler);
