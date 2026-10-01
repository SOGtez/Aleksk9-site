import {
  Heading,
  Text,
  Button,
  RevealFx,
  Column,
  Badge,
  Row,
  Schema,
  Meta,
  Line,
} from "@once-ui-system/core";
import { home, about, person, baseURL, routes } from "@/resources";
import { Posts } from "@/components/blog/Posts";
import { StreamSection } from "@/components/StreamSection";
import { EventCard } from "@/components/EventCard";

export async function generateMetadata() {
  return Meta.generate({
    title: home.title,
    description: home.description,
    baseURL: baseURL,
    path: home.path,
    image: home.image,
  });
}

export default function Home() {
  return (
    <Column maxWidth="l" gap="xl" paddingY="12" horizontal="center">
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={home.path}
        title={home.title}
        description={home.description}
        image={home.image}
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />

      {/* Hero */}
      <Column fillWidth horizontal="center" gap="m">
        <Column maxWidth="s" horizontal="center" align="center">
          {home.featured.display && (
            <RevealFx fillWidth horizontal="center" paddingTop="16" paddingBottom="24" paddingLeft="12">
              <Badge
                background="brand-alpha-weak"
                paddingX="12"
                paddingY="4"
                onBackground="neutral-strong"
                textVariant="label-default-s"
                arrow={false}
                href={home.featured.href}
              >
                <Row paddingY="2">{home.featured.title}</Row>
              </Badge>
            </RevealFx>
          )}
          <RevealFx translateY="4" fillWidth horizontal="center" paddingBottom="8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/ak9-logo-hero.png" alt="" width={300} height={179} style={{ width: 300, height: "auto" }} />
          </RevealFx>
          <RevealFx translateY="4" fillWidth horizontal="center" paddingBottom="16">
            <Heading wrap="balance" variant="display-strong-l">
              {home.headline}
            </Heading>
          </RevealFx>
          <RevealFx translateY="8" delay={0.2} fillWidth horizontal="center" paddingBottom="32">
            <Text wrap="balance" onBackground="neutral-weak" variant="heading-default-xl">
              {home.subline}
            </Text>
          </RevealFx>
          <RevealFx paddingTop="4" delay={0.4} horizontal="center">
            <Row gap="12" s={{ direction: "column" }}>
              <Button href="https://twitch.tv/aieksk9" prefixIcon="twitch" variant="primary" size="m" data-border="rounded">
                Watch on Twitch
              </Button>
              <Button href={about.path} variant="secondary" size="m" data-border="rounded" arrowIcon>
                About me
              </Button>
            </Row>
          </RevealFx>
        </Column>
      </Column>

      {/* Live stream + chat */}
      <RevealFx translateY="16" delay={0.5} fillWidth>
        <Column fillWidth gap="16">
          <Heading as="h2" variant="display-strong-xs">
            Watch live
          </Heading>
          <StreamSection />
        </Column>
      </RevealFx>

      {/* Tournament: the glow follows the mouse, like the template's newsletter card */}
      <EventCard />

      {/* Blog */}
      {routes["/blog"] && (
        <Column fillWidth gap="24" marginBottom="l">
          <Row fillWidth paddingRight="64">
            <Line maxWidth={48} />
          </Row>
          <Row fillWidth gap="24" marginTop="40" s={{ direction: "column" }}>
            <Row flex={1} paddingLeft="l" paddingTop="24">
              <Heading as="h2" variant="display-strong-xs" wrap="balance">
                Latest updates
              </Heading>
            </Row>
            <Row flex={3} paddingX="20">
              <Posts range={[1, 2]} columns="2" />
            </Row>
          </Row>
          <Row fillWidth paddingLeft="64" horizontal="end">
            <Line maxWidth={48} />
          </Row>
        </Column>
      )}
    </Column>
  );
}
