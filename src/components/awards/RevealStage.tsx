"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Face, Theme, Wildcard, WORDS, loginUrl, pad2, themeClass } from "./shared";
import { Pumpkin } from "./Pumpkin";
import { EvidenceBag, BagStage } from "./EvidenceBag";
import { CountUp, Gate, Letters, PUMPKIN_COLORS, confetti, rustle, snip, splat, titleTime, tone } from "./stage-bits";

/* /awards/reveal: the page Aleks shows on stream to reveal the winners one award at a time.
   Before the winners are published only admins can open it; afterwards (or with ?season=<id>) anyone can
   replay it. Space / → next, ← back, F fullscreen. */
type Show = { revealStyle?: string; wildcardsBy?: string; label: string; theme: Theme; totalVoters: number; awards: Award[]; wildcards: Wildcard[] };
/* Which reveal to play: the season's choice, else the evidence bag for the crime theme and the pumpkin otherwise. */
type RevealStyle = "pumpkin" | "spotlight" | "evidence";
const styleOf = (s: Show | null): RevealStyle => (s?.revealStyle === "spotlight" || s?.revealStyle === "evidence" || s?.revealStyle === "pumpkin") ? s.revealStyle : s?.theme === "crime" ? "evidence" : "pumpkin";
type Step = { kind: "intro" } | { kind: "award"; i: number } | { kind: "win"; i: number } | { kind: "wild" } | { kind: "outro" };

