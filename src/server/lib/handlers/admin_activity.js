import { json, requireRole } from '../http.js';
import { getActivity, getLogins, getSeen } from '../store.js';
import { twitchUsers } from '../twitch.js';

/* GET → { activity: [{ at, login, name, role, action, detail, from, dev, net, device, where }], newest first,
           ages: { login: Twitch account creation date }, seen: { login: { at, dev, net, device, where } } }
   Admins with AK9 Awards access only (the log shows who looked at the awards behind the scenes). */
export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (!me.awards) return json(res, 403, { error: 'You do not have permission to see the activity log' });
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit) || 1500));
  const [activity, logins, seen] = await Promise.all([getActivity(limit), getLogins(), getSeen()]);
  const ages = {};
  for (const l of Object.values(logins)) if (l.createdAt) ages[l.login] = l.createdAt;
  const need = Array.from(new Set(Object.keys(logins).concat(activity.map(a => a.login)).filter(l => l && !ages[l])));
  const tw = await twitchUsers(need).catch(() => ({}));
  for (const [l, u] of Object.entries(tw)) if (u.createdAt) ages[l] = u.createdAt;
  json(res, 200, { activity, ages, seen });
}
