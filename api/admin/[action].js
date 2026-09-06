/* One serverless function for /api/admin/applications, /api/admin/reset, /api/admin/roles. */
import applications from '../_lib/handlers/admin_applications.js';
import reset from '../_lib/handlers/admin_reset.js';
import roles from '../_lib/handlers/admin_roles.js';

const routes = { applications, reset, roles };
export default function handler(req, res) {
  const h = routes[req.query.action];
  if (!h) return res.status(404).json({ error: 'Not found' });
  return h(req, res);
}
