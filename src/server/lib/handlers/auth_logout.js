import { clearSession, getSession } from '../session.js';
import { logActivity } from '../activity.js';
export default async function handler(req, res) {
  const user = getSession(req);
  if (user) await logActivity(req, user, 'logout');
  clearSession(res);
  let next = String(req.query.next || '/tournament');
  if (!/^\/[a-z0-9\-\/]*$/i.test(next)) next = '/tournament';
  res.redirect(302, next);
}
