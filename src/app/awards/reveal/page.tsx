import { Column, Meta } from "@once-ui-system/core";
import { Anton, Oswald, Space_Mono, Special_Elite } from "next/font/google";
import { baseURL } from "@/resources";
import { RevealStage } from "@/components/awards/RevealStage";

/* Typewriter and stencil fonts for the forensics evidence bag (crime theme). */
const fd = Anton({ weight: "400", subsets: ["latin"], variable: "--ev-fd", display: "swap" });
const fo = Oswald({ weight: ["400", "600"], subsets: ["latin"], variable: "--ev-fo", display: "swap" });
const ft = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--ev-ft", display: "swap" });
const fm = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--ev-fm", display: "swap" });

export async function generateMetadata() {
  return Meta.generate({
    title: "AK9 Awards · Winner reveal",
    description: "The AK9 Awards winners, revealed one award at a time.",
    baseURL,
    path: "/awards/reveal",
    image: "/og-image.png",
  });
}

export default function AwardsReveal() {
  return (
    <Column maxWidth="xl" fillWidth paddingTop="8" className={`${fd.variable} ${fo.variable} ${ft.variable} ${fm.variable}`}>
      <RevealStage />
    </Column>
  );
}
