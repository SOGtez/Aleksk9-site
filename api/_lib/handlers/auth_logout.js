import { clearSession } from '../session.js';
export default function handler(req, res) {
  clearSession(res);
  let next = String(req.query.next || '/tournament');
  if (!/^\/[a-z0-9\-\/]*$/i.test(next)) next = '/tournament';
  res.redirect(302, next);
}
