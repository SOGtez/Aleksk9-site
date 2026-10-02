"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Column, Heading, Row, Text } from "@once-ui-system/core";
import styles from "./calendar.module.scss";

/* Stream calendar: month grid + upcoming list. Events come from /api/events (admins add them on /admin).
   Timed events are shown in the visitor's own time zone; all-day events stay on their date. */
type Ev = { id: string; title: string; kind: "stream" | "event" | "other"; allDay: boolean; date?: string; start?: string; end?: string; note?: string; link?: string };

const KIND_LABEL: Record<Ev["kind"], string> = { stream: "Stream", event: "Event", other: "Other" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/* The local calendar day an event belongs to. */
const dayOf = (e: Ev) => (e.allDay ? e.date || "" : e.start ? ymd(new Date(e.start)) : "");
const startMs = (e: Ev) => (e.allDay ? new Date(`${e.date}T00:00:00`).getTime() : Date.parse(e.start || ""));
const endMs = (e: Ev) => (e.allDay ? new Date(`${e.date}T23:59:59`).getTime() : Date.parse(e.end || "") || Date.parse(e.start || "") + 3 * 3600e3);
const tz = () => new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";
function timeText(e: Ev) {
  if (e.allDay) return "All day";
  const f = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return e.start ? f(e.start) + (e.end ? " – " + f(e.end) : "") : "";
}
function dateText(e: Ev) {
  const d = e.allDay ? new Date(`${e.date}T12:00:00`) : new Date(e.start || "");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export const CalendarView = () => {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [picked, setPicked] = useState<string>(() => ymd(new Date()));
  const [open, setOpen] = useState<Ev | null>(null);

  useEffect(() => {
    fetch("/api/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setEvents(d.events || []); setDemo(!!d.demo); })
      .catch(() => { setEvents([]); setError(true); });
  }, []);

  const byDay = useMemo(() => {
    const m: Record<string, Ev[]> = {};
    (events || []).forEach((e) => { const k = dayOf(e); if (k) (m[k] = m[k] || []).push(e); });
    Object.values(m).forEach((l) => l.sort((a, b) => startMs(a) - startMs(b)));
    return m;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (events || []).filter((e) => endMs(e) >= now).sort((a, b) => startMs(a) - startMs(b)).slice(0, 8);
  }, [events]);

  /* 6 rows x 7 days, starting on the Sunday before the 1st. */
  const cells = useMemo(() => {
    const first = new Date(month), start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const today = ymd(new Date());
  const monthName = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const go = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const dayList = byDay[picked] || [];

  const chip = (e: Ev, compact?: boolean) => (
    <button key={e.id} className={`${styles.chip} ${styles[e.kind]}`} onClick={(ev) => { ev.stopPropagation(); setOpen(e); }} title={e.title}>
      {!compact && !e.allDay && <span className={styles.time}>{timeText(e).split(" – ")[0]}</span>}
      <span className={styles.title}>{e.title}</span>
    </button>
  );

  return (
    <Column fillWidth gap="24">
      {demo && (
        <Text variant="body-default-s" onBackground="neutral-weak" className={styles.notice}>
          Sample events: this copy of the site has no database. The real calendar shows what Aleks has planned.
        </Text>
      )}
      {error && (
        <Text variant="body-default-s" onBackground="neutral-weak" className={styles.notice}>
          The calendar could not load right now. Try again in a minute.
        </Text>
      )}

      <Column fillWidth className={styles.card}>
        <Row fillWidth vertical="center" horizontal="between" gap="12" paddingX="16" paddingY="12" className={styles.head}>
          <Heading as="h2" variant="heading-strong-l">{monthName}</Heading>
          <Row gap="8" vertical="center">
            <Button size="s" variant="secondary" onClick={() => go(-1)} aria-label="Previous month">‹</Button>
            <Button size="s" variant="secondary" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setPicked(today); }}>Today</Button>
            <Button size="s" variant="secondary" onClick={() => go(1)} aria-label="Next month">›</Button>
          </Row>
        </Row>
        <div className={styles.grid} role="grid" aria-label={monthName}>
          {DAYS.map((d) => <div key={d} className={styles.dow} role="columnheader">{d}</div>)}
          {cells.map((d) => {
            const k = ymd(d), list = byDay[k] || [], out = d.getMonth() !== month.getMonth();
            return (
              <div key={k} role="gridcell" tabIndex={0} aria-label={`${d.toDateString()}, ${list.length} event${list.length === 1 ? "" : "s"}`}
                className={[styles.cell, out && styles.out, k === today && styles.today, k === picked && styles.picked].filter(Boolean).join(" ")}
                onClick={() => setPicked(k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(k); } }}>
                <span className={styles.num}>{d.getDate()}</span>
                <div className={styles.chips}>
                  {list.slice(0, 3).map((e) => chip(e))}
                  {list.length > 3 && <span className={styles.more}>+{list.length - 3} more</span>}
                </div>
                <div className={styles.dots}>{list.slice(0, 4).map((e) => <i key={e.id} className={styles[e.kind]} />)}</div>
              </div>
            );
          })}
        </div>
        <Row gap="16" paddingX="16" paddingY="12" wrap className={styles.legend}>
          {(["stream", "event", "other"] as const).map((k) => <span key={k}><i className={styles[k]} />{KIND_LABEL[k]}</span>)}
          <span className={styles.tz}>Times in your time zone ({tz()})</span>
        </Row>
      </Column>

      {/* Phones: the grid only shows dots, so the picked day is listed here. */}
      <Column fillWidth gap="8" className={styles.dayList}>
        <Heading as="h3" variant="heading-strong-s">{new Date(`${picked}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Heading>
        {dayList.length ? dayList.map((e) => chip(e)) : <Text onBackground="neutral-weak" variant="body-default-s">Nothing planned.</Text>}
      </Column>

      <Column fillWidth gap="12">
        <Heading as="h2" variant="heading-strong-l">Coming up</Heading>
        {events === null ? <Text onBackground="neutral-weak">Loading…</Text> : upcoming.length ? (
          <Column fillWidth gap="8">
            {upcoming.map((e) => (
              <button key={e.id} className={styles.row} onClick={() => setOpen(e)}>
                <span className={`${styles.bar} ${styles[e.kind]}`} />
                <span className={styles.when}><b>{dateText(e)}</b><small>{timeText(e)}</small></span>
                <span className={styles.what}><b>{e.title}</b>{e.note && <small>{e.note}</small>}</span>
                <span className={styles.kind}>{KIND_LABEL[e.kind]}</span>
              </button>
            ))}
          </Column>
        ) : <Text onBackground="neutral-weak">Nothing planned yet. Check back soon.</Text>}
      </Column>

      {open && (
        <div className={styles.modalBg} onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <span className={`${styles.kindTag} ${styles[open.kind]}`}>{KIND_LABEL[open.kind]}</span>
            <Heading as="h3" variant="heading-strong-l">{open.title}</Heading>
            <Text onBackground="neutral-weak">{dateText(open)} · {timeText(open)}</Text>
            {open.note && <Text variant="body-default-m">{open.note}</Text>}
            <Row gap="8" paddingTop="8">
              {open.link && <Button href={open.link} size="s" variant="primary">Open link</Button>}
              <Button size="s" variant="secondary" onClick={() => setOpen(null)}>Close</Button>
            </Row>
          </div>
        </div>
      )}
    </Column>
  );
};
