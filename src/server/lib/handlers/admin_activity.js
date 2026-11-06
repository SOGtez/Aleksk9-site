import { json, requireRole } from '../http.js';
import { getActivity } from '../store.js';

/* GET → { activity: [{ at, login, name, role, action, detail, from, dev, device, where }] }, newest first.
   Admins with AK9 Awards access only (the log shows who looked at the awards behind the scenes). */
export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (!me.awards) return json(res, 403, { error: 'You do not have permission to see the activity log' });
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit) || 1500));
  json(res, 200, { activity: await getActivity(limit) });
}
