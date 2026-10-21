"use client";

import { useEffect, useState } from "react";
import styles from "./awards.module.scss";
import { Award, ResultCard, Theme, Wildcard, WildcardList, WORDS, themeClass } from "./shared";

/* /awards/<season>: one finished season from the Hall of Fame. */
type Archived = { wildcardsBy?: string; id: string; label: string; theme: Theme; totalVoters: number; awards: Award[]; wildcards: Wildcard[] };

export function HallSeason({ id }: { id: string }) {
  const [s, setS] = useState<Archived | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/awards?season=" + encodeURIComponent(id), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setS(d.season))
      .catch((c) => setErr(c === 404 ? "There is no AK9 Awards season with that name." : "This season could not load right now."));
  }, [id]);
  if (err) return <div className={styles.panel}><p className={styles.msgP}>{err} <a href="/awards">Back to the awards</a></p></div>;
  if (!s) return <div className={styles.spin} aria-label="Loading" />;
  return (
    <div className={`${styles.wrap} ${themeClass(s.theme)}`}>
      {s.theme === "crime" && <div className={styles.tape}><span>CASE CLOSED · AK9 EVIDENCE · CASE CLOSED · AK9 EVIDENCE · CASE CLOSED · AK9 EVIDENCE</span></div>}
      <div className={styles.hero}>
        <div className={styles.kicker}><a href="/awards">AK9 Awards</a> · Hall of Fame</div>
        <h1 className={styles.title}>{s.label}</h1>
        <div className={styles.season}>{s.awards.length} awards · {s.totalVoters} voters</div>
        <div className={styles.btnRow}><a className={styles.ghostBtn} href={`/awards/reveal?season=${encodeURIComponent(s.id)}`}>Replay the reveal</a></div>
      </div>
      <div className={styles.results}>{s.awards.map((a, i) => <ResultCard key={a.id} a={a} i={i} theme={s.theme} />)}</div>
      <WildcardList list={s.wildcards} by={s.wildcardsBy} />
      <p className={styles.footNote}>{WORDS[s.theme].kicker} the AK9 Awards · {s.label}</p>
    </div>
  );
}
