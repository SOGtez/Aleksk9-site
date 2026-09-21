import { json, requireRole, readBody } from '../http.js';
import { getState, getSettings, getApplications, counterIncr, counterGet } from '../store.js';
import { nextSlot } from '../defaults.js';
import { complete, configuredModels } from '../openrouter.js';
import { updateSettings, reviewApplicant, addAcceptedToPool, planBuild, buildTournament, setDraftOrder, setEvent, setPickClock } from '../actions.js';

/* AI assistant for the admin Tournament tab. Admin only.
   GET  → { usage: { used, cap, month }, models }
   POST { history:[openai-style messages], message }         → one admin turn (counts against the shared monthly cap)
   POST { history, action:'confirm'|'cancel', pending }       → answer a build confirmation (free)
   Replies { history, log:[{role, text, ok?, model?}], usage, pending? }.
   Every write goes through api/_lib/actions.js, the same code the admin buttons use.
   build_tournament never runs straight away: the server returns `pending` and waits for a confirm call. */

const CAP = () => Math.max(1, Number(process.env.AI_MONTHLY_CAP) || 200);
const monthKey = () => 'ai:usage:' + new Date().toISOString().slice(0, 7);
const MAX_STEPS = 6;

const TOOLS = [
  { name: 'get_tournament', description: 'Current tournament: teams (captains), pool, tiers, quota, rounds, draft state, event date, draft order. Call after changing things to see the result.', parameters: { type: 'object', properties: {} } },
  { name: 'list_applications', description: 'Every application with status, tier, captain tick, platform, hours, rank, peak rank, champion seasons, roles, availability, notes and any verified stats lookup.', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'all'] } } } },
  { name: 'review_applicants', description: 'Set status, tier and/or captain tick on one or more applicants. Omit a field to leave it unchanged. Tier is an index into the tiers list (0 = best).', parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { login: { type: 'string' }, status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] }, tier: { type: 'integer', minimum: 0, maximum: 5 }, captain: { type: 'boolean' } }, required: ['login'] } } }, required: ['items'] } },
  { name: 'set_application_settings', description: 'Open or close applications, captain applications, cap, deadline (ISO date-time), playable dates, and the note shown when closed.', parameters: { type: 'object', properties: { open: { type: 'boolean' }, captainsOpen: { type: 'boolean' }, cap: { type: 'integer' }, deadline: { type: 'string' }, dates: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } } },
  { name: 'build_tournament', description: 'Replace the teams and pool with the ACCEPTED applicants: the given captains (logins, in round-1 draft order) become the teams, everyone else accepted goes into the pool with their tier. This clears all picks, matches and stats. The admin is asked to confirm before it runs.', parameters: { type: 'object', properties: { name: { type: 'string' }, captains: { type: 'array', items: { type: 'string' }, description: 'Twitch logins of the captains in round-1 pick order (weakest first).' } }, required: ['captains'] } },
  { name: 'add_accepted_to_pool', description: 'Add every accepted applicant who is not already in the tournament to the current pool. Picks already made stay.', parameters: { type: 'object', properties: {} } },
  { name: 'set_draft_order', description: 'Round-1 draft order as team ids (get them from get_tournament). Only before the first pick.', parameters: { type: 'object', properties: { order: { type: 'array', items: { type: 'string' } } }, required: ['order'] } },
  { name: 'set_event', description: 'Tournament date and time shown with a countdown. eventAt must be ISO 8601 with a UTC offset, e.g. 2026-10-03T17:00:00-07:00 for 5 PM Pacific. Empty string hides the countdown.', parameters: { type: 'object', properties: { eventAt: { type: 'string' }, eventNote: { type: 'string' } }, required: ['eventAt'] } },
  { name: 'set_pick_clock', description: 'Seconds each captain gets per pick (15 to 600).', parameters: { type: 'object', properties: { seconds: { type: 'integer' } }, required: ['seconds'] } }
];
const toolDefs = TOOLS.map(t => ({ type: 'function', function: t }));

