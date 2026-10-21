import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { RevealStage } from "@/components/awards/RevealStage";

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
    <Column maxWidth="xl" fillWidth paddingTop="8">
      <RevealStage />
    </Column>
  );
}
