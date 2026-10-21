"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Face, Theme, Wildcard, WORDS, loginUrl, pad2, themeClass } from "./shared";

/* /awards/reveal: the page Aleks shows on stream to reveal the winners one award at a time.
   Before the winners are published only admins can open it; afterwards (or with ?season=<id>) anyone can
   replay it. Space / → next, ← back, F fullscreen. */
type Show = { wildcardsBy?: string; label: string; theme: Theme; totalVoters: number; awards: Award[]; wildcards: Wildcard[] };
type Step = { kind: "intro" } | { kind: "award"; i: number } | { kind: "win"; i: number } | { kind: "wild" } | { kind: "outro" };

let ac: AudioContext | null = null;
function tone(f: number, d = 0.08, type: OscillatorType = "triangle", v = 0.05) {
  try {
    ac = ac || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch { /* no audio */ }
}

export function RevealStage() {
  const [show, setShow] = useState<Show | null>(null);
  const [gate, setGate] = useState<"" | "login" | "admin" | "error">("");
  const [canPublish, setCanPublish] = useState(false);
  const [published, setPublished] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"idle" | "suspense" | "shown">("idle");
  const [spot, setSpot] = useState(-1);
  const [sound, setSound] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search), past = q.get("season");
    (async () => {
      try {
        if (past) {
          const r = await fetch("/api/awards?season=" + encodeURIComponent(past), { cache: "no-store" });
          if (!r.ok) throw new Error();
          const d = await r.json(); setShow(d.season); return;
        }
        const a = await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (a.ok) {
          const d = await a.json();
          if (!d.season || !d.results) { setGate("error"); return; }
          setShow({ label: d.season.label, theme: d.season.theme, totalVoters: d.results.totalVoters, awards: d.results.awards, wildcards: d.season.wildcards || [], wildcardsBy: d.season.wildcardsBy });
          setCanPublish(!d.demo && d.stage !== "revealed"); return;
        }
        const p = await (await fetch("/api/awards", { cache: "no-store" })).json();
        if (p.results && p.season) { setShow({ label: p.season.label, theme: p.season.theme, totalVoters: p.results.totalVoters, awards: p.results.awards, wildcards: p.results.wildcards || [], wildcardsBy: p.season.wildcardsBy }); return; }
        setGate(p.me && p.me.loggedIn ? "admin" : "login");
      } catch { setGate("error"); }
    })();
  }, []);

  const steps: Step[] = useMemo(() => {
    if (!show) return [];
    const s: Step[] = [{ kind: "intro" }];
    show.awards.forEach((_, i) => { s.push({ kind: "award", i }, { kind: "win", i }); });
    if (show.wildcards && show.wildcards.length) s.push({ kind: "wild" });
    s.push({ kind: "outro" });
    return s;
  }, [show]);
  const cur = steps[step];

  /* The drumroll: a spotlight jumps between the finalists, slowing down, then lands on the winner. */
  useEffect(() => {
    if (!show || !cur || cur.kind !== "win") { setPhase("idle"); setSpot(-1); return; }
    const a = show.awards[cur.i];
    if (!a.nominees.length || !(a.winnerIds || []).length) { setPhase("shown"); return; }
    setPhase("suspense");
    const n = a.nominees.length, winIdx = a.nominees.findIndex((x) => (a.winnerIds || []).includes(x.id));
    let k = 0, delay = 90, timer: ReturnType<typeof setTimeout>;
    const hops = 16 + ((winIdx - 16) % n + n) % n;               /* ends exactly on the winner */
    const hop = () => {
      setSpot(k % n); if (sound) tone(380 + (k % n) * 40, 0.05, "square", 0.03);
      if (k >= hops) { timer = setTimeout(() => { setPhase("shown"); if (sound) { tone(523, 0.5); tone(659, 0.5); tone(784, 0.7); } burst(); }, 450); return; }
      k++; delay *= 1.12; timer = setTimeout(hop, delay);
    };
    timer = setTimeout(hop, 300);
    return () => clearTimeout(timer);
  }, [step, show]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    if (cur && cur.kind === "win" && phase === "suspense") return;   /* let the drumroll finish */
    setStep((x) => Math.min(steps.length - 1, x + 1));
  }, [cur, phase, steps.length]);
  const back = useCallback(() => setStep((x) => Math.max(0, x - 1)), []);
  const full = useCallback(() => { const el = stageRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") back();
      else if (e.key.toLowerCase() === "f") full();
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [next, back, full]);

  function burst() {
    const c = confettiRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const W = (c.width = c.clientWidth), H = (c.height = c.clientHeight);
    const cols = ["#ffd166", "#ff3b30", "#fd6325", "#a78bfa", "#ffffff", "#4cc3ff"];
    const ps = Array.from({ length: 160 }, () => ({ x: W / 2, y: H * 0.45, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, r: 3 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6 }));
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.vx *= 0.99; p.a += 0.2; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      if (++t < 150) requestAnimationFrame(draw); else ctx.clearRect(0, 0, W, H);
    };
    draw();
  }

  async function publish() {
    if (!confirm("Publish the winners on aleksk9.com/awards and add this season to the Hall of Fame?")) return;
    const r = await fetch("/api/awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
    if (r.ok) { setPublished(true); setCanPublish(false); } else alert((await r.json()).error || "Could not publish");
  }

  if (gate === "login") return <Gate h="Log in to open the reveal" p="Before the winners are published, only admins can open this page."><a className={styles.btn} href={loginUrl("/awards/reveal")}>Log in with Twitch</a></Gate>;
  if (gate === "admin") return <Gate h="Admins only" p="The winners aren't published yet, so only admins can open the reveal." />;
  if (gate === "error") return <Gate h="Nothing to reveal yet" p="There is no season with results yet." />;
  if (!show || !cur) return <div className={styles.spin} aria-label="Loading" />;
  const w = WORDS[show.theme];

  return (
    <div className={`${styles.stage} ${themeClass(show.theme)}`} ref={stageRef} onClick={(e) => { if ((e.target as HTMLElement).closest("button,a")) return; next(); }}>
      <canvas ref={confettiRef} className={styles.confetti} />
      <div className={styles.stageInner}>
        {cur.kind === "intro" && (
          <div className={styles.sIntro}>
            <div className={styles.kicker}>{w.kicker}…</div>
            <div className={styles.sTitle}>AK9 Awards</div>
            <div className={styles.sSub}>{show.label} · The winners</div>
            <div className={styles.sHint}>{show.totalVoters} people voted · press space to begin</div>
          </div>
        )}
        {(cur.kind === "award" || cur.kind === "win") && (() => {
          const a = show.awards[cur.i];
          const winners = a.nominees.filter((n) => (a.winnerIds || []).includes(n.id));
          const shown = cur.kind === "win" && phase === "shown";
          const total = a.total || 0;
          return (
            <div className={styles.sAward}>
              <div className={styles.anum}>{w.award} {pad2(cur.i + 1)} of {pad2(show.awards.length)}</div>
              <div className={styles.sAwardTitle}>{a.title}</div>
              {a.description && cur.kind === "award" && <div className={styles.sDesc}>{a.description}</div>}
              <div className={styles.sNoms}>
                {a.nominees.map((n, idx) => {
                  const isWin = winners.includes(n);
                  const cls = [styles.sNom, cur.kind === "win" && phase === "suspense" && spot === idx ? styles.spot : "", shown && isWin ? styles.sWin : "", shown && !isWin ? styles.sLose : ""].join(" ");
                  return (
                    <div key={n.id} className={cls}>
                      <Face n={n} size={shown && isWin ? 150 : 96} />
                      <div className={styles.sNomName}>{n.name}</div>
                      {shown && <div className={styles.sVotes}>{n.votes || 0} vote{n.votes === 1 ? "" : "s"}{total ? ` · ${Math.round(((n.votes || 0) / total) * 100)}%` : ""}</div>}
                      {shown && isWin && <div className={styles.stamp}>{w.winner}{winners.length > 1 ? " · tie" : ""}</div>}
                    </div>
                  );
                })}
              </div>
              {cur.kind === "award" && <div className={styles.sHint}>press space to reveal the {w.winner.toLowerCase() === "guilty" ? "verdict" : "winner"}</div>}
              {cur.kind === "win" && phase === "suspense" && <div className={styles.sHint}>and the {w.winner.toLowerCase() === "guilty" ? "verdict" : "winner"} is…</div>}
              {shown && !winners.length && <div className={styles.sDesc}>No votes were cast for this one.</div>}
            </div>
          );
        })()}
        {cur.kind === "wild" && (
          <div className={styles.sAward}>
            <div className={styles.anum}>Wildcards · picked by {show.wildcardsBy || "Aleks"}</div>
            <div className={styles.sWildGrid}>
              {show.wildcards.map((wc) => (
                <div key={wc.title} className={styles.sWild}>
                  <div className={styles.sWildTitle}>{wc.title}</div>
                  <div className={styles.sWildPeople}>{(wc.people || wc.winners.map((name) => ({ name, image: "" }))).map((p) => <span key={p.name}><Face n={p} size={72} />@{p.name}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {cur.kind === "outro" && (
          <div className={styles.sIntro}>
            <div className={styles.sTitle}>That&apos;s a wrap</div>
            <div className={styles.sSub}>Thanks to all {show.totalVoters} voters · {show.label}</div>
            {canPublish && <button className={styles.btn} onClick={publish}>Publish the winners on the site</button>}
            {published && <div className={styles.sHint}>Published: the winners are on aleksk9.com/awards and in the Hall of Fame.</div>}
          </div>
        )}
      </div>
      <div className={styles.sBar}>
        <button onClick={back} disabled={step === 0}>← Back</button>
        <span>{step + 1} / {steps.length}</span>
        <button onClick={next} disabled={step === steps.length - 1}>Next →</button>
        <button onClick={() => setSound(!sound)}>{sound ? "Sound on" : "Sound off"}</button>
        <button onClick={full}>Fullscreen (F)</button>
      </div>
    </div>
  );
}

function Gate({ h, p, children }: { h: string; p: string; children?: React.ReactNode }) {
  return (
    <div className={`${styles.panel} ${styles.center}`}>
      <div className={styles.msgH}>{h}</div>
      <p className={styles.msgP}>{p}</p>
      {children}
      <p className={styles.msgP}><a href="/awards">Back to the awards</a></p>
    </div>
  );
}