/* ---------- Context for the model ---------- */
const appLine = a => {
  const v = a.verified || {};
  const ver = (v.level != null || v.hours != null || v.rank) ? ` verified[level ${v.level ?? '?'}, ${v.hours ?? '?'} hrs, rank ${v.rank || '?'}, peak ${v.peakRank || '?'}]` : '';
  return `${a.login} (${a.name}) — ${a.status}${a.tier != null ? ', tier ' + a.tier : ''}${a.captainPick ? ', CAPTAIN' : ''} · ${a.platform} · ign ${a.ign} · ${a.hours} hrs · ${a.rank}, peak ${a.peakRank}${a.champs ? ', ' + a.champs + 'x Champ' : ''} · ${(a.roles || []).join('/')}${(a.availability || []).length ? ' · can play: ' + a.availability.join(', ') : ''}${a.notes ? ' · "' + a.notes.slice(0, 120) + '"' : ''}${ver}`;
};
async function applicationsText(status) {
  const apps = Object.values(await getApplications()).sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0)).filter(a => !status || status === 'all' || a.status === status);
  return apps.length ? apps.map(appLine).join('\n') : 'No applications.';
}
async function tournamentText() {
  const s = await getState();
  const next = nextSlot(s);
  const teamLine = t => `${t.id}: "${t.name}" captain ${t.captain}${t.twitch ? ' (@' + t.twitch + ')' : ''}${t.info ? ' · ' + t.info : ''}`;
  const poolLine = p => `${p.id}: ${p.name} · tier ${p.tier} (${s.tiers[p.tier] || '?'})${p.info ? ' · ' + p.info : ''}`;
  return [
    `Name: ${s.name}. Roster source: ${s.fromApplications ? 'built from applications' : 'site code'}.`,
    `Tiers: ${s.tiers.map((t, i) => i + '=' + t).join(', ')}. Quota per team per tier: ${JSON.stringify(s.quota)}. Rounds: ${s.rounds}. Team size: ${s.format.teamSize}.`,
    `Draft: ${s.draft.open ? 'OPEN' : 'closed'}, ${s.picks.length} picks made, ${s.draft.pickSeconds}s per pick. Next: ${next ? 'round ' + next.round + ', ' + next.team : 'complete'}. Round-1 order ${(s.teamOrder || []).length ? 'set: ' + s.teamOrder.join(' > ') : 'not set'}.`,
    `Event: ${s.eventAt || 'not set'}${s.eventNote ? ' (' + s.eventNote + ')' : ''}. Matches: ${s.matches.length}.`,
    `Teams (${s.teams.length}, listed in round-1 order):\n` + s.teams.map(teamLine).join('\n'),
    `Pool (${s.pool.length}):\n` + (s.pool.map(poolLine).join('\n') || 'empty')
  ].join('\n');
}
async function systemPrompt(me) {
  const settings = await getSettings();
  const now = new Date();
  const pt = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'full', timeStyle: 'short' });
  return `You are the tournament assistant on the admin panel of AleksK9's site (a Twitch streamer). You help admins set up and run a Rainbow Six Siege 5v5 community tournament: review applications, tier players, choose captains, build the tournament, set the draft order, date and pick clock.
You are talking to admin "${me.user.login}". Today is ${pt} (Pacific). All times on the site are shown in Pacific.

How the tournament works: each captain is a team. The pool is drafted in a snake: round 1 in the listed order, then the order flips each round. Each team drafts one player from each tier (see quota), so tiers should be about equal in size and there should be exactly (teams x rounds) players in the pool. Captains are usually mid-strength players who can lead; the six strongest players should be in the top tier of the pool, not captains, so the draft can balance teams. Round-1 order goes weakest captain first.

Application settings now: ${JSON.stringify(settings)}.

Current tournament:
${await tournamentText()}

Applications:
${await applicationsText('all')}

Rules for you:
- Use the tools to make changes. Never claim something changed unless a tool said so.
- Use review_applicants in one call for many players rather than one call each.
- build_tournament replaces the roster and wipes the draft; the admin gets a confirm button, so propose the teams first and call it when asked to set up or build.
- You cannot reset or revert the tournament, undo picks, or delete applications; tell the admin to use the buttons for those.
- Do not share applicants' Discord handles.
- Keep answers short and concrete. Use plain text with short lines or simple "- " bullets, no headings, no tables.`;
}

