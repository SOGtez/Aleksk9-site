/* One serverless function for /api/auth/login, /api/auth/callback, /api/auth/logout
   (Vercel's Hobby plan allows 12 functions per deploy, so routes are grouped). */
import login from '../_lib/handlers/auth_login.js';
import callback from '../_lib/handlers/auth_callback.js';
import logout from '../_lib/handlers/auth_logout.js';

const routes = { login, callback, logout };
export default function handler(req, res) {
  const h = routes[req.query.action];
  if (!h) return res.status(404).json({ error: 'Not found' });
  return h(req, res);
}
