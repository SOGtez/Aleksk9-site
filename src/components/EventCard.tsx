"use client";

import { Background, Button, Column, Heading, Row, Text } from "@once-ui-system/core";

/* Community event card on the homepage. Built like the template's newsletter card: the glow follows the
   mouse (mask.cursor), here in the site's red with orange dots. Client component because of the cursor effect. */
export const EventCard = () => (
  <Column
    overflow="hidden"
    fillWidth
    padding="xl"
    radius="l"
    marginBottom="m"
    horizontal="center"
    align="center"
    background="surface"
    border="neutral-alpha-weak"
    s={{ padding: "l" }}
  >
    <Background
      top="0"
      position="absolute"
      mask={{ x: 50, y: 0, radius: 100, cursor: true }}
      gradient={{
        display: true,
        opacity: 90,
        x: 50,
        y: 0,
        width: 50,
        height: 50,
        tilt: 0,
        colorStart: "brand-background-strong",
        colorEnd: "static-transparent",
      }}
      dots={{ display: true, opacity: 30, size: "2", color: "accent-on-background-weak" }}
      grid={{ display: false, opacity: 100, color: "neutral-alpha-medium", width: "0.25rem", height: "0.25rem" }}
      lines={{ display: false, opacity: 100, color: "neutral-alpha-medium", size: "16", thickness: 1, angle: 90 }}
    />
    <Column maxWidth="s" horizontal="center" gap="12">
      <Text variant="label-strong-s" onBackground="brand-weak">
        PAST EVENT
      </Text>
      <Heading variant="display-strong-xs" wrap="balance">
        R6 5v5 Tournament
      </Heading>
      <Text wrap="balance" marginBottom="l" variant="body-default-l" onBackground="neutral-weak">
        A one-time community tournament co-hosted with Notvash30. Six captains drafted their squads live on the
        site, then fought it out in a single-elimination bracket. Team Alfie took the title.
      </Text>
    </Column>
    <Row gap="12" horizontal="center" s={{ direction: "column" }}>
      <Button href="/bracket" variant="primary" size="m" prefixIcon="bracket" data-border="rounded">
        See the bracket
      </Button>
      <Button href="/tournament" variant="secondary" size="m" prefixIcon="trophy" data-border="rounded">
        Rosters and stats
      </Button>
    </Row>
  </Column>
);