/* ---------- Tool execution ---------- */
async function runTool(name, args, me) {
  args = args || {};
  switch (name) {
    case 'get_tournament': return { text: await tournamentText() };
    case 'list_applications': return { text: await applicationsText(args.status) };
    case 'review_applicants': {
      const apps = await getApplications(); const done = [], errs = [];
      for (const it of Array.isArray(args.items) ? args.items : []) {
        try { const a = await reviewApplicant(it.login, it, me.user.login, apps); done.push(`${a.name}: ${a.status}${a.tier != null ? ', tier ' + a.tier : ''}${a.captainPick ? ', captain' : ''}`); }
        catch (e) { errs.push(e.message); }
      }
      return { text: (done.length ? 'Updated ' + done.length + ':\n' + done.join('\n') : 'Nothing updated.') + (errs.length ? '\nErrors: ' + errs.join('; ') : ''), label: done.length ? 'Reviewed ' + done.length + ' applicant' + (done.length === 1 ? '' : 's') : 'No applicants updated', ok: !!done.length };
    }
    case 'set_application_settings': { const s = await updateSettings(args); return { text: 'Settings now: ' + JSON.stringify(s), label: 'Applications ' + (s.open ? 'open' : 'closed') + (s.captainsOpen ? ', captain spots open' : '') + (s.cap ? ', cap ' + s.cap : '') }; }
    case 'add_accepted_to_pool': { const r = await addAcceptedToPool(me.user.login); return { text: 'Added ' + r.added.join(', ') + '. Pool is now ' + r.pool + '.', label: 'Added ' + r.added.length + ' to the pool' }; }
    case 'set_draft_order': { const r = await setDraftOrder(args.order); return { text: 'Round-1 order: ' + r.order.join(' > '), label: 'Draft order set' }; }
    case 'set_event': { const t = args.eventAt ? Date.parse(args.eventAt) : 0; if (args.eventAt && isNaN(t)) throw Object.assign(new Error('eventAt is not a valid date'), { status: 400 }); const r = await setEvent(args.eventAt ? new Date(t).toISOString() : '', args.eventNote); return { text: 'Event: ' + (r.eventAt || 'cleared') + (r.eventNote ? ' · ' + r.eventNote : ''), label: r.eventAt ? 'Event set to ' + new Date(r.eventAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PT' : 'Event date cleared' }; }
    case 'set_pick_clock': { const r = await setPickClock(args.seconds); return { text: 'Pick clock: ' + r.pickSeconds + 's', label: 'Pick clock ' + r.pickSeconds + 's' }; }
    default: throw Object.assign(new Error('Unknown tool ' + name), { status: 400 });
  }
}
const parseArgs = s => { try { return typeof s === 'string' ? JSON.parse(s || '{}') : (s || {}); } catch { return {}; } };

/* Run the model until it stops calling tools, a build needs confirming, or the step limit hits. */
async function drive(history, me, log) {
  const sys = { role: 'system', content: await systemPrompt(me) };
  for (let step = 0; step < MAX_STEPS; step++) {
    const { model, mode, message } = await complete([sys].concat(history), toolDefs);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    const assistant = { role: 'assistant', content: message.content || '' };
    if (calls.length) assistant.tool_calls = calls;
    history.push(assistant);
    if (message.content && String(message.content).trim()) log.push({ role: 'assistant', text: String(message.content).trim(), model: model + (mode === 'text' ? ' (text tools)' : '') });
    if (!calls.length) return null;
    let pending = null;
    for (const c of calls) {
      const name = c.function && c.function.name, args = parseArgs(c.function && c.function.arguments);
      if (name === 'build_tournament' && !pending) {
        try {
          const plan = await planBuild(args);
          pending = { id: c.id, name: plan.name, captains: args.captains || [], preview: { teams: plan.teams.map(t => t.captain), pool: plan.pool.length, byTier: plan.pool.reduce((m, p) => { m[p.tier] = (m[p.tier] || 0) + 1; return m; }, {}) } };
          continue; /* the tool result is added once the admin answers */
        } catch (e) { history.push({ role: 'tool', tool_call_id: c.id, name, content: 'Error: ' + e.message }); log.push({ role: 'tool', text: e.message, ok: false }); continue; }
      }
      try {
        const r = await runTool(name, args, me);
        history.push({ role: 'tool', tool_call_id: c.id, name, content: r.text });
        if (r.label) log.push({ role: 'tool', text: r.label, ok: r.ok !== false });
      } catch (e) {
        history.push({ role: 'tool', tool_call_id: c.id, name, content: 'Error: ' + e.message });
        log.push({ role: 'tool', text: e.message, ok: false });
      }
    }
    if (pending) return pending;
  }
  log.push({ role: 'system', text: 'Stopped after ' + MAX_STEPS + ' steps. Send another message to continue.' });
  return null;
}

/* Only keep the shapes the API expects; the browser holds the history. */
function cleanHistory(h) {
  if (!Array.isArray(h)) return [];
  const kept = h.filter(m => m && ['user', 'assistant', 'tool'].includes(m.role)).slice(-60);
  /* Keep the newest ~40k characters so the free model's 32k context is never blown. */
  let size = 0, from = kept.length; while (from > 0 && size + String(kept[from - 1].content || '').length < 40000) { from--; size += String(kept[from].content || '').length; }
  return kept.slice(from).map(m => {
    const o = { role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 8000) : '' };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) o.tool_calls = m.tool_calls;
    if (m.role === 'tool') { o.tool_call_id = String(m.tool_call_id || ''); if (m.name) o.name = String(m.name).slice(0, 40); }
    return o;
  });
}

export default async function handler(req, res) {
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  const usage = async () => ({ used: await counterGet(monthKey()), cap: CAP(), month: monthKey().slice(9) });
  if (req.method === 'GET') return json(res, 200, { usage: await usage(), models: configuredModels(), configured: !!process.env.OPENROUTER_API_KEY });
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);
  const history = cleanHistory(b.history);
  while (history.length && history[0].role !== 'user') history.shift();
  const log = [];
  try {
    if (b.action === 'confirm' || b.action === 'cancel') {
      const p = b.pending || {};
      if (!p.id || !history.some(m => m.role === 'assistant' && (m.tool_calls || []).some(c => c.id === p.id))) return json(res, 400, { error: 'Nothing to confirm' });
      if (b.action === 'confirm') {
        const r = await buildTournament({ name: p.name, captains: p.captains }, me.user.login);
        history.push({ role: 'tool', tool_call_id: p.id, name: 'build_tournament', content: `Built "${r.name}": ${r.teams} teams, ${r.pool} in the pool. Picks, matches and stats were cleared.` });
        log.push({ role: 'tool', text: 'Built ' + r.teams + ' teams, ' + r.pool + ' in the pool', ok: true });
      } else {
        history.push({ role: 'tool', tool_call_id: p.id, name: 'build_tournament', content: 'The admin cancelled the build. Nothing changed.' });
        log.push({ role: 'tool', text: 'Build cancelled', ok: false });
      }
      const pending = await drive(history, me, log);
      return json(res, 200, { history, log, usage: await usage(), pending });
    }
    const text = String(b.message || '').trim().slice(0, 4000);
    if (!text) return json(res, 400, { error: 'Type something first' });
    if (!process.env.OPENROUTER_API_KEY) return json(res, 500, { error: 'OPENROUTER_API_KEY is not set in Vercel' });
    const used = await counterGet(monthKey());
    if (used >= CAP()) return json(res, 429, { error: 'You have reached the AI limit for this month (' + CAP() + ' messages). It resets on the 1st.', usage: await usage() });
    await counterIncr(monthKey(), 60 * 60 * 24 * 40);
    history.push({ role: 'user', content: text });
    const pending = await drive(history, me, log);
    return json(res, 200, { history, log, usage: await usage(), pending });
  } catch (e) {
    return json(res, e.status || 500, { error: e.message, history, log, usage: await usage() });
  }
}
