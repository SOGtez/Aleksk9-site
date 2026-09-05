import { clearSession } from '../_lib/session.js';
export default function handler(req, res) {
  clearSession(res);
  res.redirect(302, '/tournament');
}
