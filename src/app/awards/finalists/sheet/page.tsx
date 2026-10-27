import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { FinalistsSheet } from "@/components/awards/FinalistsSheet";

export async function generateMetadata() {
  const m = Meta.generate({ title: "AK9 Awards · Finalists list", description: "Private list of the AK9 Awards finalists, in reveal order.", baseURL, path: "/awards/finalists/sheet", image: "/og-image.png" });
  return { ...m, robots: { index: false, follow: false } };
}

export default function AwardsFinalistsSheet() {
  return (
    <Column maxWidth="l" fillWidth gap="24" paddingTop="24">
      <FinalistsSheet />
    </Column>
  );
}
