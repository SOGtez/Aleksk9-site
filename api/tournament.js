import { json } from './_lib/http.js';
import { getState } from './_lib/store.js';
import { nextSlot } from './_lib/defaults.js';
import { profiles } from './_lib/twitch.js';

/* Public read of the whole tournament. The page polls this.
   Adds `avatar` (Twitch profile picture) to every team and pool entry that has a `twitch` login. */
export default async function handler(req, res) {
  const state = await getState();
  const logins = state.teams.map(t => t.twitch).concat(state.pool.map(p => p.twitch));
  const pics = await profiles(logins);
  const withPic = x => ({ ...x, avatar: x.twitch && pics[x.twitch.toLowerCase()] ? pics[x.twitch.toLowerCase()].avatar : '' });
  json(res, 200, { ...state, teams: state.teams.map(withPic), pool: state.pool.map(withPic), next: nextSlot(state) });
}
