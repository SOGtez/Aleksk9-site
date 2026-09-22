import { json, requireRole, readBody } from '../http.js';
import { copySpace, clearSpace, spaceHasData } from '../store.js';

/* Admin only. The test tournament (sandbox) next to the live one.
   GET  → { testHasData }
   POST { action:'copy' }     live → test
   POST { action:'reset' }    wipe test
   POST { action:'promote' }  test → live (replaces the live tournament) */
export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  if (req.method === 'GET') return json(res, 200, { testHasData: await spaceHasData('test') });
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);
  try {
    if (b.action === 'copy') { await copySpace('', 'test'); return json(res, 200, { ok: true }); }
    if (b.action === 'reset') { await clearSpace('test'); return json(res, 200, { ok: true }); }
    if (b.action === 'promote') {
      if (!(await spaceHasData('test'))) return json(res, 400, { error: 'The test tournament is empty' });
      await copySpace('test', ''); return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'Unknown action' });
  } catch (e) { return json(res, 500, { error: e.message }); }
}
