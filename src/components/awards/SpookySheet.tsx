import { Creepster, IM_Fell_English } from "next/font/google";
import styles from "./awards.module.scss";

/* The Halloween winner certificate on /awards/print: cream paper (easy on printer ink), cobwebs,
   bats, a spider, a pumpkin-framed photo, a wax seal and a little graveyard along the bottom. */
const creepster = Creepster({ weight: "400", subsets: ["latin"], variable: "--hw-creep" });
const fell = IM_Fell_English({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--hw-fell" });

export type SheetData = { award: string; desc: string; name: string; image: string; line: string; kind: string };

/* Spokes from the corner, with sagging threads between them. */
function Web({ className }: { className: string }) {
  const R = [18, 34, 50, 66, 82, 96], A = [0, 15, 30, 45, 60, 75, 90].map((d) => (d * Math.PI) / 180);
  const pt = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)];
  let d = A.map((a) => `M0 0 L${pt(100, a).join(" ")}`).join(" ");
  for (const r of R) for (let i = 0; i < A.length - 1; i++) {
    const [x1, y1] = pt(r, A[i]), [x2, y2] = pt(r, A[i + 1]), [mx, my] = pt(r * 0.86, (A[i] + A[i + 1]) / 2);
    d += ` M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  }
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><path d={d} fill="none" stroke="#1a1410" strokeWidth=".7" strokeLinecap="round" /></svg>;
}

function Spider() {
  return (
    <svg className={styles.hwSpider} viewBox="0 0 40 120" aria-hidden="true">
      <line x1="20" y1="0" x2="20" y2="86" stroke="#1a1410" strokeWidth=".8" />
      <g stroke="#1a1410" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M17 92 L8 86 L3 90 M17 95 L6 94 L1 100 M17 98 L7 102 L4 110 M18 100 L11 108 L10 116" />
        <path d="M23 92 L32 86 L37 90 M23 95 L34 94 L39 100 M23 98 L33 102 L36 110 M22 100 L29 108 L30 116" />
      </g>
      <ellipse cx="20" cy="99" rx="6" ry="8" fill="#1a1410" />
      <circle cx="20" cy="89" r="4.2" fill="#1a1410" />
      <circle cx="18.4" cy="88.4" r=".9" fill="#f47a12" /><circle cx="21.6" cy="88.4" r=".9" fill="#f47a12" />
    </svg>
  );
}

const BAT = "M0 10 Q6 1 12 6 Q14 2 16 4 L17.4 0 L18.6 0 L20 4 Q22 2 24 6 Q30 1 36 10 Q31 8.5 28 12 Q25 9.5 22 13 Q20 11 18 14 Q16 11 14 13 Q11 9.5 8 12 Q5 8.5 0 10Z";
function Bats() {
  return (
    <svg className={styles.hwBats} viewBox="0 0 160 60" aria-hidden="true">
      <path d={BAT} fill="#1a1410" transform="translate(10 30) scale(1.3) rotate(-8)" />
      <path d={BAT} fill="#1a1410" transform="translate(80 6) scale(1.6) rotate(6)" />
      <path d={BAT} fill="#1a1410" transform="translate(126 38) scale(.9) rotate(-14)" />
    </svg>
  );
}

function Jack({ x, s }: { x: number; s: number }) {
  return (
    <g transform={`translate(${x} ${68 - 30 * s}) scale(${s})`}>
      <path d="M19 4 Q20 -1 24 -2" stroke="#3d5a12" strokeWidth="3" fill="none" strokeLinecap="round" />
      {[[11, 10], [29, 10], [16, 13], [24, 13], [20, 14]].map(([cx, rx], i) => <ellipse key={i} cx={cx} cy="17" rx={rx} ry="13" fill="#f47a12" stroke="#1a1410" strokeWidth="1.2" />)}
      <path d="M10 13 L16 13 L13 8Z M24 13 L30 13 L27 8Z M9 19 L13 23 L16 20 L20 24 L24 20 L27 23 L31 19 Q28 28 20 28 Q12 28 9 19Z" fill="#1a1410" />
    </g>
  );
}

function Grave({ x, h, rip }: { x: number; h: number; rip?: boolean }) {
  return (
    <g transform={`translate(${x} ${70 - h})`}>
      <path d={`M0 ${h} L0 10 Q0 0 11 0 Q22 0 22 10 L22 ${h}Z`} fill="#3a332c" />
      {rip && <text x="11" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fbf3e2" fontFamily="serif">RIP</text>}
    </g>
  );
}

function Graveyard() {
  return (
    <svg className={styles.hwGround} viewBox="0 0 1000 80" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <Grave x={60} h={40} rip /><Grave x={150} h={30} />
      <path d="M232 70 L232 30 M222 40 L242 40" stroke="#3a332c" strokeWidth="5" />
      <Grave x={820} h={44} rip /><Grave x={900} h={30} />
      <path d="M760 70 L760 34 M751 43 L769 43" stroke="#3a332c" strokeWidth="5" />
      <Jack x={100} s={1.1} /><Jack x={270} s={.8} /><Jack x={690} s={.9} /><Jack x={862} s={1.2} />
      <path d="M0 80 L0 70 Q40 62 80 68 Q140 74 200 66 Q260 60 330 68 Q420 76 500 69 Q580 62 660 68 Q740 75 820 67 Q900 61 1000 69 L1000 80Z" fill="#1a1410" />
    </svg>
  );
}

function Seal() {
  const n = 28, pts = Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? 46 : 50, a = (i / (n * 2)) * Math.PI * 2; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(" ");
  return (
    <svg className={styles.hwSeal} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={pts} fill="#f47a12" stroke="#1a1410" strokeWidth="1" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#1a1410" strokeWidth="1" />
      <circle cx="50" cy="50" r="27" fill="#1a1410" />
      <path id="hwSealArc" d="M50 18 A32 32 0 1 1 49.9 18" fill="none" />
      <text fontSize="6.6" fontWeight="800" fill="#1a1410"><textPath href="#hwSealArc" textLength="196" lengthAdjust="spacing">★ OFFICIAL WINNER ★ AK9 AWARDS</textPath></text>
      <text x="50" y="57" textAnchor="middle" fontSize="20" fill="#f47a12" style={{ fontFamily: "var(--hw-creep)" }}>AK9</text>
    </svg>
  );
}

/* Long Twitch names get a smaller size so they stay on one line. */
const nameSize = (s: string) => (s.length <= 10 ? 5.6 : s.length <= 15 ? 4.6 : s.length <= 20 ? 3.7 : 3);

export function SpookySheet({ s, label, date }: { s: SheetData; label: string; date: string }) {
  return (
    <section className={`${styles.sheet} ${styles.hwSheet} ${creepster.variable} ${fell.variable}`}>
      <div className={styles.hwFrame}>
        <Web className={`${styles.hwWeb} ${styles.hwWebL}`} />
        <Web className={`${styles.hwWeb} ${styles.hwWebR}`} />
        <Spider />
        <Bats />
        <div className={styles.hwBody}>
          <div className={styles.hwKicker}>AleksK9 summons</div>
          <div className={styles.hwTitle}>AK9 Awards</div>
          <div className={styles.hwSeason}>{label} · {s.kind === "Winner" ? "Certificate of Spooktacular Achievement" : s.kind}</div>
          <div className={styles.hwPumpkin}>
            <svg className={styles.hwStem} viewBox="0 0 60 40" aria-hidden="true">
              <path d="M26 40 C24 26 27 14 36 6 L42 12 C35 18 33 28 34 40Z" fill="#4a6b17" stroke="#1a1410" strokeWidth="2" strokeLinejoin="round" />
              <path d="M38 22 C46 12 56 16 58 22 C50 26 44 26 38 22Z" fill="#6a8f24" stroke="#1a1410" strokeWidth="1.6" />
            </svg>
            {s.image
              ? <img className={styles.hwFace} src={s.image} alt="" />  // eslint-disable-line @next/next/no-img-element
              : <span className={styles.hwFace}>{s.name.replace("@", "").slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className={styles.hwName} style={{ fontSize: `${nameSize(s.name)}cqw` }}>{s.name}</div>
          <div className={styles.hwFor}>has been crowned the winner of</div>
          <div className={styles.hwAward}>{s.award}</div>
          {s.desc && <div className={styles.hwDesc}>{s.desc}</div>}
          <div className={styles.hwLine}>{s.line}</div>
          <div className={styles.hwFoot}>
            <div className={styles.hwSign}><span>AleksK9</span><small>Keeper of the crypt</small></div>
            <Seal />
            <div className={styles.hwSign}><span className={styles.hwDate}>{date}</span><small>Awarded on</small></div>
          </div>
        </div>
        <Graveyard />
      </div>
    </section>
  );
}