export function RevealStage() {
  const [show, setShow] = useState<Show | null>(null);
  const [gate, setGate] = useState<"" | "login" | "admin" | "error">("");
  const [canPublish, setCanPublish] = useState(false);
  const [published, setPublished] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"idle" | "suspense" | "pumpkin" | "burst" | "shown">("idle");
  const [hits, setHits] = useState(0);
  const [bagOpen, setBagOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [flash, setFlash] = useState(0);
  const [spot, setSpot] = useState(-1);
  const [sound, setSound] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search), past = q.get("season"), key = q.get("k");
    (async () => {
      try {
        if (key) {
          const r = await fetch("/api/awards?share=" + encodeURIComponent(key), { cache: "no-store" });
          if (!r.ok) throw new Error();
          const d = await r.json(); setShow(d.season); return;
        }
        if (past) {
          const r = await fetch("/api/awards?season=" + encodeURIComponent(past), { cache: "no-store" });
          if (!r.ok) throw new Error();
          const d = await r.json(); setShow(d.season); return;
        }
        const a = await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (a.ok) {
          const d = await a.json();
          if (!d.season || !d.results) { setGate("error"); return; }
          setShow({ label: d.season.label, theme: d.season.theme, totalVoters: d.results.totalVoters, awards: d.results.awards, wildcards: d.season.wildcards || [], wildcardsBy: d.season.wildcardsBy, revealStyle: d.season.revealStyle });
          setCanPublish(!d.demo && d.stage !== "revealed"); return;
        }
        const p = await (await fetch("/api/awards", { cache: "no-store" })).json();
        if (p.results && p.season) { setShow({ label: p.season.label, theme: p.season.theme, totalVoters: p.results.totalVoters, awards: p.results.awards, wildcards: p.results.wildcards || [], wildcardsBy: p.season.wildcardsBy, revealStyle: p.season.revealStyle }); return; }
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
    const rs = styleOf(show);
    if (rs === "pumpkin" || rs === "evidence") { setHits(0); setBagOpen(false); setPhase("pumpkin"); return; }
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

  /* A drum hit as each finalist flips in. */
  useEffect(() => {
    if (!show || !cur || cur.kind !== "award" || !sound) return;
    const a = show.awards[cur.i], base = titleTime(a.title) + (a.description ? 0.6 : 0.2);
    const ts = a.nominees.map((_, i) => setTimeout(() => tone(150 - i * 8, 0.12, "triangle", 0.12), (base + i * 0.45) * 1000));
    return () => ts.forEach(clearTimeout);
  }, [step, show, sound]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Heartbeat while the pumpkin waits, faster after every hit. */
  useEffect(() => {
    if (phase !== "pumpkin" || !sound) return;
    const gap = [1100, 760, 480][Math.min(2, hits)];
    const beat = () => { tone(62, 0.14, "sine", 0.32); setTimeout(() => tone(55, 0.16, "sine", 0.24), 170); };
    beat(); const t = setInterval(beat, gap);
    return () => clearInterval(t);
  }, [phase, hits, sound]);

  /* Three hits break the pumpkin, then the winner pops out. */
  const smash = useCallback(() => {
    if (phase !== "pumpkin") return;
    const h = hits + 1; setHits(h); setShaking(false); requestAnimationFrame(() => setShaking(true)); setTimeout(() => setShaking(false), 450);
    if (sound) { tone(110, 0.18, "sine", 0.25); tone(70, 0.22, "sine", 0.2); }
    if (h >= 3) {
      setPhase("burst"); setFlash((x) => x + 1); if (sound) splat(); burst(PUMPKIN_COLORS);
      setTimeout(() => { setPhase("shown"); if (sound) { tone(523, 0.5); tone(659, 0.5); tone(784, 0.7); } }, 700);
      setTimeout(() => { burst(); if (sound) tone(1046, 0.4, "triangle", 0.05); }, 1500);   /* confetti when the stamp lands */
    }
  }, [phase, hits, sound]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Scissors along the dotted line, the bag drifts open, the case file slides out, GUILTY settles on last. */
  const cut = useCallback(() => {
    if (phase !== "pumpkin") return;
    setPhase("burst"); setBagOpen(false); if (sound) snip();
    setTimeout(() => { setBagOpen(true); if (sound) rustle(); }, 1050);
    setTimeout(() => { setPhase("shown"); if (sound) { tone(95, 0.3, "sine", 0.35); tone(60, 0.35, "sine", 0.25); } }, 2500);
    setTimeout(() => { burst(["#b81c14", "#d8342a", "#ffd400", "#eceae3", "#111111"]); if (sound) { tone(523, 0.5); tone(659, 0.5); tone(784, 0.7); } }, 3100);
  }, [phase, sound]); // eslint-disable-line react-hooks/exhaustive-deps

  const revealStyle = styleOf(show);
  const next = useCallback(() => {
    if (cur && cur.kind === "win" && phase === "pumpkin") { if (revealStyle === "evidence") cut(); else smash(); return; }
    if (cur && cur.kind === "win" && (phase === "suspense" || phase === "burst")) return;   /* let the reveal finish */
    setStep((x) => Math.min(steps.length - 1, x + 1));
  }, [cur, phase, steps.length, smash, cut, revealStyle]);
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

  function burst(colors?: string[]) { confetti(confettiRef.current, colors); }

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
    <div className={`${styles.stage} ${themeClass(show.theme)} ${cur.kind === "win" && phase !== "shown" ? styles.stageDim : ""} ${cur.kind === "win" && phase === "shown" ? styles.stageLit : ""}`} ref={stageRef} onClick={(e) => { if ((e.target as HTMLElement).closest("button,a")) return; next(); }}>
      <div className={styles.sweep} aria-hidden="true" />
      {flash > 0 && <div key={"f" + flash} className={styles.flashOverlay} aria-hidden="true" />}
      <canvas ref={confettiRef} className={styles.confetti} />
      <div className={`${styles.stageInner} ${shaking ? styles.shakeIt : ""}`}>
        {cur.kind === "intro" && (
          <div key={"st" + step} className={styles.sIntro}>
            <div className={`${styles.kicker} ${styles.fadeUp}`}>{w.kicker}…</div>
            <Letters text="AK9 Awards" delay={0.4} step={0.09} className={styles.sTitle} />
            <div className={`${styles.sSub} ${styles.fadeUp}`} style={{ animationDelay: "1.5s" }}>{show.label} · The winners</div>
            <div className={`${styles.sHint} ${styles.fadeUp}`} style={{ animationDelay: "2.2s" }}><CountUp to={show.totalVoters} delay={2200} ms={1200} /> people voted · press space to begin</div>
          </div>
        )}
        {(cur.kind === "award" || cur.kind === "win") && (() => {
          const a = show.awards[cur.i];
          const winners = a.nominees.filter((n) => (a.winnerIds || []).includes(n.id));
          const shown = cur.kind === "win" && phase === "shown";
          const total = a.total || 0;
          const pct = (v = 0) => (total ? ` · ${Math.round((v / total) * 100)}%` : "");
          const word = w.winner.toLowerCase() === "guilty" ? "verdict" : "winner";
          if (cur.kind === "win" && revealStyle === "evidence" && winners.length) {
            const bagStage: BagStage = phase === "shown" ? "revealed" : phase === "burst" ? (bagOpen ? "open" : "cutting") : "sealed";
            return (
              <div key={"st" + step} className={styles.sAward}>
                <div className={styles.anum}>{w.award} {pad2(cur.i + 1)} of {pad2(show.awards.length)} · {a.title}</div>
                <EvidenceBag a={a} i={cur.i} label={show.label} verdict={w.winner} stage={bagStage} onCut={cut} />
                {phase === "pumpkin" && <div className={`${styles.sHint} ${styles.pulse}`}>tap the evidence bag to cut it open</div>}
                <div className={`${styles.sNoms} ${styles.sNomsSmall} ${phase !== "shown" ? styles.nervous : ""}`}>
                  {a.nominees.filter((n) => phase !== "shown" || !winners.includes(n)).map((n, ni) => (
                    <div key={n.id} className={`${styles.sNom} ${phase === "shown" ? `${styles.sLose} ${styles.fadeUp}` : ""}`} style={phase === "shown" ? { animationDelay: `${0.6 + ni * 0.3}s` } : { animationDelay: `${ni * 0.15}s` }}>
                      <Face n={n} size={56} />
                      <div className={styles.sNomName}>{n.name}</div>
                      {phase === "shown" && <div className={styles.sVotes}><CountUp to={n.votes || 0} delay={600 + ni * 300} ms={900} /> vote{n.votes === 1 ? "" : "s"}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (cur.kind === "win" && revealStyle === "pumpkin" && winners.length) {
            return (
              <div key={"st" + step} className={styles.sAward}>
                <div className={styles.anum}>{w.award} {pad2(cur.i + 1)} of {pad2(show.awards.length)}</div>
                <div className={styles.sAwardTitle}>{a.title}</div>
                {phase === "shown" ? (
                  <div className={styles.sWinHero}>
                    <div className={styles.beam} aria-hidden="true" />
                    {winners.map((n, wi) => (
                      <div key={n.id} className={styles.sWinOne} style={{ animationDelay: `${wi * 0.25}s` }}>
                        <Face n={n} size={180} />
                        <div className={`${styles.stamp} ${styles.stampSlam}`}>{w.winner}{winners.length > 1 ? " · tie" : ""}</div>
                        <Letters text={n.name} delay={0.35} step={0.045} className={styles.sWinName} />
                        <div className={`${styles.sVotes} ${styles.fadeUp}`} style={{ animationDelay: "1s" }}><CountUp to={n.votes || 0} delay={1000} /> vote{n.votes === 1 ? "" : "s"}{pct(n.votes)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button type="button" className={styles.pkBtn} onClick={smash} aria-label="Smash the pumpkin">
                    <Pumpkin hits={hits} burst={phase === "burst"} />
                  </button>
                )}
                {phase === "pumpkin" && <div key={"h" + hits} className={`${styles.sHint} ${styles.pulse}`}>{["smash the pumpkin to reveal the " + word, "harder…", "one more!"][hits]} · {3 - hits} hit{3 - hits === 1 ? "" : "s"} left</div>}
                <div className={`${styles.sNoms} ${styles.sNomsSmall} ${phase !== "shown" ? styles.nervous : ""}`}>
                  {a.nominees.filter((n) => phase !== "shown" || !winners.includes(n)).map((n, ni) => (
                    <div key={n.id} className={`${styles.sNom} ${phase === "shown" ? `${styles.sLose} ${styles.fadeUp}` : ""}`} style={phase === "shown" ? { animationDelay: `${1.6 + ni * 0.3}s` } : { animationDelay: `${ni * 0.15}s` }}>
                      <Face n={n} size={56} />
                      <div className={styles.sNomName}>{n.name}</div>
                      {phase === "shown" && <div className={styles.sVotes}><CountUp to={n.votes || 0} delay={1600 + ni * 300} ms={900} /> vote{n.votes === 1 ? "" : "s"}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          const tT = titleTime(a.title), dT = tT + (a.description ? 0.6 : 0.2);
          const intro = cur.kind === "award";
          return (
            <div key={"st" + step} className={styles.sAward}>
              <div className={`${styles.anum} ${intro ? styles.fadeUp : ""}`}>{w.award} {pad2(cur.i + 1)} of {pad2(show.awards.length)}</div>
              {intro ? <Letters text={a.title} delay={0.25} className={styles.sAwardTitle} /> : <div className={styles.sAwardTitle}>{a.title}</div>}
              {a.description && intro && <div className={`${styles.sDesc} ${styles.fadeUp}`} style={{ animationDelay: `${tT}s` }}>{a.description}</div>}
              <div className={styles.sNoms}>
                {a.nominees.map((n, idx) => {
                  const isWin = winners.includes(n);
                  const cls = [styles.sNom, cur.kind === "win" && phase === "suspense" && spot === idx ? styles.spot : "", shown && isWin ? styles.sWin : "", shown && !isWin ? styles.sLose : ""].join(" ");
                  return (
                    <div key={n.id} className={`${cls} ${intro ? styles.flipIn : ""}`} style={intro ? { animationDelay: `${dT + idx * 0.45}s` } : undefined}>
                      <Face n={n} size={shown && isWin ? 150 : 96} />
                      <div className={styles.sNomName}>{n.name}</div>
                      {shown && <div className={styles.sVotes}>{n.votes || 0} vote{n.votes === 1 ? "" : "s"}{total ? ` · ${Math.round(((n.votes || 0) / total) * 100)}%` : ""}</div>}
                      {shown && isWin && <div className={styles.stamp}>{w.winner}{winners.length > 1 ? " · tie" : ""}</div>}
                    </div>
                  );
                })}
              </div>
              {intro && <div className={`${styles.sHint} ${styles.fadeUp}`} style={{ animationDelay: `${dT + a.nominees.length * 0.45 + 0.3}s` }}>press space to reveal the {word}</div>}
              {cur.kind === "win" && phase === "suspense" && <div className={styles.sHint}>and the {w.winner.toLowerCase() === "guilty" ? "verdict" : "winner"} is…</div>}
              {shown && !winners.length && <div className={styles.sDesc}>No votes were cast for this one.</div>}
            </div>
          );
        })()}
        {cur.kind === "wild" && (
          <div key={"st" + step} className={styles.sAward}>
            <div className={`${styles.anum} ${styles.fadeUp}`}>Wildcards · picked by {show.wildcardsBy || "Aleks"}</div>
            <div className={styles.sWildGrid}>
              {show.wildcards.map((wc, wi) => (
                <div key={wc.title} className={`${styles.sWild} ${styles.flipIn}`} style={{ animationDelay: `${0.5 + wi * 0.9}s` }}>
                  <div className={styles.sWildTitle}>{wc.title}</div>
                  <div className={styles.sWildPeople}>{(wc.people || wc.winners.map((name) => ({ name, image: "" }))).map((p) => <span key={p.name}><Face n={p} size={72} />@{p.name}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {cur.kind === "outro" && (
          <div key={"st" + step} className={styles.sIntro}>
            <Letters text="That's a wrap" delay={0.2} step={0.06} className={styles.sTitle} />
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
