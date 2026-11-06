"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./awards.module.scss";
import { Award, Face, Theme, Wildcard, WORDS, loginUrl, pad2, themeClass } from "./shared";
import { Pumpkin } from "./Pumpkin";
import { EvidenceBag, BagStage } from "./EvidenceBag";
import { CountUp, Gate, Letters, PUMPKIN_COLORS, confetti, rustle, snip, splat, titleTime, tone } from "./stage-bits";

/* /awards/reveal: the page Aleks shows on stream to reveal the winners one award at a time.
   Space / → next, ← back, F fullscreen. Admins run it ("host"). With "Go live" on, every step is sent to the
   server and everyone else opening this page follows along a few seconds behind (the stream delay), tapping
   the pumpkin to shake it; the crowd's taps show on Aleks's screen. Once the winners are published (or with
   ?season=<id>) anyone can replay it on their own. */
type Show = { revealStyle?: string; wildcardsBy?: string; label: string; theme: Theme; totalVoters: number; awards: Award[]; wildcards: Wildcard[] };
/* Which reveal to play: the season's choice, else the evidence bag for the crime theme and the pumpkin otherwise. */
type RevealStyle = "pumpkin" | "spotlight" | "evidence";
const styleOf = (s: Show | null): RevealStyle => (s?.revealStyle === "spotlight" || s?.revealStyle === "evidence" || s?.revealStyle === "pumpkin") ? s.revealStyle : s?.theme === "crime" ? "evidence" : "pumpkin";
type Step = { kind: "intro" } | { kind: "award"; i: number } | { kind: "win"; i: number } | { kind: "wild" } | { kind: "outro" };
type Phase = "idle" | "suspense" | "pumpkin" | "burst" | "shown";
/* One step of Aleks's screen as the server hands it to viewers (src/server/lib/awards-live.js). */
type Frame = { at: number; step: number; kind: Step["kind"]; i?: number; phase: Phase; hits: number; label: string; theme: Theme; revealStyle: string; wildcardsBy: string; totalVoters: number; nAwards: number; award?: Award; wildcards?: Wildcard[] };
type Live = { on: boolean; sid?: string; delay: number; host?: string };
const HOST_KEY = "ak9-live-host";
const POLL_MS = 2500;
const frameShow = (f: Frame): Show => ({
  label: f.label, theme: f.theme, totalVoters: f.totalVoters, revealStyle: f.revealStyle, wildcardsBy: f.wildcardsBy, wildcards: f.wildcards || [],
  awards: Array.from({ length: f.nAwards }, (_, j) => (j === f.i && f.award ? f.award : { id: "a" + j, title: "", nominees: [] })),
});
const frameCur = (f: Frame): Step => (f.kind === "award" || f.kind === "win" ? { kind: f.kind, i: f.i || 0 } : { kind: f.kind } as Step);
const byVotes = <T extends { votes?: number }>(l: T[]) => [...l].sort((x, y) => (y.votes || 0) - (x.votes || 0));

