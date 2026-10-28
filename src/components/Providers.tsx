"use client";

import {
  BorderStyle,
  ChartMode,
  ChartVariant,
  DataThemeProvider,
  IconProvider,
  LayoutProvider,
  NeutralColor,
  ScalingSize,
  Schemes,
  SolidStyle,
  SolidType,
  SurfaceStyle,
  ThemeProvider,
  ToastProvider,
  TransitionStyle,
} from "@once-ui-system/core";
import { createContext, useContext, useEffect, useState } from "react";
import { style, dataStyle } from "../resources";
import { SEASONS, Season, isSeasonId } from "../resources/seasons";
import { iconLibrary } from "../resources/icons";

/* The site theme (holiday look): the one the server picked, or a preview from ?theme=<id> (kept for the browser tab
   until ?theme=live). Logos read it with useSeason(); public/theme/season.js draws the dot art for it. */
const PREVIEW_KEY = "ak9.theme.preview";
const SeasonContext = createContext<Season>(SEASONS.normal);
export const useSeason = () => useContext(SeasonContext);

export function Providers({ children, season: live }: { children: React.ReactNode; season: Season }) {
  const [season, setSeason] = useState(live);
  useEffect(() => {
    let id: string | null = null;
    const q = new URLSearchParams(window.location.search).get("theme");
    try {
      if (q === "live" || q === "off") sessionStorage.removeItem(PREVIEW_KEY);
      else if (q) sessionStorage.setItem(PREVIEW_KEY, q);
      id = q === "live" || q === "off" ? null : q || sessionStorage.getItem(PREVIEW_KEY);
    } catch { id = q === "live" || q === "off" ? null : q; }
    const s = isSeasonId(id) ? SEASONS[id] : live;
    if (s.id === live.id) return;
    /* Once UI only reads its colours once, so a preview sets them on <html> directly. */
    const root = document.documentElement;
    root.setAttribute("data-season", s.id);
    root.setAttribute("data-brand", s.brand); root.setAttribute("data-accent", s.accent); root.setAttribute("data-neutral", s.neutral);
    (window as unknown as { __AK9_SEASON: Season }).__AK9_SEASON = s;
    window.dispatchEvent(new CustomEvent("ak9:season", { detail: s }));
    setSeason(s);
  }, [live]);
  return (
    <LayoutProvider>
      <ThemeProvider
        brand={live.brand as Schemes}
        accent={live.accent as Schemes}
        neutral={live.neutral as NeutralColor}
        solid={style.solid as SolidType}
        solidStyle={style.solidStyle as SolidStyle}
        border={style.border as BorderStyle}
        surface={style.surface as SurfaceStyle}
        transition={style.transition as TransitionStyle}
        scaling={style.scaling as ScalingSize}
      >
        <DataThemeProvider
          variant={dataStyle.variant as ChartVariant}
          mode={dataStyle.mode as ChartMode}
          height={dataStyle.height}
          axis={{
            stroke: dataStyle.axis.stroke,
          }}
          tick={{
            fill: dataStyle.tick.fill,
            fontSize: dataStyle.tick.fontSize,
            line: dataStyle.tick.line,
          }}
        >
          <ToastProvider>
            <IconProvider icons={iconLibrary}><SeasonContext.Provider value={season}>{children}</SeasonContext.Provider></IconProvider>
          </ToastProvider>
        </DataThemeProvider>
      </ThemeProvider>
    </LayoutProvider>
  );
}
