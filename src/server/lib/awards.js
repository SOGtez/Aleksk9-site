/* AK9 Awards: the season rules shared by the API (src/pages/api/awards.js).
   A season goes soon → nominate → vote → closed → revealed. Admins set the phase; nomination and voting
   deadlines also close things on their own. */
import { PAST_SEASONS } from './awards-archive.js';

export const THEMES = ['classic', 'crime', 'spooky'];
export const PHASES = ['soon', 'nominate', 'vote', 'closed', 'revealed'];

const past = (iso) => !!iso && Date.now() > Date.parse(iso);
/* What visitors actually see right now, from the phase plus its dates. */
export function stageOf(season) {
  if (!season) return 'soon';
  switch (season.phase) {
    case 'nominate':
      if (season.nominateOpen && !past(season.nominateOpen)) return 'nominate-soon';
      return past(season.nominateDeadline) ? 'nominate-closed' : 'nominate';
    case 'vote': return past(season.voteDeadline) ? 'closed' : 'vote';
    case 'closed': return 'closed';
    case 'revealed': return 'revealed';
    default: return 'soon';
  }
}
export const showsFinalists = (stage) => ['vote', 'closed', 'revealed'].includes(stage);

/* Names typed in nominations, made comparable: "@Pedro  Sahur " and "pedro sahur" count together. */
export const normName = (s) => String(s || '').trim().replace(/^@+/, '').replace(/\s+/g, ' ').toLowerCase();

/* Vote counts per finalist. A tie gives several winners unless an admin picked the winner (award.winnerIds). */
export function computeResults(season, ballots) {
  const list = Object.values(ballots || {}).map((b) => (typeof b === 'string' ? JSON.parse(b) : b));
  const awards = (season.awards || []).map((a) => {
    const counts = {}; let total = 0;
    for (const b of list) { const pick = b.choices && b.choices[a.id]; if (pick) { counts[pick] = (counts[pick] || 0) + 1; total++; } }
    const nominees = (a.nominees || []).map((n) => ({ ...n, votes: counts[n.id] || 0 })).sort((x, y) => y.votes - x.votes);
    const top = nominees.length ? nominees[0].votes : 0;
    const manual = (a.winnerIds || []).filter((id) => nominees.some((n) => n.id === id));
    const winnerIds = manual.length ? manual : top > 0 ? nominees.filter((n) => n.votes === top).map((n) => n.id) : [];
    return { id: a.id, title: a.title, description: a.description || '', total, winnerIds, nominees };
  });
  return { totalVoters: list.length, awards };
}

/* Tally of nomination names per award, most named first. */
export function tallyNominations(season, entries) {
  const out = {};
  for (const a of season.awards || []) out[a.id] = {};
  for (const raw of Object.values(entries || {})) {
    const e = typeof raw === 'string' ? JSON.parse(raw) : raw;
    for (const [awardId, name] of Object.entries(e.choices || {})) {
      if (!out[awardId]) continue;
      const k = normName(name); if (!k) continue;
      const t = out[awardId][k] || (out[awardId][k] = { name: String(name).trim().replace(/^@+/, ''), count: 0 });
      t.count++;
    }
  }
  const res = {};
  for (const [id, m] of Object.entries(out)) res[id] = Object.values(m).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return res;
}

/* Short version of a finished season for the Hall of Fame list. */
export function hallSummary(s) {
  return {
    id: s.id, label: s.label, theme: s.theme || 'classic', totalVoters: s.totalVoters || 0, awardCount: (s.awards || []).length,
    highlights: (s.awards || []).slice(0, 4).map((a) => {
      const w = (a.nominees || []).find((n) => (a.winnerIds || []).includes(n.id));
      return { title: a.title, name: w ? w.name : '', image: w ? w.image || '' : '' };
    }),
  };
}
export const pastSeasons = () => PAST_SEASONS;

/* The standard AK9 Seasonal Awards list a new season starts from (renamed for the Fall 2026 season).
   `was` is the July 2026 title, only used to borrow July's finalists for the test-site sample season.
   Titles and descriptions can be edited per season on the admin page. */
