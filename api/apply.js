import { json, whoami, readBody } from './_lib/http.js';
import { getSettings, getApplication, setApplication, getApplications } from './_lib/store.js';
import { cleanApplication, PLATFORMS, RANKS, ROLES } from './_lib/applications.js';

/* GET  → settings, who you are, whether you follow, your application if any
   POST → submit / update your application (must be logged in and following) */
export default async function handler(req, res) {
  const me = await whoami(req);
  const settings = await getSettings();
  const login = me.user?.login;
  if (req.method === 'GET') {
    const apps = await getApplications();
    const counts = { total: 0, accepted: 0 };
    for (const a of Object.values(apps)) { counts.total++; if (a.status === 'accepted') counts.accepted++; }
    return json(res, 200, {
      settings: { open: settings.open, cap: settings.cap, deadline: settings.deadline, dates: settings.dates, note: settings.note },
      options: { platforms: PLATFORMS, ranks: RANKS, roles: ROLES },
      channel: process.env.TWITCH_CHANNEL || 'aleksk9_',
      me: me.user, role: me.role, counts,
      application: login ? (await getApplication(login)) : null
    });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  if (!me.user) return json(res, 401, { error: 'Log in with Twitch first' });
  if (!me.user.follows) return json(res, 403, { error: 'You need to follow the channel to apply' });
  if (!settings.open) return json(res, 403, { error: 'Applications are closed right now' });
  if (settings.deadline && Date.now() > Date.parse(settings.deadline)) return json(res, 403, { error: 'The application deadline has passed' });

  const existing = await getApplication(login);
  const v = cleanApplication(readBody(req), settings.dates || []);
  if (!v.ok) return json(res, 400, { error: v.errors.join('. ') });
  const app = {
    ...(existing || {}),
    ...v.data,
    login, twitchId: me.user.id, name: me.user.name, avatar: me.user.avatar,
    followedAt: me.user.followedAt || existing?.followedAt || '',
    status: existing?.status || 'pending',
    tier: existing?.tier ?? null,
    submittedAt: existing?.submittedAt || Date.now(),
    updatedAt: Date.now()
  };
  await setApplication(login, app);
  json(res, 200, { ok: true, application: app });
}
