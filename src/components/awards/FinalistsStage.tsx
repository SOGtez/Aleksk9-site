"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Face, Theme, WORDS, loginUrl, pad2, themeClass } from "./shared";
import { Pumpkin } from "./Pumpkin";
import { Gate, Letters, PUMPKIN_COLORS, confetti, splat, titleTime, tone } from "./stage-bits";

/* /awards/finalists: the page Aleks shows on stream to reveal the finalists, before voting opens. Every award gets one
   pumpkin per finalist, lined up left to right; smash them one at a time (left to right) and the finalist pops out.
   The private list at /awards/finalists/sheet shows the same order, so he knows who is in the next pumpkin.
   Admins see the current season while the finalists are still secret; once voting is open (or with ?season=<id>)
   anyone can replay it. Space / → smash the next pumpkin or move on, ← back, F fullscreen. ?hits=3 for three hits a pumpkin.
   Where the show is goes to localStorage so the sheet, open in another tab of the same browser, follows along. */
type Show = { id: string; label: string; theme: Theme; phase?: string; awards: Award[] };
type Step = { kind: "intro" } | { kind: "award"; i: number } | { kind: "outro" };
export const SYNC_KEY = "ak9.finalists.pos";
export type SyncPos = { season: string; award: number; revealed: number; done: boolean; at: number };

