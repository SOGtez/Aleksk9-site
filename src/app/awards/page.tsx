import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { AwardsSoon } from "@/components/awards/AwardsSoon";

export async function generateMetadata() {
  return Meta.generate({
    title: "AK9 Awards",
    description: "The AK9 Awards: seasonal community awards, nominated and voted by chat. Opening soon.",
    baseURL,
    path: "/awards",
    image: "/og-image.png",
  });
}

export default function Awards() {
  return (
    <Column maxWidth="m" fillWidth gap="24" paddingTop="24">
      <AwardsSoon />
    </Column>
  );
}
