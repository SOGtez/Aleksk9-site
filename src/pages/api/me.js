import { json, whoami } from '../../server/lib/http.js';
export default async function handler(req, res) {
  json(res, 200, await whoami(req));
}
