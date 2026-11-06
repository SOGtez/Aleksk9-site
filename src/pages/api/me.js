import { json, whoami } from '../../server/lib/http.js';
import { touchSeen } from '../../server/lib/activity.js';
export default async function handler(req, res) {
  const me = await whoami(req);
  await touchSeen(req, me);
  json(res, 200, me);
}