export const STANDARD_AWARDS = [
  { title: "The Biggest Sellout Award", was: "Worst Gamer Award!", description: "This award goes to the gamer who somehow manages to sell every game they touch. Whether it's missing the easiest shots or making the worst decisions possible, watching them play is genuinely painful. They are the definition of throwing." },
  { title: "The Elite Gamer Award", description: "This award goes to the most skilled gamer in the community. No matter the game or who they're up against, they always find a way to dominate. When it comes to gaming, they're simply on another level." },
  { title: "The Hall of Fame Meme Award", was: "The Funniest Community Meme Award!", description: "This award recognizes the funniest inside joke or meme created within the AK9 community. A meme so iconic that it became part of the community's identity and will be remembered long after the season ends." },
  { title: "The Midnight Legend Award", was: "The Night Owl Award!", description: "This award goes to the viewer who's always around, no matter how late it gets. Whether it's midnight or 5 in the morning, they're somehow still in chat. Sleep clearly isn't their biggest priority." },
  { title: "The Bermuda Triangle Award", description: "This award goes to the viewer who disappears off the face of the earth without warning. They'll be active every day for a month and then vanish for the next three. There's a good chance they won't even know they were nominated." },
  { title: "The Class Clown Award", was: "Comedian Award!", description: "This award goes to the naturally funniest person in the community. Whether it's their jokes, random comments, or perfectly timed messages, they always have chat laughing. You never know what they'll say next." },
  { title: "The Unbreakable Duo Award", was: "The Best AK9 Duo Award!", description: "This award recognizes two people with one of the strongest bonds in the community. They're always together, have each other's backs, and bring out the best in one another. When you see one, the other probably isn't far behind." },
  { title: "The Ultimate Collab Award", description: "This award goes to the streamer or group of streamers who had the most memorable collaboration with Aleks this season. Whether it was hilarious, chaotic, or just a great stream overall, this collab stood above the rest." },
  { title: "The Fan Favorite Guest Award", description: "This award goes to the guest who made the biggest impression on the community. They might not be a streamer themselves, but whenever they join Aleks, they make the stream even better. Someone chat is always happy to see return." },
  { title: "The Rising Star Award", was: "The Best Upcoming Viewer Award!", description: "This award recognizes a newer viewer who's quickly making a name for themselves. They might not have been around the longest, but their support, activity, and personality have already made them stand out. They're becoming a familiar face in AK9." },
  { title: "The Outstanding Moderator Award", was: "The Best Mod Award!", description: "This award goes to the moderator who has gone above and beyond for the AK9 community. Whether it's keeping chat under control, helping viewers, or making sure streams run smoothly, they're always doing their part. Their consistency, dedication, and effort have earned them the respect of the community." },
  { title: "The Day One Award", was: "The OG Viewer Award!", description: "This award goes to a viewer who's been part of AK9 since the very beginning. They've seen the highs, the lows, and everything in between, yet they're still here showing support. Not everyone can say they've been here since day one." },
  { title: "The People's Favorite Award", was: "The Most Loved Viewer Award!", description: "This award goes to the viewer who has earned the love and respect of almost everyone in the community. They can get along with just about anybody, and their presence always makes the stream better. AK9 wouldn't feel the same without them." },
  { title: "The Creator Spotlight Award", was: "The Best AK9 Creator!", description: "This award recognizes a creator who's making a name for themselves while still being a big part of AK9. They consistently put effort into their own content, build their own community, and continue supporting others along the way. Their hard work is starting to pay off." },
  { title: "The Queen of AK9 Award", was: "The Best Female Viewer!", description: "This award recognizes the female viewer who has made the biggest impact on the community this season. Through her support, positivity, and dedication, she's become someone everyone recognizes and respects. Her presence goes beyond just AK9, making a difference in other communities as well." },
  { title: "The AK9 MVP Award 👑", was: "The Best Viewer Award!", description: "The highest honor of the AK9 Seasonal Awards. This award recognizes the viewer who has truly stood above the rest this season. Through their loyalty, activity, positivity, and constant support, they've become someone the entire community respects. They represent what AK9 is all about, and without them, the streams simply wouldn't be the same." },
];

/* The test site has no database: a sample season built from July 2026 so every stage can be previewed with
   ?demo=soon|nominate|vote|closed|revealed. */
export function demoSeason(stage) {
  const july = PAST_SEASONS[0];
  const phase = ['nominate-soon', 'nominate-closed'].includes(stage) ? 'nominate' : PHASES.includes(stage) ? stage : 'vote';
  const day = 86400e3, now = Date.now();
  const season = {
    id: 'demo', label: 'Fall 2026 (sample)', theme: 'classic', revealStyle: 'pumpkin', phase,
    nominateOpen: stage === 'nominate-soon' ? new Date(now + 2 * day).toISOString() : '',
    nominateDeadline: stage === 'nominate-closed' ? new Date(now - day).toISOString() : new Date(now + 5 * day).toISOString(),
    voteDeadline: new Date(now + 3 * day).toISOString(),
    awards: [], wildcards: july.wildcards,
  };
  /* Sample finalists and votes: July's for the awards July had, borrowed names for the new ones. */
  const pool = july.awards[july.awards.length - 1].nominees;
  const sample = STANDARD_AWARDS.map((std, i) => {
    const old = std.was ? july.awards.find((a) => a.title === std.was) : null;
    const noms = old ? old.nominees : pool.slice(i % 3, (i % 3) + 4).map((n, j) => ({ ...n, id: `s${i}-${j}`, votes: [12, 8, 5, 2][j] }));
    return { id: old ? old.id : 'std' + i, title: std.title, description: std.description, noms };
  });
  season.awards = sample.map((a) => ({ id: a.id, title: a.title, description: a.description, nominees: a.noms.map(({ votes, ...n }) => n) }));
  const ballots = {};
  sample.forEach((a) => { let i = 0; for (const n of a.noms) for (let v = 0; v < n.votes; v++) { const k = 'v' + i++; (ballots[k] = ballots[k] || { choices: {} }).choices[a.id] = n.id; } });
  return { season, ballots };
}
