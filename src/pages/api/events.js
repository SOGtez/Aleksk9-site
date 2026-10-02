import { json, requireRole, readBody } from '../../server/lib/http.js';
import { listEvents, saveEvent, getEvent, deleteEvent, hasDatabase } from '../../server/lib/store.js';

/* Stream calendar.
   GET                                   anyone: { events: [...] } sorted by start
   POST { action:'save', event }         admin: add (no id) or update (with id)
   POST { action:'delete', id }          admin
   An event is { id, title, kind: 'stream'|'event'|'other', allDay, date:'YYYY-MM-DD' (all-day)
   or start/end: ISO times, note, link }. Times are saved in UTC and shown in each visitor's time zone.
   Without a database (the test site) GET returns sample events with demo: true. */
const KINDS = ['stream', 'event', 'other'];
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isIso = (v) => !!v && !isNaN(Date.parse(v));
const sortKey = (e) => (e.allDay ? e.date + 'T00:00:00' : e.start) || '';

function sample() {
  const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
  const at = (day, h) => new Date(Date.UTC(y, d.getMonth(), day, h)).toISOString();
  return [
    { id: 'demo1', title: 'Spooktober stream', kind: 'stream', allDay: false, start: at(3, 0), end: at(3, 3), note: 'Sample event', link: '' },
    { id: 'demo2', title: 'Horror game night', kind: 'event', allDay: false, start: at(10, 1), end: '', note: 'Sample event', link: '' },
    { id: 'demo3', title: 'Halloween special', kind: 'event', allDay: true, date: `${y}-${m}-31`, note: 'Sample event', link: '' },
    { id: 'demo4', title: 'Day off', kind: 'other', allDay: true, date: `${y}-${m}-14`, note: '', link: '' },
  ];
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!hasDatabase()) return json(res, 200, { events: sample(), demo: true });
    const events = (await listEvents()).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return json(res, 200, { events });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'GET or POST' });
  const me = await requireRole(req, res, ['admin']);
  if (!me) return;
  const b = readBody(req);

  if (b.action === 'delete') {
    await deleteEvent(clean(b.id, 40));
    return json(res, 200, { ok: true });
  }
  if (b.action !== 'save') return json(res, 400, { error: 'Unknown action' });
  const e = b.event || {};
  const ev = {
    id: clean(e.id, 40) || 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title: clean(e.title, 80),
    kind: KINDS.includes(e.kind) ? e.kind : 'stream',
    allDay: !!e.allDay,
    note: clean(e.note, 500),
    link: /^https?:\/\//.test(clean(e.link, 300)) ? clean(e.link, 300) : '',
  };
  if (!ev.title) return json(res, 400, { error: 'Give the event a title' });
  if (ev.allDay) {
    if (!isDate(e.date)) return json(res, 400, { error: 'Pick a date' });
    ev.date = e.date;
  } else {
    if (!isIso(e.start)) return json(res, 400, { error: 'Pick a start date and time' });
    ev.start = new Date(e.start).toISOString();
    ev.end = isIso(e.end) && Date.parse(e.end) > Date.parse(e.start) ? new Date(e.end).toISOString() : '';
  }
  const prev = b.event.id ? await getEvent(ev.id) : null;
  ev.by = me.user.login; ev.at = Date.now(); if (prev && prev.createdAt) ev.createdAt = prev.createdAt; else ev.createdAt = ev.at;
  await saveEvent(ev);
  return json(res, 200, { ok: true, event: ev });
}