export function FinalistsStage() {
  const [show, setShow] = useState<Show | null>(null);
  const [full, setFull] = useState<Record<string, unknown> | null>(null);   /* the admin season, to open voting from the outro */
  const [gate, setGate] = useState<"" | "login" | "admin" | "error">("");
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(0);        /* finalists already out of their pumpkins on this award */
  const [hits, setHits] = useState(0);                /* hits on the pumpkin that is up */
  const [bursting, setBursting] = useState(false);    /* that pumpkin is flying apart */
  const [hitsNeeded, setHitsNeeded] = useState(1);
  const [shaking, setShaking] = useState(false);
  const [flash, setFlash] = useState(0);
  const [sound, setSound] = useState(true);
  const [opened, setOpened] = useState<"" | "busy" | "done" | "fail">("");
  const stageRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(location.search), past = q.get("season"), h = Math.floor(Number(q.get("hits")));
    setHitsNeeded(h >= 1 && h <= 3 ? h : 1);
    const pick = (s: Show): Show => ({ id: s.id, label: s.label, theme: s.theme, phase: s.phase, awards: s.awards || [] });
    (async () => {
      try {
        if (past) {
          const r = await fetch("/api/awards?season=" + encodeURIComponent(past), { cache: "no-store" });
          if (!r.ok) throw new Error();
          setShow(pick((await r.json()).season)); return;
        }
        const a = await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (a.ok) {
          const d = await a.json();
          if (!d.season) { setGate("error"); return; }
          setShow(pick(d.season)); if (!d.demo) setFull(d.season); return;
        }
        const p = await (await fetch("/api/awards", { cache: "no-store" })).json();
        if (p.season && (p.season.awards as Award[]).some((x) => x.nominees.length)) { setShow(pick(p.season)); return; }
        setGate(p.me && p.me.loggedIn ? "admin" : "login");
      } catch { setGate("error"); }
    })();
  }, []);

  const steps: Step[] = useMemo(() => show ? [{ kind: "intro" }, ...show.awards.map((_, i): Step => ({ kind: "award", i })), { kind: "outro" }] : [], [show]);
  const cur = steps[step];
  const a = show && cur && cur.kind === "award" ? show.awards[cur.i] : null;
  const n = a ? a.nominees.length : 0;

  useEffect(() => { setRevealed(0); setHits(0); setBursting(false); slotRefs.current = []; }, [step]);

  /* Tell the sheet where we are. */
  useEffect(() => {
    if (!show || !cur) return;
    const pos: SyncPos = { season: show.id, award: cur.kind === "award" ? cur.i : -1, revealed, done: cur.kind === "outro", at: Date.now() };
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(pos)); } catch { /* private mode */ }
  }, [show, cur, revealed]);

  /* A thud as each pumpkin lands. */
  useEffect(() => {
    if (!a || !sound) return;
    const base = titleTime(a.title) + (a.description ? 0.6 : 0.2);
    const ts = a.nominees.map((_, i) => setTimeout(() => { tone(90 - i * 4, 0.16, "sine", 0.2); tone(150, 0.06, "triangle", 0.08); }, (base + i * 0.25 + 0.9) * 1000));
    return () => ts.forEach(clearTimeout);
  }, [step, show, sound]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Hit the pumpkin that is up. When it breaks, the finalist pops out and the next one is up. */
  const smash = useCallback(() => {
    if (!a || revealed >= n || bursting) return;
    const h = hits + 1; setHits(h); setShaking(false); requestAnimationFrame(() => setShaking(true)); setTimeout(() => setShaking(false), 450);
    if (sound) { tone(110, 0.18, "sine", 0.25); tone(70, 0.22, "sine", 0.2); }
    if (h < hitsNeeded) return;
    setBursting(true); setFlash((x) => x + 1); if (sound) splat();
    const c = confettiRef.current, el = slotRefs.current[revealed];
    if (c && el) { const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect(); confetti(c, PUMPKIN_COLORS, { x: (er.left + er.width / 2 - cr.left) / cr.width, y: (er.top + er.height * 0.4 - cr.top) / cr.height }); }
    const k = revealed + 1;
    setTimeout(() => {
      setBursting(false); setHits(0); setRevealed(k);
      if (sound) { tone(523, 0.35); tone(659, 0.35); tone(784, 0.5); }
      if (k >= n) setTimeout(() => { confetti(confettiRef.current); if (sound) { tone(784, 0.3); tone(1046, 0.5, "triangle", 0.06); } }, 800);
    }, 650);
  }, [a, n, revealed, bursting, hits, hitsNeeded, sound]);

  const next = useCallback(() => {
    if (a && revealed < n) { smash(); return; }
    if (bursting) return;
    setStep((x) => Math.min(steps.length - 1, x + 1));
  }, [a, n, revealed, bursting, smash, steps.length]);
  const back = useCallback(() => setStep((x) => Math.max(0, x - 1)), []);
  const fullscreen = useCallback(() => { const el = stageRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") back();
      else if (e.key.toLowerCase() === "f") fullscreen();
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [next, back, fullscreen]);

  /* The outro, for admins: switch the season to voting so the finalists go up on aleksk9.com/awards. */
  async function openVoting() {
    if (!full || !confirm("Open voting now? The finalists go up on aleksk9.com/awards and followers can start voting.")) return;
    setOpened("busy");
    const r = await fetch("/api/awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", season: { ...full, phase: "vote" } }) });
    setOpened(r.ok ? "done" : "fail");
  }

  if (gate === "login") return <Gate h="Log in to open the finalists reveal" p="Before voting opens, only admins can see the finalists."><a className={styles.btn} href={loginUrl("/awards/finalists")}>Log in with Twitch</a></Gate>;
  if (gate === "admin") return <Gate h="Admins only" p="Voting hasn't opened yet, so only admins can open the finalists reveal." />;
  if (gate === "error") return <Gate h="Nothing to reveal yet" p="There is no season with finalists yet." />;
  if (!show || !cur) return <div className={styles.spin} aria-label="Loading" />;
  const w = show.theme === "crime" ? WORDS.crime : WORDS[show.theme] || WORDS.classic;
  const totalFinalists = show.awards.reduce((s, x) => s + x.nominees.length, 0);
  const canOpen = !!full && show.phase !== "vote" && show.phase !== "closed" && show.phase !== "revealed";

  return (
    <div className={`${styles.stage} ${themeClass(show.theme)} ${a && revealed < n ? styles.stageDim : ""} ${a && n > 0 && revealed >= n ? styles.stageLit : ""}`} ref={stageRef} onClick={(e) => { if ((e.target as HTMLElement).closest("button,a")) return; next(); }}>
      <div className={styles.sweep} aria-hidden="true" />
      {flash > 0 && <div key={"f" + flash} className={styles.flashOverlay} aria-hidden="true" />}
      <canvas ref={confettiRef} className={styles.confetti} />
      <div className={`${styles.stageInner} ${shaking ? styles.shakeIt : ""}`}>
        {cur.kind === "intro" && (
          <div key={"st" + step} className={styles.sIntro}>
            <div className={`${styles.kicker} ${styles.fadeUp}`}>{w.kicker}…</div>
            <Letters text="AK9 Awards" delay={0.4} step={0.09} className={styles.sTitle} />
            <div className={`${styles.sSub} ${styles.fadeUp}`} style={{ animationDelay: "1.5s" }}>{show.label} · The {w.nominee.toLowerCase()}s</div>
            <div className={`${styles.sHint} ${styles.fadeUp}`} style={{ animationDelay: "2.2s" }}>{totalFinalists} {w.nominee.toLowerCase()}s · {show.awards.length} {w.award.toLowerCase()}s · press space to begin</div>
          </div>
        )}
        {a && cur.kind === "award" && (() => {
          const tT = titleTime(a.title), dT = tT + (a.description ? 0.6 : 0.2), done = n > 0 && revealed >= n;
          const left = n - revealed;
          return (
            <div key={"st" + step} className={styles.sAward}>
              <div className={`${styles.anum} ${styles.fadeUp}`}>{w.award} {pad2(cur.i + 1)} of {pad2(show.awards.length)} · the {w.nominee.toLowerCase()}s</div>
              <Letters text={a.title} delay={0.25} className={styles.sAwardTitle} />
              {a.description && <div className={`${styles.sDesc} ${styles.fadeUp}`} style={{ animationDelay: `${tT}s` }}>{a.description}</div>}
              {n === 0 && <div className={`${styles.sDesc} ${styles.fadeUp}`} style={{ animationDelay: `${dT}s` }}>No {w.nominee.toLowerCase()}s have been entered for this one yet.</div>}
              <div className={`${styles.fnRow} ${n > 5 ? styles.fnRowTight : ""}`}>
                {a.nominees.map((nom, k) => {
                  const out = k < revealed, up = k === revealed && !done;
                  return (
                    <div key={nom.id} ref={(el) => { slotRefs.current[k] = el; }} className={`${styles.fnSlot} ${styles.fadeUp} ${up ? styles.fnUp : ""} ${k > revealed ? styles.fnWait : ""}`} style={{ animationDelay: `${dT + k * 0.25}s`, "--pk-delay": `${dT + k * 0.25}s` } as React.CSSProperties}>
                      {out ? (
                        <div className={styles.fnOut}>
                          <Face n={nom} size={n > 5 ? 96 : 128} />
                          <Letters text={nom.name} delay={0.25} step={0.04} className={styles.fnName} />
                        </div>
                      ) : (
                        <button type="button" className={styles.pkBtn} onClick={(e) => { e.stopPropagation(); if (up) smash(); else if (!bursting) next(); }} aria-label={up ? "Smash the pumpkin" : "Not yet"} tabIndex={up ? 0 : -1}>
                          <Pumpkin hits={up ? hits : 0} burst={up && bursting} />
                        </button>
                      )}
                      <div className={styles.fnNum}>{w.nominee} {k + 1}</div>
                    </div>
                  );
                })}
              </div>
              {n > 0 && !done && !bursting && (
                <div key={"h" + revealed + "-" + hits} className={`${styles.sHint} ${styles.pulse}`}>
                  {hitsNeeded > 1 && hits > 0 ? ["harder…", "one more!"][Math.min(1, hits - 1)] : revealed === 0 ? `smash the first pumpkin · ${left} ${w.nominee.toLowerCase()}${left === 1 ? "" : "s"} inside` : `${left} pumpkin${left === 1 ? "" : "s"} left`}
                </div>
              )}
              {(done || n === 0) && <div className={`${styles.sHint} ${styles.fadeUp}`} style={{ animationDelay: done ? "1.2s" : `${dT + 0.3}s` }}>{cur.i + 1 < show.awards.length ? `press space for the next ${w.award.toLowerCase()}` : "press space to finish"}</div>}
            </div>
          );
        })()}
        {cur.kind === "outro" && (
          <div key={"st" + step} className={styles.sIntro}>
            <Letters text="That's the lineup" delay={0.2} step={0.06} className={styles.sTitle} />
            <div className={styles.sSub}>{totalFinalists} {w.nominee.toLowerCase()}s · {show.awards.length} {w.award.toLowerCase()}s · {show.label}</div>
            {canOpen && opened !== "done" && <button className={styles.btn} onClick={openVoting} disabled={opened === "busy"}>{opened === "busy" ? "Opening…" : "Open voting on the site"}</button>}
            {opened === "done" && <div className={styles.sHint}>Voting is open: the finalists are on aleksk9.com/awards.</div>}
            {opened === "fail" && <div className={styles.sHint}>Could not open voting. Set the phase to &quot;Voting open&quot; on the admin page instead.</div>}
            {!canOpen && !!full && <div className={styles.sHint}>Voting is already open on aleksk9.com/awards.</div>}
          </div>
        )}
      </div>
      <div className={styles.sBar}>
        <button onClick={back} disabled={step === 0}>← Back</button>
        <span>{step + 1} / {steps.length}</span>
        <button onClick={next} disabled={step === steps.length - 1}>Next →</button>
        <button onClick={() => setSound(!sound)}>{sound ? "Sound on" : "Sound off"}</button>
        <button onClick={fullscreen}>Fullscreen (F)</button>
      </div>
    </div>
  );
}
