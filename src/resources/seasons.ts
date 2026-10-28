/* Site themes (holiday looks) for aleksk9.com. An admin picks one on the admin page (Site theme tab); it is saved
   in the database and every page follows it: brand colours, the logo, the dot art behind the content and, for some,
   a gentle fall of snow or leaves. "auto" follows the calendar in Los Angeles time.
   Used by the Next.js layout (server), the Providers (preview with ?theme=<id>) and /api/site-theme, which hands the
   same data to the plain-HTML pages (public/theme/season.js). */

export type SeasonId = "normal" | "halloween" | "thanksgiving" | "christmas";
export type SeasonSetting = SeasonId | "auto";
export type Season = {
  id: SeasonId;
  label: string;
  brand: string;     /* Once UI colour schemes */
  accent: string;
  neutral: string;
  logo: { nav: string; hero: string };
  dots: boolean;     /* holiday dot art behind the content (public/theme/season.js) */
  fall: "" | "snow" | "leaves";
};

export const SEASONS: Record<SeasonId, Season> = {
  normal: { id: "normal", label: "Normal", brand: "red", accent: "orange", neutral: "gray", logo: { nav: "/assets/ak9-logo-nav.png", hero: "/assets/ak9-logo-hero.png" }, dots: false, fall: "" },
  halloween: { id: "halloween", label: "Halloween", brand: "orange", accent: "violet", neutral: "gray", logo: { nav: "/assets/ak9-logo-halloween-nav.png", hero: "/assets/ak9-logo-halloween-hero.png" }, dots: true, fall: "" },
  thanksgiving: { id: "thanksgiving", label: "Thanksgiving", brand: "orange", accent: "yellow", neutral: "sand", logo: { nav: "/assets/ak9-logo-thanksgiving-nav.png", hero: "/assets/ak9-logo-thanksgiving-hero.png" }, dots: true, fall: "leaves" },
  christmas: { id: "christmas", label: "Christmas", brand: "red", accent: "green", neutral: "gray", logo: { nav: "/assets/ak9-logo-christmas-nav.png", hero: "/assets/ak9-logo-christmas-hero.png" }, dots: true, fall: "snow" },
};
export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];
export const SETTINGS: SeasonSetting[] = ["auto", ...SEASON_IDS];
/* What the site shows until an admin picks something: the look it had before this switch existed. */
export const DEFAULT_SETTING: SeasonSetting = "halloween";

export const isSeasonId = (v: unknown): v is SeasonId => typeof v === "string" && (SEASON_IDS as string[]).includes(v);
export const isSetting = (v: unknown): v is SeasonSetting => v === "auto" || isSeasonId(v);

/* "auto": October Halloween, November Thanksgiving, December Christmas, the rest of the year normal (LA time). */
export function seasonForDate(d: Date = new Date()): SeasonId {
  const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric" }).format(d));
  return m === 10 ? "halloween" : m === 11 ? "thanksgiving" : m === 12 ? "christmas" : "normal";
}
export function resolveSeason(setting: unknown): Season {
  const s: SeasonSetting = isSetting(setting) ? setting : DEFAULT_SETTING;
  return SEASONS[s === "auto" ? seasonForDate() : s];
}
