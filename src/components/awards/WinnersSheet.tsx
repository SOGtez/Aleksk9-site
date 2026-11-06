"use client";

import { useEffect, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Face, Theme, WORDS, loginUrl, pad2, themeClass } from "./shared";
import { REVEAL_POS_KEY, RevealPos } from "./RevealStage";

/* /awards/reveal/sheet: Aleks's private list for the winner reveal, built like the finalists list
   (FinalistsSheet). Every award in reveal order with its winner on top and everyone's votes, so he knows who is
   in the pumpkin before he smashes it. It follows the reveal: from another tab of the same browser, or from any
   device (a phone) while the reveal is live for viewers. Admins only; nothing here is public. */
type Data = { id: string; label: string; theme: Theme; awards: Award[] };
type Live = { on: boolean; step?: number; phase?: string; at?: number };

export function WinnersSheet() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [pos, setPos] = useState<RevealPos | null>(null);
  const [live, setLive] = useState<Live | null>(null);

  /* Results, and where Aleks is when the reveal is live: refreshed every few seconds. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (r.status === 403 || r.status === 401) { setErr("login"); return; }
        const j = await r.json();
        if (!j.season || !j.results) throw new Error("There is no season yet.");
        if (stop) return;
        setD({ id: j.season.id, label: j.season.label, theme: j.season.theme, awards: j.results.awards || [] });
        setLive(j.live || null); setErr("");
      } catch (e) { setErr((e as Error).message || "Could not load."); }
      if (!stop) t = setTimeout(load, 4000);
    };
    load();
    return () => { stop = true; clearTimeout(t); };
  }, []);
  /* Follow the reveal page in another tab. */
  useEffect(() => {
    const read = () => { try { const v = localStorage.getItem(REVEAL_POS_KEY); setPos(v ? JSON.parse(v) : null); } catch { setPos(null); } };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === REVEAL_POS_KEY) read(); };
    addEventListener("storage", onStorage); const t = setInterval(read, 2000);
    return () => { removeEventListener("storage", onStorage); clearInterval(t); };
  }, []);

  if (err === "login") return <div className={`${styles.panel} ${styles.center}`}><div className={styles.msgH}>Admins only</div><p className={styles.msgP}>This list is private. Log in with an admin or AK9 Awards account to see the winners.</p><a className={styles.btn} href={loginUrl("/awards/reveal/sheet")}>Log in with Twitch</a></div>;
  if (err && !d) return <div className={`${styles.panel} ${styles.center}`}><p className={styles.msgP}>{err}</p></div>;
  if (!d) return <div className={styles.spin} aria-label="Loading" />;

  const w = WORDS[d.theme] || WORDS.classic;
  /* The newest of: this browser's reveal tab, or the live show. Ignore another season or another day. */
  const local = pos && pos.season === d.id && Date.now() - pos.at < 6 * 3600e3 ? pos : null;
  const remote = live && live.on && live.step != null ? { step: live.step, phase: live.phase || "", at: live.at || 0 } : null;
  const at = local && (!remote || local.at >= remote.at) ? local : remote;
  const n = d.awards.length;
  /* Steps on the reveal: 0 intro, then for award i a title screen (1 + 2i) and its reveal (2 + 2i), then the end. */
  const idx = at && at.step >= 1 && at.step <= 2 * n ? Math.floor((at.step - 1) / 2) : at && at.step > 2 * n ? n : -1;
  const opened = !!at && idx < n && at.step === 2 + 2 * idx && (at.phase === "shown" || at.phase === "burst");
  const nowAward = idx >= 0 && idx < n ? d.awards[idx] : null;
  const winnersOf = (a: Award) => a.nominees.filter((x) => (a.winnerIds || []).includes(x.id));

  return (
    <div className={`${styles.fnSheet} ${themeClass(d.theme)}`}>
      <div className={styles.fnSheetBar}>
        <div>
          <div className={styles.anum}>Private · admins only</div>
          <div className={styles.msgH}>{w.winner === "Guilty" ? "Verdicts" : "Winners"} · AK9 Awards {d.label}</div>
          <p className={styles.msgP}>{n} {w.award.toLowerCase()}s in the order of the reveal page. The winner is on top of each card, then everyone else by votes.</p>
          <p className={`${styles.msgP} ${styles.fnLive}`}>
            {!at ? "Open the winner reveal in another tab of this browser, or go live for viewers, and this list follows along."
              : idx < 0 ? "The reveal is on its intro screen."
              : idx >= n ? "The reveal is past the last award."
              : nowAward && <>On stream now: <b>{w.award} {pad2(idx + 1)} · {nowAward.title}</b>{opened ? " · revealed" : <> · in the pumpkin: <b>{winnersOf(nowAward).map((x) => x.name).join(" & ") || "no votes"}</b></>}</>}
          </p>
        </div>
        <a className={styles.btn} href="/awards/reveal" target="_blank" rel="noopener">Open the reveal page</a>
      </div>
      <div className={styles.fnCards}>
        {d.awards.map((a, i) => {
          const now = i === idx;
          const winners = winnersOf(a);
          const rest = a.nominees.filter((x) => !winners.includes(x));
          return (
            <div key={a.id} className={`${styles.fnCard} ${now ? styles.fnCardNow : ""} ${idx > i ? styles.fnCardDone : ""}`}>
              <div className={styles.anum}>{w.award} {pad2(i + 1)}{now ? (opened ? " · just revealed" : " · on stream now") : ""}</div>
              <div className={styles.fnCardTitle}>{a.title}</div>
              {!winners.length && <div className={styles.sVotes}>No votes for this one.</div>}
              <div className={styles.fnList}>
                {[...winners, ...rest].map((nom, k) => {
                  const win = winners.includes(nom);
                  return (
                    <div key={nom.id} className={`${styles.fnItem} ${win ? styles.wnWin : ""}`}>
                      <span className={styles.fnBadge}>{win ? "★" : k + 1}</span>
                      <Face n={nom} size={34} />
                      <span className={styles.fnItemName}>{nom.name}{nom.login && nom.login.toLowerCase() !== nom.name.toLowerCase() ? <span className={styles.fnLogin}> @{nom.login}</span> : null}</span>
                      {win && <span className={styles.stamp}>{w.winner}{winners.length > 1 ? " · tie" : ""}</span>}
                      <span className={styles.wnVotes}>{nom.votes || 0} vote{nom.votes === 1 ? "" : "s"}</span>
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
