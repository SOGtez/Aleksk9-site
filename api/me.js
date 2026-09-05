import { json, whoami } from './_lib/http.js';
export default async function handler(req, res) {
  json(res, 200, await whoami(req));
}
