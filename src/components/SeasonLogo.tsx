"use client";

import { useSeason } from "@/components/Providers";
import type { SeasonId } from "@/resources/seasons";

/* The AK9 logo in the current site theme (Halloween, Thanksgiving, Christmas or normal). */
export function SeasonLogo({ kind = "hero", width = 300 }: { kind?: "hero" | "nav"; width?: number }) {
  const season = useSeason();
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={season.logo[kind]} data-logo={kind} alt="" width={width} style={{ width, height: "auto" }} />;
}

/* Shows its children only while the site is in one of the given themes (e.g. the Spooktober badge in Halloween). */
export function SeasonOnly({ in: ids, children }: { in: SeasonId[]; children: React.ReactNode }) {
  const season = useSeason();
  return ids.includes(season.id) ? <>{children}</> : null;
}
