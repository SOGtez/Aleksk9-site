"use client";

import { useEffect, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Theme, Wildcard, loginUrl, themeClass } from "./shared";

/* /awards/print: one certificate-style sheet per winner, made for printing or "Save as PDF".
   ?season=<id> a finished season · ?k=<key> the unlisted link · nothing: the current season (admins). */
type Data = { label: string; theme: Theme; totalVoters: number; awards: Award[]; wildcards: Wildcard[]; wildcardsBy?: string };

export function PrintSheets() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search), season = q.get("season"), k = q.get("k");
    (async () => {
      try {
        if (season || k) {
          const r = await fetch(season ? "/api/awards?season=" + encodeURIComponent(season) : "/api/awards?share=" + encodeURIComponent(k || ""), { cache: "no-store" });
          if (!r.ok) throw new Error(r.status === 404 ? "That season or link wasn't found." : "Could not load.");
          setD((await r.json()).season); return;
        }
        const r = await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (r.status === 403 || r.status === 401) { setErr("login"); return; }
        const j = await r.json();
        if (!j.season || !j.results) throw new Error("There is no season with results yet.");
        setD({ label: j.season.label, theme: j.season.theme, totalVoters: j.results.totalVoters, awards: j.results.awards, wildcards: j.season.wildcards || [], wildcardsBy: j.season.wildcardsBy });
      } catch (e) { setErr((e as Error).message || "Could not load."); }
    })();
  }, []);

  if (err === "login") return <div className={`${styles.panel} ${styles.center}`}><div className={styles.msgH}>Admins only</div><p className={styles.msgP}>Log in with an admin or AK9 Awards account to print this season&apos;s sheets.</p><a className={styles.btn} href={loginUrl("/awards/print")}>Log in with Twitch</a></div>;
  if (err) return <div className={`${styles.panel} ${styles.center}`}><p className={styles.msgP}>{err}</p></div>;
  if (!d) return <div className={styles.spin} aria-label="Loading" />;

  const sheets: { award: string; desc: string; name: string; image: string; line: string; kind: string }[] = [];
  for (const a of d.awards) {
    const winners = a.nominees.filter((n) => (a.winnerIds || []).includes(n.id));
    for (const n of winners) sheets.push({ award: a.title, desc: a.description || "", name: n.name, image: n.image || "", kind: winners.length > 1 ? "Joint winner" : "Winner", line: `${n.votes || 0} of ${a.total || 0} votes${a.total ? ` · ${Math.round(((n.votes || 0) / a.total) * 100)}%` : ""}` });
  }
  for (const w of d.wildcards || []) {
    const people = w.people || w.winners.map((name) => ({ name, image: "" }));
    for (const p of people) sheets.push({ award: w.title, desc: "", name: "@" + p.name, image: p.image, kind: "Wildcard", line: `Picked by ${d.wildcardsBy || "Aleks"}` });
  }

  return (
    <div className={`${styles.printWrap} ${themeClass(d.theme)}`}>
      <div className={styles.printBar}>
        <div><b>{sheets.length} winner sheets</b> · AK9 Awards {d.label}. Print them, or pick &quot;Save as PDF&quot; in the print window.</div>
        <button className={styles.btn} onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <div className={styles.sheets}>
        {sheets.map((s, i) => (
          <section key={i} className={styles.sheet}>
            <div className={styles.sheetFrame}>
              <div className={styles.sheetTop}>AK9 AWARDS · {d.label.toUpperCase()}</div>
              <div className={styles.sheetKind}>{s.kind}</div>
              {s.image
                ? <img className={styles.sheetFace} src={s.image} alt="" />  // eslint-disable-line @next/next/no-img-element
                : <span className={styles.sheetFace}>{s.name.replace("@", "").slice(0, 1).toUpperCase()}</span>}
              <div className={styles.sheetName}>{s.name}</div>
              <div className={styles.sheetFor}>is the winner of</div>
              <div className={styles.sheetAward}>{s.award}</div>
              {s.desc && <div className={styles.sheetDesc}>{s.desc}</div>}
              <div className={styles.sheetLine}>{s.line}</div>
              <div className={styles.sheetSign}><span>AleksK9</span><small>aleksk9.com/awards</small></div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
