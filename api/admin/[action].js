/* One serverless function for /api/admin/applications, /api/admin/reset, /api/admin/roles, /api/admin/lookup, /api/admin/chat. */
import applications from '../_lib/handlers/admin_applications.js';
import reset from '../_lib/handlers/admin_reset.js';
import roles from '../_lib/handlers/admin_roles.js';
import lookup from '../_lib/handlers/admin_lookup.js';
import chat from '../_lib/handlers/admin_chat.js';
import space from '../_lib/handlers/admin_space.js';
import { spaced } from '../_lib/http.js';

/* The AI chat can make several model calls per turn; give it more than the 10s default. */
export const maxDuration = 60;

const routes = { applications, reset, roles, lookup, chat, space };
/* ?space=test (or body.space) makes every admin route work on the sandbox tournament. */
export default spaced(function handler(req, res) {
  const h = routes[req.query.action];
  if (!h) return res.status(404).json({ error: 'Not found' });
  return h(req, res);
});
