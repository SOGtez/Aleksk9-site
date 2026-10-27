"use client";

import ev from "./evidence.module.scss";
import { Award, Nominee, pad2 } from "./shared";

/* The forensics reveal (crime theme, as on the old tezcreations.com/ak9awards page): a sealed tamper-evident
   evidence bag. Tap it, scissors run along the dotted line, the two halves drift apart and the case file slides
   out: the winner's mugshot, the offence, the suspect, the vote and a GUILTY stamp that settles on last.
   `stage`: sealed → cutting → open → revealed. */
export type BagStage = "sealed" | "cutting" | "open" | "revealed";

const rep = (s: string, n: number) => Array.from({ length: n }, () => s).join("");

function Strip() {
  return (
    <div className={ev.strip}>
      <div className={ev.brand}>{rep("AK9 FORENSICS UNIT · ", 9)}</div>
      <div className={ev.targets}>{Array.from({ length: 15 }, (_, i) => <span key={i}>◎</span>)}</div>
      <div className={ev.brand}>{rep("TAMPER EVIDENT · DO NOT OPEN · ", 6)}</div>
    </div>
  );
}

function Mug({ n }: { n?: Nominee }) {
  if (!n) return <>?</>;
  // eslint-disable-next-line @next/next/no-img-element
  return n.image ? <img src={n.image} alt="" /> : <>{(n.name || "?").slice(0, 1).toUpperCase()}</>;
}

/* The case file inside the bag. */
function CaseFile({ a, i, label, verdict }: { a: Award; i: number; label: string; verdict: string }) {
  const total = a.total || 0;
  const winners = a.nominees.filter((n) => (a.winnerIds || []).includes(n.id));
  const win = winners[0];
  const solved = !!win && total > 0;
  const pct = solved ? Math.round(((win.votes || 0) / total) * 100) : 0;
  const suspect = solved ? winners.map((n) => "@" + n.name).join(" & ") : "— unsolved —";
  return (
    <div className={ev.bag}>
      <Strip />
      <div className={`${ev.sidewarn} ${ev.l}`}>DO NOT CUT HERE TO OPEN · DO NOT CUT HERE TO OPEN</div>
      <div className={`${ev.sidewarn} ${ev.r}`}>DO NOT CUT HERE TO OPEN · DO NOT CUT HERE TO OPEN</div>
      <div className={ev.body}>
        <div className={ev.barrow}><span className={ev.caseno}>AK9-{pad2(i + 1)}</span><span className={ev.barcode} /></div>
        <div className={ev.title}>EVIDENCE</div>
        <div className={ev.photo}>
          <span className={ev.ptape} />
          <span className={ev.frame}>
            <span className={ev.mugimg}><Mug n={win} /></span>
            <span className={ev.cap}>EXHIBIT A · {suspect}</span>
          </span>
        </div>
        {solved && <div className={ev.guilty}>{verdict}</div>}
        <div className={ev.f}><label>Agency</label><span className={ev.val}>AK9 Forensics Unit</span></div>
        <div className={ev.f}><label>Offense</label><span className={ev.val}>{a.title}</span></div>
        <div className={ev.f}><label>Suspect</label><span className={`${ev.val} ${ev.susp}`}>{suspect}</span></div>
        <div className={ev.f}><label>Recovered by</label><span className={ev.val}>
          {solved ? `community verdict — ${win.votes || 0} vote${win.votes === 1 ? "" : "s"} (${pct}%)${winners.length > 1 ? " · tie" : ""}` : "no votes were cast"}
        </span></div>
        {a.description && <div className={ev.f}><label>Case notes</label><span className={`${ev.val} ${ev.notes}`}>{a.description}</span></div>}
        <div className={ev.f}><label>Sealed by</label><span className={ev.val}>AleksK9 · Forensics Unit · {label}</span></div>
        <div className={ev.coc}>
          <h5>Chain of Custody</h5>
          <table>
            <tbody>
              <tr><th>Date</th><th>From</th><th>To</th></tr>
              <tr><td>{label}</td><td>Community tips</td><td>Finalists</td></tr>
              <tr><td>{label}</td><td>The jury</td><td>Verdict: {solved ? verdict : "Unsolved"}</td></tr>
            </tbody>
          </table>
        </div>
        <div className={ev.cut}>✂ TO REMOVE CONTENTS CUT ALONG BOTTOM DOTTED LINE</div>
      </div>
    </div>
  );
}

/* One face of the sealed bag. Rendered twice, clipped to the top 80% and the bottom 20%, so it splits cleanly. */
function SealFace({ a, i, which }: { a: Award; i: number; which: "top" | "bottom" }) {
  return (
    <div className={`${ev.sealface} ${which === "top" ? ev.sfTop : ev.sfBottom}`}>
      <Strip />
      <div className={ev.body}>
        <div className={ev.barrow}><span className={ev.caseno}>AK9-{pad2(i + 1)}</span><span className={ev.barcode} /></div>
        <div className={ev.title}>EVIDENCE</div>
        <div className={ev.redact}><span className={ev.rb} /><span className={ev.rl}>{a.title}</span><span className={ev.rl2}>Suspect redacted · sealed pending verdict</span></div>
        <div className={ev.taphint}>✂ Tap to cut open</div>
      </div>
      <div className={ev.cutLine}>✂ CUT ALONG DOTTED LINE TO OPEN</div>
      <div className={ev.sealBtm}>Chain of custody sealed · do not open</div>
      <span className={`${ev.sidew} ${ev.l}`}>DO NOT CUT HERE TO OPEN</span>
      <span className={`${ev.sidew} ${ev.r}`}>DO NOT CUT HERE TO OPEN</span>
    </div>
  );
}

export function EvidenceBag({ a, i, label, verdict, stage, onCut }: { a: Award; i: number; label: string; verdict: string; stage: BagStage; onCut: () => void }) {
  const cutting = stage !== "sealed", open = stage === "open" || stage === "revealed";
  return (
    <div className={`${ev.rc} ${cutting ? ev.cutting : ""} ${open ? ev.open : ""}`}>
      <div className={ev.paperWrap}>
        <div className={`${ev.paper} ${stage === "revealed" ? ev.revealed : ""}`}>
          <CaseFile a={a} i={i} label={label} verdict={verdict} />
        </div>
      </div>
      <button type="button" className={ev.seal} onClick={(e) => { e.stopPropagation(); onCut(); }} aria-label="Cut the evidence bag open" disabled={stage !== "sealed"}>
        <SealFace a={a} i={i} which="top" />
        <SealFace a={a} i={i} which="bottom" />
        <span className={ev.cutline} />
        <span className={ev.scissors}>✂</span>
      </button>
    </div>
  );
}
