import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { HallSeason } from "@/components/awards/HallSeason";

export async function generateMetadata() {
  const m = Meta.generate({ title: "AK9 Awards · Results preview", description: "Unlisted preview of the AK9 Awards results.", baseURL, path: "/awards/preview", image: "/og-image.png" });
  return { ...m, robots: { index: false, follow: false } };
}

export default function AwardsPreview() {
  return (
    <Column maxWidth="l" fillWidth gap="24" paddingTop="24">
      <HallSeason share />
    </Column>
  );
}
