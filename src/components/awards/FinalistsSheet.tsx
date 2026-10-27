"use client";

import { useEffect, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Face, Theme, WORDS, loginUrl, pad2, themeClass } from "./shared";
import { SYNC_KEY, SyncPos } from "./FinalistsStage";

/* /awards/finalists/sheet: Aleks's private list for the finalists reveal. Every award with its finalists in pumpkin
   order (left to right on /awards/finalists), so he knows who is in the next pumpkin before he smashes it. With the
   reveal open in another tab of the same browser, the list follows along: the award on stream and the next finalist
   are marked. Admins only; nothing here is public. */
type Data = { id: string; label: string; theme: Theme; phase: string; awards: Award[] };

export function FinalistsSheet() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [pos, setPos] = useState<SyncPos | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (r.status === 403 || r.status === 401) { setErr("login"); return; }
        const j = await r.json();
        if (!j.season) throw new Error("There is no season yet.");
        setD({ id: j.season.id, label: j.season.label, theme: j.season.theme, phase: j.season.phase, awards: j.season.awards || [] });
      } catch (e) { setErr((e as Error).message || "Could not load."); }
    })();
  }, []);
  /* Follow the reveal page in another tab. */
  useEffect(() => {
    const read = () => { try { const v = localStorage.getItem(SYNC_KEY); setPos(v ? JSON.parse(v) : null); } catch { setPos(null); } };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === SYNC_KEY) read(); };
    addEventListener("storage", onStorage); const t = setInterval(read, 2000);
    return () => { removeEventListener("storage", onStorage); clearInterval(t); };
  }, []);

  if (err === "login") return <div className={`${styles.panel} ${styles.center}`}><div className={styles.msgH}>Admins only</div><p className={styles.msgP}>This list is private. Log in with an admin or AK9 Awards account to see the finalists.</p><a className={styles.btn} href={loginUrl("/awards/finalists/sheet")}>Log in with Twitch</a></div>;
  if (err) return <div className={`${styles.panel} ${styles.center}`}><p className={styles.msgP}>{err}</p></div>;
  if (!d) return <div className={styles.spin} aria-label="Loading" />;

  const w = WORDS[d.theme] || WORDS.classic;
  const live = pos && pos.season === d.id && Date.now() - pos.at < 6 * 3600e3 ? pos : null;   /* ignore a show from another season or another day */
  const total = d.awards.reduce((s, a) => s + a.nominees.length, 0);
  const nowAward = live && live.award >= 0 ? d.awards[live.award] : null;

  return (
    <div className={`${styles.fnSheet} ${themeClass(d.theme)}`}>
      <div className={styles.fnSheetBar}>
        <div>
          <div className={styles.anum}>Private · admins only</div>
          <div className={styles.msgH}>{w.nominee}s · AK9 Awards {d.label}</div>
          <p className={styles.msgP}>{total} {w.nominee.toLowerCase()}s across {d.awards.length} {w.award.toLowerCase()}s. The numbers match the pumpkins on the reveal page, left to right: smash them in order and the next name is always the next one down this list.</p>
          <p className={`${styles.msgP} ${styles.fnLive}`}>
            {live ? live.done ? "The reveal is on its last screen." : nowAward ? <>On stream now: <b>{w.award} {pad2(live.award + 1)} · {nowAward.title}</b>{live.revealed < nowAward.nominees.length ? <> · next pumpkin: <b>{w.nominee} {live.revealed + 1} · {nowAward.nominees[live.revealed]?.name}</b></> : " · all out, next award is up"}</> : "The reveal is on its intro screen."
              : "Open the reveal page in another tab of this browser and this list follows along, marking the next pumpkin."}
          </p>
        </div>
        <a className={styles.btn} href="/awards/finalists" target="_blank" rel="noopener">Open the reveal page</a>
      </div>
      <div className={styles.fnCards}>
        {d.awards.map((a, i) => {
          const now = !!live && live.award === i && !live.done;
          return (
            <div key={a.id} className={`${styles.fnCard} ${now ? styles.fnCardNow : ""} ${live && !live.done && live.award > i ? styles.fnCardDone : ""}`}>
              <div className={styles.anum}>{w.award} {pad2(i + 1)}{now ? " · on stream now" : ""}</div>
              <div className={styles.fnCardTitle}>{a.title}</div>
              {a.nominees.length === 0 && <div className={styles.sVotes}>No {w.nominee.toLowerCase()}s entered yet.</div>}
              <div className={styles.fnList}>
                {a.nominees.map((nom, k) => {
                  const done = now && k < live!.revealed, nextUp = now && k === live!.revealed;
                  return (
                    <div key={nom.id} className={`${styles.fnItem} ${nextUp ? styles.fnItemNext : ""} ${done ? styles.fnItemDone : ""}`}>
                      <span className={styles.fnBadge}>{k + 1}</span>
                      <Face n={nom} size={34} />
                      <span className={styles.fnItemName}>{nom.name}{nom.login && nom.login.toLowerCase() !== nom.name.toLowerCase() ? <span className={styles.fnLogin}> @{nom.login}</span> : null}</span>
                      {nextUp && <span className={styles.stamp}>next</span>}
                      {done && <span className={styles.fnTick}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
