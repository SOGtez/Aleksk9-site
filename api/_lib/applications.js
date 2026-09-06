/* Shared application field rules (used by /api/apply and the admin endpoint). */
export const PLATFORMS = ['PlayStation', 'Xbox', 'PC'];
export const RANKS = ['Unranked', 'Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Champion'];
export const ROLES = ['Entry', 'Flex', 'Support', 'Anchor', 'Intel'];
export const STATUSES = ['pending', 'accepted', 'rejected'];

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/* Validate the player-supplied part of an application. Returns { ok, errors, data }. */
export function cleanApplication(b, dates) {
  const errors = [];
  const d = {
    ign: str(b.ign, 40),
    platform: PLATFORMS.includes(b.platform) ? b.platform : '',
    hours: int(b.hours, 0, 100000),
    rank: RANKS.includes(b.rank) ? b.rank : '',
    peakRank: RANKS.includes(b.peakRank) ? b.peakRank : '',
    champs: int(b.champs, 0, 99),
    roles: Array.isArray(b.roles) ? b.roles.filter(r => ROLES.includes(r)).slice(0, 2) : [],
    captain: !!b.captain,
    discord: str(b.discord, 40),
    availability: Array.isArray(b.availability) ? b.availability.map(x => str(x, 60)).filter(x => !dates.length || dates.includes(x)).slice(0, 20) : [],
    notes: str(b.notes, 300)
  };
  if (!d.ign) errors.push('In-game name is required');
  if (!d.platform) errors.push('Pick a platform');
  if (!d.rank) errors.push('Pick your current rank');
  if (!d.peakRank) errors.push('Pick your highest rank');
  if (!d.roles.length) errors.push('Pick at least one role');
  if (!d.discord) errors.push('Discord username is required so captains can reach you');
  if (dates.length && !d.availability.length) errors.push('Pick at least one date you can play');
  return { ok: !errors.length, errors, data: d };
}

/* Suggested tier from peak rank: 0 champs, 1 ranked high, 2 everyone else. */
export function suggestTier(app) {
  if (app.peakRank === 'Champion' || app.champs > 0) return 0;
  if (['Diamond', 'Emerald', 'Platinum'].includes(app.peakRank)) return 1;
  return 2;
}
export function infoLine(app) {
  const bits = [];
  if (app.hours) bits.push(app.hours + ' hrs');
  if (app.champs) bits.push(app.champs + 'x Champ');
  else if (app.peakRank && app.peakRank !== 'Unranked') bits.push(app.peakRank);
  else if (app.rank) bits.push(app.rank);
  if (app.roles && app.roles.length) bits.push(app.roles.join(' / '));
  return bits.join(' · ');
}
