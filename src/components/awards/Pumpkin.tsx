"use client";

import styles from "./awards.module.scss";

/* The jack-o'-lantern on the reveal page. `hits` (0-3) adds cracks; `burst` breaks it into flying pieces. */
const CX = 120, CY = 128;
const WEDGES = 9;

function Body() {
  return (
    <>
      <defs>
        <radialGradient id="pkBody" cx="45%" cy="35%" r="75%">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset=".55" stopColor="#f47a12" />
          <stop offset="1" stopColor="#b8460a" />
        </radialGradient>
        <radialGradient id="pkGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset=".6" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#ff9a1a" />
        </radialGradient>
        <filter id="pkBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <path d="M116 46 C112 30 118 18 132 12 L138 20 C128 26 126 34 128 48 Z" fill="#5b7d1f" stroke="#2f4510" strokeWidth="3" strokeLinejoin="round" />
      <path d="M128 40 C140 30 156 32 164 40" fill="none" stroke="#5b7d1f" strokeWidth="5" strokeLinecap="round" />
      {[[62, 58, 78], [178, 58, 78], [92, 52, 88], [148, 52, 88], [120, 44, 92]].map(([cx, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={CY} rx={rx} ry={ry} fill="url(#pkBody)" stroke="#8a3306" strokeWidth="3" />
      ))}
      <g filter="url(#pkBlur)" opacity=".85">
        <polygon points="70,104 100,104 85,80" fill="#ffd34d" />
        <polygon points="140,104 170,104 155,80" fill="#ffd34d" />
        <path d="M66 140 L84 152 L96 140 L108 154 L120 140 L132 154 L144 140 L156 152 L174 140 C168 172 72 172 66 140 Z" fill="#ffd34d" />
      </g>
      <polygon points="70,104 100,104 85,80" fill="url(#pkGlow)" stroke="#3a1503" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="140,104 170,104 155,80" fill="url(#pkGlow)" stroke="#3a1503" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="112,126 128,126 120,114" fill="url(#pkGlow)" stroke="#3a1503" strokeWidth="3" strokeLinejoin="round" />
      <path d="M66 140 L84 152 L96 140 L108 154 L120 140 L132 154 L144 140 L156 152 L174 140 C168 172 72 172 66 140 Z" fill="url(#pkGlow)" stroke="#3a1503" strokeWidth="3" strokeLinejoin="round" />
    </>
  );
}

const CRACKS = [
  "M120 50 L112 72 L124 86 L114 104",
  "M60 120 L78 128 L72 146 L90 160 M190 110 L172 124 L180 140",
  "M150 190 L140 172 L152 158 L138 140 M96 196 L104 178 L92 166",
];

export function Pumpkin({ hits, burst }: { hits: number; burst: boolean }) {
  if (burst) {
    return (
      <div className={styles.pumpkin}>
        {Array.from({ length: WEDGES }, (_, i) => {
          const a0 = (i / WEDGES) * Math.PI * 2, a1 = ((i + 1) / WEDGES) * Math.PI * 2, mid = (a0 + a1) / 2, R = 200;
          const pts = `${CX},${CY} ${CX + Math.cos(a0) * R},${CY + Math.sin(a0) * R} ${CX + Math.cos(mid) * R * 1.1},${CY + Math.sin(mid) * R * 1.1} ${CX + Math.cos(a1) * R},${CY + Math.sin(a1) * R}`;
          const dist = 260 + (i % 3) * 70;
          const style = { "--dx": `${Math.cos(mid) * dist}px`, "--dy": `${Math.sin(mid) * dist + 120}px`, "--r": `${(i % 2 ? 1 : -1) * (90 + i * 25)}deg` } as React.CSSProperties;
          return (
            <svg key={i} viewBox="0 0 240 220" className={styles.pkPiece} style={style} aria-hidden="true">
              <clipPath id={`pkw${i}`}><polygon points={pts} /></clipPath>
              <g clipPath={`url(#pkw${i})`}><Body /></g>
            </svg>
          );
        })}
      </div>
    );
  }
  return (
    <div className={styles.pumpkin}>
      <svg key={hits} viewBox="0 0 240 220" className={`${styles.pkWhole} ${hits ? styles.pkHit : ""}`} role="img" aria-label="Pumpkin">
        <Body />
        {CRACKS.slice(0, hits).map((d) => <path key={d} d={d} fill="none" stroke="#2a0f02" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
    </div>
  );
}
