import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { AwardsApp } from "@/components/awards/AwardsApp";

export async function generateMetadata() {
  return Meta.generate({
    title: "AK9 Awards",
    description: "The AK9 Awards: seasonal community awards, nominated and voted by chat, with every season's winners in the Hall of Fame.",
    baseURL,
    path: "/awards",
    image: "/og-image.png",
  });
}

export default function Awards() {
  return (
    <Column maxWidth="l" fillWidth gap="24" paddingTop="24">
      <AwardsApp />
    </Column>
  );
}
