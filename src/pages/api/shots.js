import { json, requireRole, readBody, spaced } from '../../server/lib/http.js';
import { getState, addShot, listShots, getShot, getShotImage, updateShot, deleteShot, cooldown } from '../../server/lib/store.js';
import { bracketOf, findMatch } from '../../server/lib/bracket.js';

/* End-game screenshots. Captains send one for their bracket match; helpers look at it and enter the score.
   GET                     list (helpers/admins: all; captains: their team's)
   GET ?id=                the image (helpers/admins, or the captain of the team that sent it)
   POST { action:'submit', match, image (data URL, jpeg/png/webp), map?, score?:[ours, theirs], note?, team? }
        captain of a team in that match; admins/helpers may send one for either team with `team`
   POST { action:'done' | 'reopen', id }   helpers/admins
   POST { action:'delete', id }            admins */
/* Screenshots are sent as a data URL of up to ~1 MB, above Next.js's default 1 MB body limit. */
export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const MAX_IMAGE = 1_000_000;  /* data URL length; the page shrinks photos to fit */
const isStaff = r => r === 'helper' || r === 'admin';

async function handler(req, res) {
  const me = await requireRole(req, res, ['helper', 'admin', 'captain']);
  if (!me) return;
  const myTeam = me.role.startsWith('captain:') ? me.role.slice(8) : null;

  if (req.method === 'GET') {
    if (req.query.id) {
      const meta = await getShot(String(req.query.id));
      if (!meta || !(isStaff(me.role) || meta.team === myTeam)) return json(res, 404, { error: 'Not found' });
      const data = await getShotImage(meta.id);
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(data || ''));
      if (!m) return json(res, 404, { error: 'The image has expired' });
      res.setHeader('Content-Type', m[1]);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.status(200).send(Buffer.from(m[2], 'base64'));
    }
    const all = (await listShots()).filter(s => isStaff(me.role) || s.team === myTeam).sort((a, b) => b.at - a.at);
    return json(res, 200, { shots: all });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);

  if (b.action === 'submit') {
    const state = await getState();
    if (!(state.bracket && state.bracket.revealed) && me.role !== 'admin') return json(res, 403, { error: 'The bracket has not been revealed yet' });
    const match = findMatch(bracketOf(state), String(b.match || ''));
    if (!match || match.bye || !match.teams[0] || !match.teams[1]) return json(res, 400, { error: 'Pick a match that has both teams' });
    const team = myTeam || String(b.team || '');
    if (!match.teams.includes(team)) return json(res, 403, { error: myTeam ? 'Your team is not in that match' : 'Pick one of the two teams' });
    const image = String(b.image || '');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return json(res, 400, { error: 'Attach a screenshot (JPG or PNG)' });
    if (image.length > MAX_IMAGE) return json(res, 413, { error: 'That image is too big. Try a smaller screenshot' });
    const wait = await cooldown('t:cool:shot:' + me.user.login, 15);
    if (wait) return json(res, 429, { error: `Wait ${wait}s before sending another screenshot`, retryAfter: wait });
    /* Claimed score comes in as [ours, theirs]; store it in the match's team order so helpers can apply it directly. */
    let score = null;
    if (Array.isArray(b.score) && b.score.length === 2 && b.score.some(n => n !== '' && n != null)) {
      const s = b.score.map(n => Math.max(0, Math.min(99, Number(n) || 0)));
      score = match.teams[0] === team ? s : [s[1], s[0]];
    }
    const meta = {
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      match: match.id, label: match.label, teams: match.teams.slice(), team,
      map: String(b.map || '').trim().slice(0, 40), score, note: String(b.note || '').trim().slice(0, 200),
      by: me.user.login, byName: me.user.name || me.user.login, at: Date.now(), status: 'new'
    };
    await addShot(meta, image);
    return json(res, 200, { ok: true, shot: meta });
  }

  if (!isStaff(me.role)) return json(res, 403, { error: 'Only helpers can do that' });
  const id = String(b.id || '');
  if (b.action === 'done' || b.action === 'reopen') {
    const s = await updateShot(id, b.action === 'done' ? { status: 'done', doneBy: me.user.login, doneAt: Date.now() } : { status: 'new' });
    return s ? json(res, 200, { ok: true, shot: s }) : json(res, 404, { error: 'Not found' });
  }
  if (b.action === 'delete') {
    if (me.role !== 'admin') return json(res, 403, { error: 'Only admins can delete screenshots' });
    await deleteShot(id);
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'Unknown action' });
}
export default spaced(handler);
