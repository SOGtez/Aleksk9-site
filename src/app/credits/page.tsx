import { Column, Heading, Meta, SmartLink, Text } from "@once-ui-system/core";
import { baseURL } from "@/resources";

/* Credits for the work this site is built on. The Magic Portfolio credit is required by its CC BY-NC 4.0
   license (the footer links here), and the game-icons shapes in the Halloween background need CC BY 3.0 credit. */
export async function generateMetadata() {
  return Meta.generate({
    title: "Credits",
    description: "Credits for the design and art used on aleksk9.com.",
    baseURL,
    path: "/credits",
    image: "/og-image.png",
  });
}

const CREDITS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Website design",
    body: (
      <>
        Design adapted from{" "}
        <SmartLink href="https://once-ui.com/products/magic-portfolio">Magic Portfolio by Once UI</SmartLink>, licensed under{" "}
        <SmartLink href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</SmartLink>. Changes were made: it was
        restyled and rebuilt for AleksK9, with new pages, colors and content.
      </>
    ),
  },
  {
    title: "Halloween background art",
    body: (
      <>
        Pumpkin, ghost, bat and other shapes from <SmartLink href="https://game-icons.net">game-icons.net</SmartLink>, licensed under{" "}
        <SmartLink href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</SmartLink>. They were redrawn as dot art for this site.
      </>
    ),
  },
];

export default function Credits() {
  return (
    <Column maxWidth="s" fillWidth gap="32" paddingTop="24">
      <Column gap="8">
        <Heading variant="display-strong-s">Credits</Heading>
        <Text onBackground="neutral-weak" variant="body-default-l">
          Credits for the design and art used on aleksk9.com.
        </Text>
      </Column>
      {CREDITS.map((c) => (
        <Column key={c.title} gap="8">
          <Heading as="h2" variant="heading-strong-m">{c.title}</Heading>
          <Text variant="body-default-m" onBackground="neutral-medium">{c.body}</Text>
        </Column>
      ))}
    </Column>
  );
}
