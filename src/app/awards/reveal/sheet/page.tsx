import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { WinnersSheet } from "@/components/awards/WinnersSheet";

export async function generateMetadata() {
  const m = Meta.generate({ title: "AK9 Awards · Winners list", description: "Private list of the AK9 Awards winners, in reveal order.", baseURL, path: "/awards/reveal/sheet", image: "/og-image.png" });
  return { ...m, robots: { index: false, follow: false } };
}

export default function AwardsWinnersSheet() {
  return (
    <Column maxWidth="l" fillWidth gap="24" paddingTop="24">
      <WinnersSheet />
    </Column>
  );
}
