import { json, requireRole, readBody } from '../http.js';
import { getState, getSettings, getApplications, counterIncr, counterGet, counterDecr, currentSpace, setCurrentSpace, copySpace, clearSpace, spaceHasData } from '../store.js';
import { nextSlot } from '../defaults.js';
import { complete, configuredModels } from '../openrouter.js';
import { updateSettings, reviewApplicant, addAcceptedToPool, planBuild, buildTournament, setDraftOrder, setEvent, setPickClock, setFormat } from '../actions.js';

/* AI assistant for the admin Tournament tab. Admin only.
   GET  → { usage: { used, cap, month }, models }
   POST { history:[openai-style messages], message }         → one admin turn (counts against the shared monthly cap)
   POST { history, action:'confirm'|'cancel', pending }       → answer a build confirmation (free)
   Replies { history, log:[{role, text, ok?, model?}], usage, pending? }.
   Every write goes through api/_lib/actions.js, the same code the admin buttons use.
   build_tournament and promote_test_to_live never run straight away: the server returns `pending` and waits for a confirm call.
   Spaces: body.space '' (live) or 'test' (sandbox shown at /tournament-test). The assistant can switch mid-turn with
   switch_mode; the reply carries the space it ended in so the admin page's toggle follows. */

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
  { name: 'set_pick_clock', description: 'Seconds each captain gets per pick (15 to 600).', parameters: { type: 'object', properties: { seconds: { type: 'integer' } }, required: ['seconds'] } },
  { name: 'set_tournament_format', description: 'Change what the tournament is: name, game, hosts, team size, picks per team (rounds), tiers and how many picks per tier each team may take (quota; null = no limit), first-to score, overtime, side swap, map pool and rules. Use it to set up a different game, e.g. Rocket League 3v3: teamSize 3, rounds 2, tiers ["Grand Champ","Champ","Diamond","Plat"], quota [1,1,null,null], maps ["DFH Stadium",…], rules [{h:"Game",t:"Best of 5, 5 minute matches"}]. Only send the fields to change. Existing pool players keep their tier index (clamped to the new tier count). The public pages render whatever is set.', parameters: { type: 'object', properties: { name: { type: 'string' }, game: { type: 'string' }, hosts: { type: 'array', items: { type: 'string' } }, teamSize: { type: 'integer', minimum: 1, maximum: 10 }, rounds: { type: 'integer', minimum: 1, maximum: 9, description: 'Picks per team in the draft; normally teamSize minus the captain.' }, firstTo: { type: 'integer' }, otTo: { type: 'integer' }, swapEvery: { type: 'integer' }, tiers: { type: 'array', items: { type: 'string' } }, quota: { type: 'array', items: { type: ['integer', 'null'] } }, maps: { type: 'array', items: { type: 'string' } }, rules: { type: 'array', items: { type: 'object', properties: { h: { type: 'string' }, t: { type: 'string' } }, required: ['t'] } } } } },
  { name: 'switch_mode', description: 'Choose which tournament the following tools act on: "live" is what the public sees at /tournament; "test" is a sandbox shown at /tournament-test that admins use to rehearse or preview. Call this first whenever the admin says test, preview, sandbox, rehearse, dry run, or asks to go back to live.', parameters: { type: 'object', properties: { mode: { type: 'string', enum: ['live', 'test'] } }, required: ['mode'] } },
  { name: 'copy_live_to_test', description: 'Overwrite the test tournament with a copy of the live one (teams, pool, picks, matches, stats, applications, settings) so a rehearsal starts from the real data.', parameters: { type: 'object', properties: {} } },
  { name: 'reset_test', description: 'Wipe the test tournament completely. It goes back to the built-in config with no applications.', parameters: { type: 'object', properties: {} } },
  { name: 'promote_test_to_live', description: 'Replace the LIVE tournament with the test one (everything: teams, pool, picks, matches, stats, applications, settings). The admin is asked to confirm before it runs.', parameters: { type: 'object', properties: {} } }
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
    `Space: ${modeLabel()}${modeLabel() === 'TEST' ? ' (sandbox at /tournament-test)' : ' (public at /tournament)'}.`,
    `Name: ${s.name}. Game: ${s.game}. Hosts: ${(s.hosts || []).join(', ')}. Roster source: ${s.fromApplications ? 'built from applications' : 'site code'}. Format: ${s.formatSet ? 'customised' : 'code defaults'}.`,
    `Maps: ${s.maps.join(', ') || 'none'}. Rules: ${s.rules.map(r => r.h).join(', ') || 'none'}.`,
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

