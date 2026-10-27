import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { FinalistsStage } from "@/components/awards/FinalistsStage";

export async function generateMetadata() {
  const m = Meta.generate({ title: "AK9 Awards · Finalists reveal", description: "The AK9 Awards finalists, revealed one pumpkin at a time.", baseURL, path: "/awards/finalists", image: "/og-image.png" });
  return { ...m, robots: { index: false, follow: false } };
}

export default function AwardsFinalists() {
  return (
    <Column maxWidth="xl" fillWidth paddingTop="8">
      <FinalistsStage />
    </Column>
  );
}
