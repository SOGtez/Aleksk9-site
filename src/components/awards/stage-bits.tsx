"use client";

import { useEffect, useState } from "react";
import styles from "./awards.module.scss";

/* Pieces shared by the stages shown on stream (RevealStage, FinalistsStage): the little synth, text that types
   itself in, numbers that count up, confetti and the "log in / admins only" gates. */

let ac: AudioContext | null = null;
const audio = () => (ac = ac || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());

export function tone(f: number, d = 0.08, type: OscillatorType = "triangle", v = 0.05) {
  try {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + d);
  } catch { /* no audio */ }
}

/* A short burst of noise: the pumpkin breaking. */
export function splat() {
  try {
    const c = audio(), len = c.sampleRate * 0.35, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = "lowpass"; f.frequency.value = 1400; g.gain.value = 0.5;
    src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
  } catch { /* no audio */ }
}

/* Scissor snips and the rustle of the evidence bag opening. */
export function snip() {
  try {
    audio();
    for (let i = 0; i < 6; i++) setTimeout(() => { tone(2400 + Math.random() * 600, 0.03, "square", 0.04); tone(900, 0.05, "triangle", 0.03); }, i * 150);
  } catch { /* no audio */ }
}
export function rustle() {
  try {
    const c = audio(), len = c.sampleRate * 0.9, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(i / 90)); }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = "highpass"; f.frequency.value = 1800; g.gain.value = 0.18;
    src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
  } catch { /* no audio */ }
}

/* Text that appears one letter at a time. */
export function Letters({ text, delay = 0, step = 0.035, className }: { text: string; delay?: number; step?: number; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden="true" className={styles.letter} style={{ animationDelay: `${delay + i * step}s` }}>{ch === " " ? " " : ch}</span>
      ))}
    </span>
  );
}
/* A number that counts up from 0. */
export function CountUp({ to, ms = 1400, delay = 0 }: { to: number; ms?: number; delay?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    /* a timer, not animation frames, so it still ends on the right number if the tab is in the background */
    let iv: ReturnType<typeof setInterval> | undefined;
    setV(0);
    const start = setTimeout(() => {
      const t0 = Date.now();
      iv = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k >= 1 && iv) clearInterval(iv); }, 30);
    }, delay);
    return () => { clearTimeout(start); if (iv) clearInterval(iv); };
  }, [to, ms, delay]);
  return <>{v}</>;
}
export const titleTime = (t: string) => 0.25 + Array.from(t).length * 0.035;   /* seconds until a Letters title is done */

export const PUMPKIN_COLORS = ["#ff8a1f", "#f47a12", "#b8460a", "#ffd34d", "#f4e3b5", "#5b7d1f"];

/* Confetti on the stage's canvas. `from` is where it starts, as fractions of the canvas (default: a bit above the middle). */
export function confetti(c: HTMLCanvasElement | null, colors?: string[], from?: { x: number; y: number }) {
  if (!c) return;
  const ctx = c.getContext("2d"); if (!ctx) return;
  const W = (c.width = c.clientWidth), H = (c.height = c.clientHeight);
  const x0 = W * (from ? from.x : 0.5), y0 = H * (from ? from.y : 0.45);
  const cols = colors || ["#ffd166", "#ff3b30", "#fd6325", "#a78bfa", "#ffffff", "#4cc3ff"];
  const ps = Array.from({ length: 160 }, () => ({ x: x0, y: y0, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, r: 3 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6 }));
  let t = 0;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.vx *= 0.99; p.a += 0.2; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
    if (++t < 150) requestAnimationFrame(draw); else ctx.clearRect(0, 0, W, H);
  };
  draw();
}

export function Gate({ h, p, children }: { h: string; p: string; children?: React.ReactNode }) {
  return (
    <div className={`${styles.panel} ${styles.center}`}>
      <div className={styles.msgH}>{h}</div>
      <p className={styles.msgP}>{p}</p>
      {children}
      <p className={styles.msgP}><a href="/awards">Back to the awards</a></p>
    </div>
  );
}