${modeText()}

The site can host any game: set_tournament_format changes the game, name, hosts, team size, picks per team, tiers, quota, maps, rules and scoring, and the public pages render whatever is set. For a new game, set the format first, then tier the applicants against the new tiers, then build.

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

function modeText() {
  return currentSpace() === 'test'
    ? 'MODE: TEST. You are working on the sandbox tournament shown at /tournament-test. Nothing you change here is public. If the admin wants the real tournament, call switch_mode("live") first. promote_test_to_live copies this sandbox over the live tournament (needs the admin to confirm).'
    : 'MODE: LIVE. Every change you make is public straight away on /tournament. If the admin says test, preview, sandbox, rehearse, dry run, or "not for real", call switch_mode("test") BEFORE any other tool, then continue there. copy_live_to_test seeds the sandbox from the live data.';
}
const modeLabel = () => currentSpace() === 'test' ? 'TEST' : 'LIVE';

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
    case 'set_tournament_format': {
      const r = await setFormat(args);
      return { text: 'Format now: ' + JSON.stringify(r), label: 'Format: ' + r.game + ' ' + r.format.teamSize + 'v' + r.format.teamSize + ', ' + r.tiers.length + ' tiers, ' + r.maps.length + ' maps' };
    }
    case 'switch_mode': {
      const mode = args.mode === 'test' ? 'test' : 'live';
      setCurrentSpace(mode === 'test' ? 'test' : '');
      const has = mode === 'test' ? await spaceHasData('test') : true;
      return { text: modeText() + (mode === 'test' && !has ? ' The test tournament is empty (built-in config, no applications); copy_live_to_test fills it from the live data.' : '') + '\n\n' + await tournamentText(), label: 'Switched to ' + mode + ' mode' };
    }
    case 'copy_live_to_test': { await copySpace('', 'test'); return { text: 'Test tournament now mirrors the live one.\n' + await withTest(tournamentText), label: 'Copied live into test' }; }
    case 'reset_test': { await clearSpace('test'); return { text: 'Test tournament wiped.', label: 'Test tournament cleared' }; }
    default: throw Object.assign(new Error('Unknown tool ' + name), { status: 400 });
  }
}
async function withTest(fn) { const prev = currentSpace(); setCurrentSpace('test'); try { return await fn(); } finally { setCurrentSpace(prev); } }
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
          pending = { kind: 'build', id: c.id, space: currentSpace(), name: plan.name, captains: args.captains || [], preview: { teams: plan.teams.map(t => t.captain), pool: plan.pool.length, byTier: plan.pool.reduce((m, p) => { m[p.tier] = (m[p.tier] || 0) + 1; return m; }, {}) } };
          continue; /* the tool result is added once the admin answers */
        } catch (e) { history.push({ role: 'tool', tool_call_id: c.id, name, content: 'Error: ' + e.message }); log.push({ role: 'tool', text: e.message, ok: false, space: currentSpace() }); continue; }
      }
      if (name === 'promote_test_to_live' && !pending) {
        if (!(await spaceHasData('test'))) { history.push({ role: 'tool', tool_call_id: c.id, name, content: 'Error: the test tournament is empty, nothing to promote' }); log.push({ role: 'tool', text: 'Test tournament is empty', ok: false, space: currentSpace() }); continue; }
        const t = await withTest(getState);
        pending = { kind: 'promote', id: c.id, space: currentSpace(), name: t.name, preview: { teams: t.teams.map(x => x.captain), pool: t.pool.length, picks: t.picks.length, matches: t.matches.length } };
        continue;
      }
      try {
        const r = await runTool(name, args, me);
        history.push({ role: 'tool', tool_call_id: c.id, name, content: r.text });
        if (r.label) log.push({ role: 'tool', text: r.label, ok: r.ok !== false, space: currentSpace() });
      } catch (e) {
        history.push({ role: 'tool', tool_call_id: c.id, name, content: 'Error: ' + e.message });
        log.push({ role: 'tool', text: e.message, ok: false, space: currentSpace() });
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
  if (req.method === 'GET') return json(res, 200, { usage: await usage(), models: configuredModels(), configured: !!process.env.OPENROUTER_API_KEY, space: currentSpace(), testHasData: await spaceHasData('test') });
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const b = readBody(req);
  const history = cleanHistory(b.history);
  while (history.length && history[0].role !== 'user') history.shift();
  const log = [];
  try {
    if (b.action === 'confirm' || b.action === 'cancel') {
      const p = b.pending || {};
      if (!p.id || !history.some(m => m.role === 'assistant' && (m.tool_calls || []).some(c => c.id === p.id))) return json(res, 400, { error: 'Nothing to confirm' });
      const promote = p.kind === 'promote';
      if (p.space === 'test' || p.space === '') setCurrentSpace(p.space); /* finish in the space the tool was called in */
      if (b.action === 'confirm' && promote) {
        await copySpace('test', '');
        history.push({ role: 'tool', tool_call_id: p.id, name: 'promote_test_to_live', content: 'The live tournament now matches the test one.' });
        log.push({ role: 'tool', text: 'Test tournament promoted to live', ok: true, space: '' });
      } else if (b.action === 'confirm') {
        const r = await buildTournament({ name: p.name, captains: p.captains }, me.user.login);
        history.push({ role: 'tool', tool_call_id: p.id, name: 'build_tournament', content: `Built "${r.name}": ${r.teams} teams, ${r.pool} in the pool. Picks, matches and stats were cleared.` });
        log.push({ role: 'tool', text: 'Built ' + r.teams + ' teams, ' + r.pool + ' in the pool', ok: true, space: currentSpace() });
      } else {
        history.push({ role: 'tool', tool_call_id: p.id, name: promote ? 'promote_test_to_live' : 'build_tournament', content: 'The admin cancelled. Nothing changed.' });
        log.push({ role: 'tool', text: (promote ? 'Promotion' : 'Build') + ' cancelled', ok: false, space: currentSpace() });
      }
      const pending = await drive(history, me, log);
      return json(res, 200, { history, log, usage: await usage(), pending, space: currentSpace() });
    }
    const text = String(b.message || '').trim().slice(0, 4000);
    if (!text) return json(res, 400, { error: 'Type something first' });
    if (!process.env.OPENROUTER_API_KEY) return json(res, 500, { error: 'OPENROUTER_API_KEY is not set in Vercel' });
    const used = await counterGet(monthKey());
    if (used >= CAP()) return json(res, 429, { error: 'You have reached the AI limit for this month (' + CAP() + ' messages). It resets on the 1st.', usage: await usage() });
    await counterIncr(monthKey(), 60 * 60 * 24 * 40);
    history.push({ role: 'user', content: text });
    let pending;
    try { pending = await drive(history, me, log); }
    catch (e) {
      /* The model never answered (rate limit, outage): give the message back so failures do not eat the cap. */
      if (!log.some(m => m.role === 'assistant' || m.role === 'tool')) await counterDecr(monthKey());
      throw e;
    }
    return json(res, 200, { history, log, usage: await usage(), pending, space: currentSpace() });
  } catch (e) {
    return json(res, e.status || 500, { error: e.message, history, log, usage: await usage(), space: currentSpace() });
  }
}
