"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@once-ui-system/core";
import styles from "./awards.module.scss";
import {
  Award, Countdown, Face, HallItem, Results, ResultCard, Season, Stage, WORDS, WildcardList,
  fmtWhen, loginUrl, pad2, themeClass,
} from "./shared";
import { AwardsSoon } from "./AwardsSoon";

/* /awards: the current season in whatever stage it is in, then the Hall of Fame.
   Data from /api/awards. On the test site (no database) the API serves a sample season and this page shows
   a bar to preview each stage. */
type Me = { loggedIn: boolean; login?: string; name?: string; avatar?: string; follows?: boolean; isAdmin?: boolean; nominated?: Record<string, string> | null; voted?: Record<string, string> | null };
type Data = { season: Season | null; me: Me; results: Results | null; hall: HallItem[]; demo?: boolean };
const DEMO_STAGES: Stage[] = ["soon", "nominate-soon", "nominate", "nominate-closed", "vote", "closed", "revealed"];

export function AwardsApp() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [demo, setDemo] = useState<string>("");

  const load = useCallback(async (d = demo) => {
    try {
      const r = await fetch("/api/awards" + (d ? "?demo=" + d : ""), { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData(await r.json()); setErr("");
    } catch { setErr("The awards could not load right now. Try again in a minute."); }
  }, [demo]);
  useEffect(() => { const d = new URLSearchParams(location.search).get("demo") || ""; setDemo(d); load(d); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className={styles.panel}><p className={styles.msgP}>{err}</p></div>;
  if (!data) return <div className={styles.spin} aria-label="Loading" />;
  const s = data.season;
  const theme = s?.theme || "classic";

  return (
    <div className={`${styles.wrap} ${themeClass(theme)}`}>
      {data.demo && (
        <div className={styles.demoBar}>
          <b>Test site preview</b> · sample season, nothing is saved. Stage:
          {DEMO_STAGES.map((st) => (
            <button key={st} className={(s?.stage || "soon") === st ? styles.on : ""} onClick={() => { setDemo(st); history.replaceState(null, "", "?demo=" + st); load(st); }}>{st}</button>
          ))}
          <a href="/awards/reveal">Reveal page →</a>
        </div>
      )}
      {theme === "crime" && <div className={styles.tape}><span>CRIME SCENE · DO NOT CROSS · AK9 EVIDENCE · CRIME SCENE · DO NOT CROSS · AK9 EVIDENCE</span></div>}

      {!s || s.stage === "soon" ? <AwardsSoon /> : <Current s={s} me={data.me} results={data.results} demo={!!data.demo} reload={() => load()} />}

      <Hall items={data.hall} />
    </div>
  );
}

function Hero({ s }: { s: Season }) {
  const w = WORDS[s.theme];
  const sub: Record<Stage, string> = {
    soon: "Opens soon", "nominate-soon": "Nominations open soon", nominate: "Nominations are open", "nominate-closed": "Nominations closed",
    vote: "Voting is open", closed: "Voting closed", revealed: "The winners",
  };
  return (
    <div className={styles.hero}>
      <div className={styles.kicker}>{w.kicker}…</div>
      <h1 className={styles.title}>AK9 Awards</h1>
      <div className={styles.season}>{s.label} · {sub[s.stage]}</div>
      {s.stage === "nominate-soon" && <Countdown to={s.nominateOpen} label="until nominations open" />}
      {s.stage === "nominate" && s.nominateDeadline && <Countdown to={s.nominateDeadline} label="until nominations close" />}
      {s.stage === "vote" && s.voteDeadline && <Countdown to={s.voteDeadline} label="until voting closes" />}
    </div>
  );
}

function Current({ s, me, results, demo, reload }: { s: Season; me: Me; results: Results | null; demo: boolean; reload: () => void }) {
  return (
    <>
      <Hero s={s} />
      {s.stage === "nominate-soon" && <Msg h="Nominations open soon" p={`The nominations open ${fmtWhen(s.nominateOpen)}. Come back then to name your picks.`} />}
      {s.stage === "nominate" && <Nominate s={s} me={me} demo={demo} reload={reload} />}
      {s.stage === "nominate-closed" && <Msg h="Nominations are closed" p="Thanks to everyone who nominated. The finalists are being picked, and voting opens soon." />}
      {s.stage === "vote" && <Vote s={s} me={me} demo={demo} reload={reload} />}
      {s.stage === "closed" && (
        <Msg h="Voting is closed" p="Thanks for voting! Aleks reveals the winners live on stream, then they show up here.">
          {me.voted && <Picks s={s} picks={me.voted} title="Your ballot" />}
        </Msg>
      )}
      {s.stage === "revealed" && results && <Winners s={s} results={results} />}
    </>
  );
}

function Msg({ h, p, children }: { h: string; p: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={`${styles.panel} ${styles.center}`}>
      <div className={styles.msgH}>{h}</div>
      <p className={styles.msgP}>{p}</p>
      {children}
    </div>
  );
}

/* Not logged in / not following: explain, show the awards read-only. */
function Gate({ me, what }: { me: Me; what: "nominate" | "vote" }) {
  if (!me.loggedIn) {
    return (
      <Msg h={`Log in to ${what}`} p={`Log in with Twitch and follow AIeksK9 to ${what}. One ${what === "vote" ? "ballot" : "set of nominations"} per account, and your picks stay private.`}>
        <div className={styles.btnRow}><Button href={loginUrl()} variant="primary" size="m" prefixIcon="twitch" data-border="rounded">Log in with Twitch</Button></div>
      </Msg>
    );
  }
  return (
    <Msg h={`Follow to ${what}`} p={`The AK9 Awards are for followers of AIeksK9. Follow the channel, then check again.`}>
      <div className={styles.btnRow}>
        <Button href="https://twitch.tv/aieksk9" variant="primary" size="m" prefixIcon="twitch" data-border="rounded">Follow AIeksK9</Button>
        <Button href={loginUrl()} variant="secondary" size="m" data-border="rounded">I&apos;m following, check again</Button>
      </div>
    </Msg>
  );
}

function Picks({ s, picks, title, names }: { s: Season; picks: Record<string, string>; title: string; names?: boolean }) {
  return (
    <div className={styles.picks}>
      <div className={styles.picksH}>{title}</div>
      {s.awards.map((a) => {
        const v = picks[a.id];
        const label = names ? v : a.nominees.find((n) => n.id === v)?.name;
        return <div key={a.id} className={styles.pick}><span>{a.title}</span><b>{label || "—"}</b></div>;
      })}
    </div>
  );
}

function useSubmit(action: "nominate" | "vote", reload: () => void, demo: boolean) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<Record<string, string> | null>(null);
  const send = async (choices: Record<string, string>) => {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/awards" + (demo ? "?demo=" + action : ""), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, choices }) });
      const d = await r.json();
      if (!r.ok) {
        const e = d.error || "Could not submit. Try again.";
        setNote(e === "already_voted" ? "You already voted." : e === "already_nominated" ? "You already nominated." : e === "follow_required" ? "You need to follow the channel first." : e);
        if (r.status === 409 || r.status === 403) reload();
      } else setDone(choices);
    } catch { setNote("Could not submit. Check your connection and try again."); }
    setBusy(false);
  };
  return { busy, note, done, send };
}

function Nominate({ s, me, demo, reload }: { s: Season; me: Me; demo: boolean; reload: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const { busy, note, done, send } = useSubmit("nominate", reload, demo);
  const w = WORDS[s.theme];
  const mine = done || me.nominated;
  if (mine) return <Msg h="Your nominations are in" p="Thanks! When nominations close, the most-named picks become the finalists. Come back to vote."><Picks s={s} picks={mine} title="You nominated" names /></Msg>;
  if (!me.loggedIn || !me.follows) return <><Gate me={me} what="nominate" /><AwardList awards={s.awards} theme={s.theme} /></>;
  const filled = s.awards.filter((a) => (vals[a.id] || "").trim()).length;
  return (
    <>
      <p className={styles.intro}>Name one person for <b>every</b> award. The button unlocks once all {s.awards.length} are filled in.</p>
      <div className={styles.awards}>
        {s.awards.map((a, i) => (
          <div key={a.id} className={styles.award}>
            <div className={styles.anum}>{w.award} {pad2(i + 1)}</div>
            <div className={styles.atitle}>{a.title}</div>
            {a.description && <div className={styles.adesc}>{a.description}</div>}
            <input className={styles.input} maxLength={60} autoComplete="off" spellCheck={false} placeholder={s.theme === "crime" ? "Who did it?" : "Who deserves this? Type a name"}
              value={vals[a.id] || ""} onChange={(e) => setVals({ ...vals, [a.id]: e.target.value })} />
          </div>
        ))}
      </div>
      <SubmitBar done={filled} total={s.awards.length} word="nominated" label="Submit nominations" busy={busy} note={note} onClick={() => send(vals)} />
    </>
  );
}

function Vote({ s, me, demo, reload }: { s: Season; me: Me; demo: boolean; reload: () => void }) {
  const [pick, setPick] = useState<Record<string, string>>({});
  const { busy, note, done, send } = useSubmit("vote", reload, demo);
  const w = WORDS[s.theme];
  const mine = done || me.voted;
  if (mine) return <Msg h={`Your ${w.ballot} is in`} p="Thanks for voting! You can't change your picks now. Here is what you chose:"><Picks s={s} picks={mine} title="Your ballot" /></Msg>;
  if (!me.loggedIn || !me.follows) return <><Gate me={me} what="vote" /><AwardList awards={s.awards} theme={s.theme} showNominees /></>;
  const chosen = s.awards.filter((a) => pick[a.id]).length;
  return (
    <>
      <div className={styles.awards}>
        {s.awards.map((a, i) => (
          <div key={a.id} className={styles.award}>
            <div className={styles.anum}>{w.award} {pad2(i + 1)}</div>
            <div className={styles.atitle}>{a.title}</div>
            {a.description && <div className={styles.adesc}>{a.description}</div>}
            <div className={styles.noms}>
              {a.nominees.map((n) => (
                <button key={n.id} type="button" className={`${styles.nom} ${pick[a.id] === n.id ? styles.sel : ""}`} onClick={() => setPick({ ...pick, [a.id]: n.id })} aria-pressed={pick[a.id] === n.id}>
                  <Face n={n} size={40} /><span className={styles.nomName}>{n.name}</span>
                  <span className={styles.tick} aria-hidden="true">✓</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SubmitBar done={chosen} total={s.awards.length} word="chosen" label={s.theme === "crime" ? "Submit case file" : "Submit ballot"} busy={busy} note={note} onClick={() => send(pick)} />
    </>
  );
}

function SubmitBar({ done, total, word, label, busy, note, onClick }: { done: number; total: number; word: string; label: string; busy: boolean; note: string; onClick: () => void }) {
  return (
    <div className={styles.submitBar}>
      <div className={styles.prog}><b>{done}</b> of <b>{total}</b> awards {word}{note && <span className={styles.note}> · {note}</span>}</div>
      <button className={styles.btn} disabled={done < total || busy} onClick={onClick}>{busy ? "Submitting…" : label}</button>
    </div>
  );
}

function AwardList({ awards, theme, showNominees }: { awards: Award[]; theme: Season["theme"]; showNominees?: boolean }) {
  const w = WORDS[theme];
  return (
    <div className={`${styles.awards} ${styles.readonly}`}>
      {awards.map((a, i) => (
        <div key={a.id} className={styles.award}>
          <div className={styles.anum}>{w.award} {pad2(i + 1)}</div>
          <div className={styles.atitle}>{a.title}</div>
          {a.description && <div className={styles.adesc}>{a.description}</div>}
          {showNominees && <div className={styles.noms}>{a.nominees.map((n) => <span key={n.id} className={styles.nom}><Face n={n} size={40} /><span className={styles.nomName}>{n.name}</span></span>)}</div>}
        </div>
      ))}
    </div>
  );
}

function Winners({ s, results }: { s: Season; results: Results }) {
  return (
    <>
      <p className={styles.intro}>{results.totalVoters} people voted. Here is who chat picked.</p>
      <div className={styles.results}>{results.awards.map((a, i) => <ResultCard key={a.id} a={a} i={i} theme={s.theme} />)}</div>
      <WildcardList list={results.wildcards || []} />
    </>
  );
}

function Hall({ items }: { items: HallItem[] }) {
  const list = useMemo(() => items || [], [items]);
  if (!list.length) return null;
  return (
    <section className={styles.hall}>
      <div className={styles.sectionH}>Hall of Fame</div>
      <p className={styles.sectionP}>Every season&apos;s winners.</p>
      <div className={styles.hallGrid}>
        {list.map((h) => (
          <a key={h.id} href={`/awards/${h.id}`} className={`${styles.hallCard} ${themeClass(h.theme)}`}>
            <div className={styles.hallLabel}>{h.label}</div>
            <div className={styles.hallMeta}>{h.awardCount} awards · {h.totalVoters} voters</div>
            <div className={styles.hallFaces}>{h.highlights.map((x) => <span key={x.title} title={`${x.title}: ${x.name}`}><Face n={{ name: x.name, image: x.image }} size={36} /></span>)}</div>
            <div className={styles.hallMore}>See the winners →</div>
          </a>
        ))}
      </div>
    </section>
  );
}
