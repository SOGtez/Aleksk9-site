"use client";

import { useEffect, useState } from "react";
import styles from "./awards.module.scss";

/* Shared bits for the AK9 Awards pages (/awards, /awards/<season>, /awards/reveal). */

export type Nominee = { id: string; name: string; login?: string; image?: string; votes?: number };
export type Award = { id: string; title: string; description?: string; nominees: Nominee[]; total?: number; winnerIds?: string[] };
export type Wildcard = { title: string; winners: string[]; people?: { name: string; image: string }[] };
export type Stage = "soon" | "nominate-soon" | "nominate" | "nominate-closed" | "vote" | "closed" | "revealed";
export type Theme = "classic" | "crime" | "spooky";
export type Season = {
  id: string; label: string; theme: Theme; phase: string; stage: Stage;
  nominateOpen: string; nominateDeadline: string; voteDeadline: string;
  awards: Award[]; wildcards: Wildcard[]; counts?: { nominators: number; voters: number };
};
export type Results = { totalVoters: number; awards: Award[]; wildcards?: Wildcard[] };
export type HallItem = { id: string; label: string; theme: Theme; totalVoters: number; awardCount: number; highlights: { title: string; name: string; image: string }[] };

/* Each theme changes the colours (awards.module.scss) and a few words. */
export const WORDS: Record<Theme, { kicker: string; award: string; nominate: string; vote: string; winner: string; nominee: string; ballot: string }> = {
  classic: { kicker: "AleksK9 presents", award: "Award", nominate: "Nominate", vote: "Vote", winner: "Winner", nominee: "Finalist", ballot: "ballot" },
  crime: { kicker: "AleksK9 · Forensics Unit presents", award: "Case", nominate: "Name a suspect", vote: "Indict", winner: "Guilty", nominee: "Suspect", ballot: "case file" },
  spooky: { kicker: "AleksK9 summons", award: "Award", nominate: "Nominate", vote: "Vote", winner: "Crowned", nominee: "Finalist", ballot: "ballot" },
};
export const themeClass = (t?: string) => styles["theme_" + (t === "crime" || t === "spooky" ? t : "classic")];
export const pad2 = (n: number) => String(n).padStart(2, "0");

export const loginUrl = (next = "/awards") => `/api/auth/login?scope=follows&next=${encodeURIComponent(next)}`;

export function Face({ n, size = 56 }: { n: { name: string; image?: string }; size?: number }) {
  return n.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.face} src={n.image} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className={styles.face} style={{ width: size, height: size, fontSize: size * 0.42 }}>{(n.name || "?").slice(0, 1).toUpperCase()}</span>
  );
}

/* Days / hours / minutes / seconds until `to`. Calls onDone once when it reaches zero. */
export function Countdown({ to, label, onDone }: { to: string; label: string; onDone?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Date.parse(to) - now);
  useEffect(() => { if (left === 0 && onDone) onDone(); }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!to) return null;
  const parts = [Math.floor(left / 864e5), Math.floor((left % 864e5) / 36e5), Math.floor((left % 36e5) / 6e4), Math.floor((left % 6e4) / 1e3)];
  return (
    <div className={styles.countWrap}>
      <div className={styles.count}>
        {parts.map((v, i) => (
          <div key={i} className={styles.cbox}><b>{pad2(v)}</b><span>{["days", "hrs", "min", "sec"][i]}</span></div>
        ))}
      </div>
      <div className={styles.countLbl}>{label}</div>
    </div>
  );
}

export const fmtWhen = (iso: string) => {
  try { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
};

/* One finished award: the winner big, everyone else with their votes. */
export function ResultCard({ a, i, theme }: { a: Award; i: number; theme: Theme }) {
  const w = WORDS[theme];
  const winners = a.nominees.filter((n) => (a.winnerIds || []).includes(n.id));
  const others = a.nominees.filter((n) => !(a.winnerIds || []).includes(n.id));
  const total = a.total || 0;
  const pct = (v = 0) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div className={styles.result}>
      <div className={styles.anum}>{w.award} {pad2(i + 1)}</div>
      <div className={styles.atitle}>{a.title}</div>
      {winners.length ? (
        <div className={styles.winRow}>
          {winners.map((n) => (
            <div key={n.id} className={styles.winner}>
              <Face n={n} size={72} />
              <div>
                <div className={styles.stamp}>{w.winner}{winners.length > 1 ? " · tie" : ""}</div>
                <div className={styles.winName}>{n.name}</div>
                <div className={styles.winVotes}>{n.votes || 0} vote{n.votes === 1 ? "" : "s"} · {pct(n.votes)}%</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.adesc}>No votes were cast for this one.</div>
      )}
      {others.length > 0 && (
        <div className={styles.bars}>
          {others.map((n) => (
            <div key={n.id} className={styles.barRow}>
              <span className={styles.barName}>{n.name}</span>
              <span className={styles.barTrack}><span style={{ width: pct(n.votes) + "%" }} /></span>
              <span className={styles.barNum}>{n.votes || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WildcardList({ list }: { list: Wildcard[] }) {
  if (!list || !list.length) return null;
  return (
    <div className={styles.wildWrap}>
      <div className={styles.sectionH}>Wildcard awards</div>
      <p className={styles.sectionP}>Picked by Aleks, not voted.</p>
      <div className={styles.wildGrid}>
        {list.map((wc) => (
          <div key={wc.title} className={styles.wild}>
            <div className={styles.atitle}>{wc.title}</div>
            <div className={styles.wildPeople}>
              {(wc.people || wc.winners.map((name) => ({ name, image: "" }))).map((p) => (
                <span key={p.name} className={styles.wildPerson}><Face n={p} size={40} />@{p.name}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