export function RevealStage() {
  const [show, setShow] = useState<Show | null>(null);
  const [gate, setGate] = useState<"" | "login" | "watch" | "admin" | "error">("");
  const [canPublish, setCanPublish] = useState(false);
  const [published, setPublished] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hits, setHits] = useState(0);
  const [bagOpen, setBagOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [flash, setFlash] = useState(0);
  const [spot, setSpot] = useState(-1);
  const [sound, setSound] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  /* Live show. viewer: following Aleks (frame = what is on screen); host: an admin, broadcasting when `hostSid` is set. */
  const [viewer, setViewer] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [ended, setEnded] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [hostSid, setHostSid] = useState("");
  const [delay, setDelay] = useState(5);
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [myTaps, setMyTaps] = useState(0);
  const pendingTaps = useRef(0);
  const wobbleRef = useRef<HTMLSpanElement>(null);
  const lastFrame = useRef<Frame | null>(null);
  const phaseRef = useRef(phase), hitsRef = useRef(hits), soundRef = useRef(sound);
  phaseRef.current = phase; hitsRef.current = hits; soundRef.current = sound;
  const liveSidRef = useRef("");
  const stepRef = useRef(step); stepRef.current = step;

  useEffect(() => {
    const q = new URLSearchParams(location.search), past = q.get("season"), key = q.get("k");
    (async () => {
      try {
        if (key) {
          const r = await fetch("/api/awards?share=" + encodeURIComponent(key), { cache: "no-store" });
          if (r.status === 401 || r.status === 403) { setGate(r.status === 401 ? "login" : "admin"); return; }
          if (!r.ok) throw new Error();
          const d = await r.json(); setShow(d.season); return;
        }
        if (past) {
          const r = await fetch("/api/awards?season=" + encodeURIComponent(past), { cache: "no-store" });
          if (!r.ok) throw new Error();
          const d = await r.json(); setShow(d.season); return;
        }
        /* ?watch: an admin seeing what viewers see. */
        const a = q.has("watch") ? null : await fetch("/api/awards?view=admin", { cache: "no-store" });
        if (a && a.ok) {
          const d = await a.json();
          if (!d.season || !d.results) { setGate("error"); return; }
          /* Results come sorted by votes; show the finalists in the season's order so the line-up doesn't give the winner away. */
          const order = (i: number) => ((d.season.awards[i] || {}).nominees || []).map((n: { id: string }) => n.id);
          const awards = d.results.awards.map((x: Award, i: number) => ({ ...x, nominees: [...x.nominees].sort((m, n) => order(i).indexOf(m.id) - order(i).indexOf(n.id)) }));
          setShow({ label: d.season.label, theme: d.season.theme, totalVoters: d.results.totalVoters, awards, wildcards: d.season.wildcards || [], wildcardsBy: d.season.wildcardsBy, revealStyle: d.season.revealStyle });
          setCanPublish(!d.demo && d.stage !== "revealed");
          const l: Live = d.live || { on: false, delay: 5 };
          setLive(l); setDelay(l.delay ?? 5);
          /* Reloading the broadcasting tab keeps the show going where it was. */
          try {
            const saved = JSON.parse(sessionStorage.getItem(HOST_KEY) || "null");
            if (l.on && saved && saved.sid === l.sid) { setHostSid(l.sid || ""); setStep(saved.step || 0); }
          } catch { /* no storage */ }
          return;
        }
        const p = await (await fetch("/api/awards", { cache: "no-store" })).json();
        /* Like the rest of the site, watching live needs a Twitch login. */
        if (!(p.me && p.me.loggedIn) && !p.demo) { setGate("watch"); return; }
        const lv = await (await fetch("/api/awards?live=1", { cache: "no-store" })).json();
        if (!lv.on && !q.has("watch") && p.results && p.season) { setShow({ label: p.season.label, theme: p.season.theme, totalVoters: p.results.totalVoters, awards: p.results.awards, wildcards: p.results.wildcards || [], wildcardsBy: p.season.wildcardsBy, revealStyle: p.season.revealStyle }); return; }
        setViewer(true);
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
  const cur = viewer ? (frame ? frameCur(frame) : undefined) : steps[step];

  /* The drumroll: a spotlight jumps between the finalists, slowing down, then lands on the winner. */
  useEffect(() => {
    if (viewer) return;                                     /* viewers get the phase from Aleks */
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
    if (h >= 3) breakOpen();
  }, [phase, hits, sound]); // eslint-disable-line react-hooks/exhaustive-deps
  function breakOpen() {
    const snd = soundRef.current;
    setPhase("burst"); setFlash((x) => x + 1); if (snd) splat(); burst(PUMPKIN_COLORS);
    setTimeout(() => { setPhase("shown"); if (snd) { tone(523, 0.5); tone(659, 0.5); tone(784, 0.7); } }, 700);
    setTimeout(() => { burst(); if (snd) tone(1046, 0.4, "triangle", 0.05); }, 1500);   /* confetti when the stamp lands */
  }

  /* Scissors along the dotted line, the bag drifts open, the case file slides out, GUILTY settles on last. */
  const cut = useCallback(() => {
    if (phase !== "pumpkin") return;
    openBag();
  }, [phase, sound]); // eslint-disable-line react-hooks/exhaustive-deps
  function openBag() {
    const snd = soundRef.current;
    setPhase("burst"); setBagOpen(false); if (snd) snip();
    setTimeout(() => { setBagOpen(true); if (snd) rustle(); }, 1050);
    setTimeout(() => { setPhase("shown"); if (snd) { tone(95, 0.3, "sine", 0.35); tone(60, 0.35, "sine", 0.25); } }, 2500);
    setTimeout(() => { burst(["#b81c14", "#d8342a", "#ffd400", "#eceae3", "#111111"]); if (snd) { tone(523, 0.5); tone(659, 0.5); tone(784, 0.7); } }, 3100);
  }

  /* The pumpkin (or bag) jiggles: a viewer's own tap, or on Aleks's screen when the crowd's taps come in. */
  function wobble() {
    const el = wobbleRef.current; if (!el) return;
    el.classList.remove(styles.pkTap); void el.offsetWidth; el.classList.add(styles.pkTap);
  }
  function tap() {
    if (phaseRef.current !== "pumpkin" && phaseRef.current !== "suspense") return;
    pendingTaps.current++; setMyTaps((x) => x + 1); wobble();
    if (soundRef.current) tone(80 + Math.random() * 50, 0.12, "sine", 0.2);
  }

  /* Viewers: show a new frame from Aleks, playing the same smash / cut / spotlight finish he just played. */
  function apply(f: Frame) {
    const prev = lastFrame.current;
    if (prev && prev.at === f.at) return;
    lastFrame.current = f;
    setFrame(f); setShow(frameShow(f));
    const rs = styleOf(frameShow(f));
    if (!prev || prev.step !== f.step) {
      setStep(f.step); setHits(f.hits); setBagOpen(f.phase === "shown"); setMyTaps(0); pendingTaps.current = 0;
      setPhase(f.kind !== "win" ? "idle" : f.phase === "burst" || f.phase === "shown" ? "shown" : rs === "spotlight" ? "suspense" : "pumpkin");
      return;
    }
    if (f.kind !== "win") return;
    if (f.hits > hitsRef.current && phaseRef.current === "pumpkin") {
      setHits(f.hits); setShaking(false); requestAnimationFrame(() => setShaking(true)); setTimeout(() => setShaking(false), 450);
      if (soundRef.current) { tone(110, 0.18, "sine", 0.25); tone(70, 0.22, "sine", 0.2); }
    }
    if ((f.phase === "burst" || f.phase === "shown") && (phaseRef.current === "pumpkin" || phaseRef.current === "suspense")) {
      if (rs === "evidence") openBag();
      else if (rs === "pumpkin") breakOpen();
      else { setPhase("shown"); if (soundRef.current) { tone(523, 0.5); tone(659, 0.5); tone(784, 0.7); } burst(); }
    }
  }

  /* Viewers poll for Aleks's screen (sending their taps along); the broadcasting host polls for the crowd's taps. */
  useEffect(() => {
    if (!viewer && !hostSid) return;
    let stop = false, t: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const n = pendingTaps.current, f = lastFrame.current;
        const body = viewer && n && f ? JSON.stringify({ sid: liveSidRef.current, step: f.step, n }) : null;
        if (body) pendingTaps.current = 0;
        const r = await fetch("/api/awards?live=1", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" } : { cache: "no-store" });
        if (r.status === 401) { setGate("watch"); return; }   /* logged out mid-show */
        const d = await r.json();
        if (stop) return;
        liveSidRef.current = d.sid || "";
        setLiveOn(!!d.on); setEnded(!!d.ended || (!d.on && !!lastFrame.current));
        setTaps((old) => {
          const now = d.taps || {};
          const k = String(viewer ? lastFrame.current?.step : stepRef.current);
          if (!viewer && (now[k] || 0) > (old[k] || 0)) wobble();
          return now;
        });
        if (viewer && d.on && d.frame) { if (!lastFrame.current || lastFrame.current.step !== d.frame.step) setMyTaps(0); apply(d.frame); }
      } catch { /* try again next time */ }
      if (!stop) t = setTimeout(poll, viewer && !liveOn ? POLL_MS * 2 : POLL_MS);
    };
    poll();
    return () => { stop = true; clearTimeout(t); };
  }, [viewer, hostSid, liveOn]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Host: send every step / phase / hit while broadcasting. A step's first frame never carries a reveal, so a
     stale "shown" from the step before can't leak the next winner. */
  const sent = useRef<{ step: number; phase: string; hits: number } | null>(null);
  useEffect(() => {
    if (viewer || !hostSid || !cur) return;
    const ph = sent.current && sent.current.step === step ? phase : cur.kind === "win" ? "idle" : phase;
    if (sent.current && sent.current.step === step && sent.current.phase === ph && sent.current.hits === hits) return;
    sent.current = { step, phase: ph, hits };
    try { sessionStorage.setItem(HOST_KEY, JSON.stringify({ sid: hostSid, step })); } catch { /* no storage */ }
    fetch("/api/awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "live", sid: hostSid, step, phase: ph, hits }) }).catch(() => {});
  }, [viewer, hostSid, step, phase, hits]); // eslint-disable-line react-hooks/exhaustive-deps

  async function goLive(on: boolean) {
    if (on && live?.on && live.sid !== hostSid && !confirm("Viewers are following another screen right now. Take over from this one?")) return;
    const ph = cur && cur.kind === "win" ? "idle" : phase;
    const r = await fetch("/api/awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(on ? { action: "live", on: true, delay, step, phase: ph, hits } : { action: "live", on: false }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || "Could not change the live show"); return; }
    setLive(d); sent.current = on ? { step, phase: ph, hits } : null;
    setHostSid(on ? d.sid : "");
    try { if (on) sessionStorage.setItem(HOST_KEY, JSON.stringify({ sid: d.sid, step })); else sessionStorage.removeItem(HOST_KEY); } catch { /* no storage */ }
  }
  function saveDelay(v: number) {
    const n = Math.max(0, Math.min(60, Math.round(v) || 0)); setDelay(n);
    if (hostSid) fetch("/api/awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "live", sid: hostSid, delay: n }) }).catch(() => {});
  }

  const revealStyle = styleOf(show);
  const next = useCallback(() => {
    if (viewer) return;
    if (cur && cur.kind === "win" && phase === "pumpkin") { if (revealStyle === "evidence") cut(); else smash(); return; }
    if (cur && cur.kind === "win" && (phase === "suspense" || phase === "burst")) return;   /* let the reveal finish */
    setStep((x) => Math.min(steps.length - 1, x + 1));
  }, [cur, phase, steps.length, smash, cut, revealStyle, viewer]);
  const back = useCallback(() => { if (!viewer) setStep((x) => Math.max(0, x - 1)); }, [viewer]);
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

  if (gate === "login") return <Gate h="Log in to open the reveal" p="Before the winners are published, only admins can open this page."><a className={styles.btn} href={loginUrl(location.pathname + location.search)}>Log in with Twitch</a></Gate>;
  if (gate === "watch") return <Gate h="Log in to watch the AK9 Awards" p="Log in with Twitch to follow the show live with Aleks's stream and shake the pumpkins before each winner is revealed."><a className={styles.btn} href={loginUrl(location.pathname + location.search)}>Log in with Twitch</a></Gate>;
  if (gate === "admin") return <Gate h="Admins only" p="The winners aren't published yet, so only admins can open the reveal." />;
  if (gate === "error") return <Gate h="Nothing to reveal yet" p="There is no season with results yet." />;
  if (viewer && !cur) return (
    <Gate h={ended ? "The AK9 Awards show has ended" : "The AK9 Awards haven't started yet"}
      p={ended ? "Thanks for watching! The winners are on the AK9 Awards page once Aleks publishes them." : "Keep this page open with the stream: when Aleks starts the show it plays here too, and you can tap the pumpkins to shake them before each winner is revealed."}>
      {ended ? <a className={styles.btn} href="/awards">AK9 Awards</a> : <div className={styles.spin} aria-label="Waiting" />}
    </Gate>
  );
  if (!show || !cur) return <div className={styles.spin} aria-label="Loading" />;
  const w = WORDS[show.theme];
  const crowd = (taps[String(step)] || 0) + (viewer ? pendingTaps.current : 0);
  const crowdLine = (viewer || hostSid) && crowd > 0 ? <div className={styles.sCrowd}>🎃 {crowd.toLocaleString()} tap{crowd === 1 ? "" : "s"} from viewers{viewer && myTaps ? ` · ${myTaps} yours` : ""}</div> : null;

  return (
    <div className={`${styles.stage} ${themeClass(show.theme)} ${cur.kind === "win" && phase !== "shown" ? styles.stageDim : ""} ${cur.kind === "win" && phase === "shown" ? styles.stageLit : ""}`} ref={stageRef} onClick={(e) => { if ((e.target as HTMLElement).closest("button,a,input,label")) return; next(); }}>
      <div className={styles.sweep} aria-hidden="true" />
      {flash > 0 && <div key={"f" + flash} className={styles.flashOverlay} aria-hidden="true" />}
      <canvas ref={confettiRef} className={styles.confetti} />
      <div className={`${styles.stageInner} ${shaking ? styles.shakeIt : ""}`}>
        {cur.kind === "intro" && (
          <div key={"st" + step} className={styles.sIntro}>
            <div className={`${styles.kicker} ${styles.fadeUp}`}>{w.kicker}…</div>
            <Letters text="AK9 Awards" delay={0.4} step={0.09} className={styles.sTitle} />
            <div className={`${styles.sSub} ${styles.fadeUp}`} style={{ animationDelay: "1.5s" }}>{show.label} · The winners</div>
            <div className={`${styles.sHint} ${styles.fadeUp}`} style={{ animationDelay: "2.2s" }}><CountUp to={show.totalVoters} delay={2200} ms={1200} /> people voted{viewer ? "" : " · press space to begin"}</div>
          </div>
        )}
        {(cur.kind === "award" || cur.kind === "win") && (() => {
          const a = show.awards[cur.i];
          const winners = a.nominees.filter((n) => (a.winnerIds || []).includes(n.id));
          const shown = cur.kind === "win" && phase === "shown";
          const total = a.total || 0;
          const pct = (v = 0) => (total ? ` · ${Math.round((v / total) * 100)}%` : "");
          const word = w.winner.toLowerCase() === "guilty" ? "verdict" : "winner";
          if (cur.kind === "win" && revealStyle === "evidence" && (winners.length || (viewer && phase !== "shown"))) {   /* viewers only learn the winner at the reveal */
            const bagStage: BagStage = phase === "shown" ? "revealed" : phase === "burst" ? (bagOpen ? "open" : "cutting") : "sealed";
            return (
              <div key={"st" + step} className={styles.sAward}>
                <div className={styles.anum}>{w.award} {pad2(cur.i + 1)} of {pad2(show.awards.length)} · {a.title}</div>
                <span ref={wobbleRef} className={styles.pkWob}><EvidenceBag a={a} i={cur.i} label={show.label} verdict={w.winner} stage={bagStage} onCut={viewer ? tap : cut} /></span>
                {phase === "pumpkin" && <div className={`${styles.sHint} ${styles.pulse}`}>{viewer ? "tap the evidence bag to shake it · Aleks cuts it open soon" : "tap the evidence bag to cut it open"}</div>}
                {phase === "pumpkin" && crowdLine}
                <div className={`${styles.sNoms} ${styles.sNomsSmall} ${phase !== "shown" ? styles.nervous : ""}`}>
                  {(phase === "shown" ? byVotes(a.nominees) : a.nominees).filter((n) => phase !== "shown" || !winners.includes(n)).map((n, ni) => (
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
          if (cur.kind === "win" && revealStyle === "pumpkin" && (winners.length || (viewer && phase !== "shown"))) {   /* viewers only learn the winner at the reveal */
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
                  <button type="button" className={styles.pkBtn} onClick={viewer ? tap : smash} aria-label={viewer ? "Shake the pumpkin" : "Smash the pumpkin"}>
                    <span ref={wobbleRef} className={styles.pkWob}><Pumpkin hits={hits} burst={phase === "burst"} /></span>
                  </button>
                )}
                {phase === "pumpkin" && <div key={"h" + hits} className={`${styles.sHint} ${styles.pulse}`}>{viewer ? (hits ? `${["", "it's cracking…", "one more hit!"][hits]} · keep tapping to shake it` : "tap the pumpkin to shake it · Aleks smashes it open soon") : <>{["smash the pumpkin to reveal the " + word, "harder…", "one more!"][hits]} · {3 - hits} hit{3 - hits === 1 ? "" : "s"} left</>}</div>}
                {phase === "pumpkin" && crowdLine}
                <div className={`${styles.sNoms} ${styles.sNomsSmall} ${phase !== "shown" ? styles.nervous : ""}`}>
                  {(phase === "shown" ? byVotes(a.nominees) : a.nominees).filter((n) => phase !== "shown" || !winners.includes(n)).map((n, ni) => (
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
              {intro && !viewer && <div className={`${styles.sHint} ${styles.fadeUp}`} style={{ animationDelay: `${dT + a.nominees.length * 0.45 + 0.3}s` }}>press space to reveal the {word}</div>}
              {cur.kind === "win" && phase === "suspense" && <div className={styles.sHint}>and the {w.winner.toLowerCase() === "guilty" ? "verdict" : "winner"} is…</div>}
              {cur.kind === "win" && phase === "suspense" && crowdLine}
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
      {viewer ? (
        <div className={styles.sBar}>
          {liveOn ? <span className={styles.liveTag}><i />Live with Aleks's stream</span> : <span>The show has ended</span>}
          <button onClick={() => setSound(!sound)}>{sound ? "Sound on" : "Sound off"}</button>
          <button onClick={full}>Fullscreen (F)</button>
        </div>
      ) : (
        <div className={styles.sBar}>
          <button onClick={back} disabled={step === 0}>← Back</button>
          <span>{step + 1} / {steps.length}</span>
          <button onClick={next} disabled={step === steps.length - 1}>Next →</button>
          <button onClick={() => setSound(!sound)}>{sound ? "Sound on" : "Sound off"}</button>
          <button onClick={full}>Fullscreen (F)</button>
          {hostSid
            ? <button className={styles.liveOn} onClick={() => goLive(false)} title="Viewers on aleksk9.com/awards/reveal are following this screen"><i />Live · End</button>
            : <button onClick={() => goLive(true)} title="Everyone on aleksk9.com/awards/reveal follows this screen">{live?.on ? "Live on another screen · Take over" : "Go live for viewers"}</button>}
          <label className={styles.sDelay} title="Match your stream delay so the site doesn't reveal winners before the stream does">Stream delay <input type="number" min={0} max={60} value={delay} onChange={(e) => saveDelay(Number(e.target.value))} />s</label>
        </div>
      )}
    </div>
  );
}
