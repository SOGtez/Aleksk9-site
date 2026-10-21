import { Column, Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { HallSeason } from "@/components/awards/HallSeason";

type Props = { params: Promise<{ season: string }> };

export async function generateMetadata({ params }: Props) {
  const { season } = await params;
  return Meta.generate({
    title: "AK9 Awards · Hall of Fame",
    description: "The winners of a past AK9 Awards season.",
    baseURL,
    path: `/awards/${season}`,
    image: "/og-image.png",
  });
}

export default async function AwardsSeason({ params }: Props) {
  const { season } = await params;
  return (
    <Column maxWidth="l" fillWidth gap="24" paddingTop="24">
      <HallSeason id={season} />
    </Column>
  );
}
