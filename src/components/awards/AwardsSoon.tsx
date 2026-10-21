"use client";

import { Background, Button, Column, Heading, Text } from "@once-ui-system/core";

/* Placeholder for /awards until the full AK9 Awards (nominations, voting, winner reveal, Hall of Fame) goes live.
   Same glowing card as the homepage event card. */
export const AwardsSoon = () => (
  <Column
    overflow="hidden"
    fillWidth
    padding="xl"
    radius="l"
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
      gradient={{ display: true, opacity: 90, x: 50, y: 0, width: 50, height: 50, tilt: 0, colorStart: "brand-background-strong", colorEnd: "static-transparent" }}
      dots={{ display: true, opacity: 30, size: "2", color: "accent-on-background-weak" }}
      grid={{ display: false, opacity: 100, color: "neutral-alpha-medium", width: "0.25rem", height: "0.25rem" }}
      lines={{ display: false, opacity: 100, color: "neutral-alpha-medium", size: "16", thickness: 1, angle: 90 }}
    />
    <Column maxWidth="s" horizontal="center" gap="12" paddingY="l">
      <Text variant="label-strong-s" onBackground="brand-weak">SEASONAL COMMUNITY AWARDS</Text>
      <Heading variant="display-strong-s" wrap="balance">AK9 Awards</Heading>
      <Text variant="heading-strong-m" onBackground="accent-weak">Opens soon</Text>
      <Text wrap="balance" marginBottom="l" variant="body-default-l" onBackground="neutral-weak">
        Chat nominates, chat votes, and Aleks reveals the winners on stream. Follow on Twitch so you don&apos;t miss
        when nominations open.
      </Text>
      <Button href="https://twitch.tv/aieksk9" variant="primary" size="m" prefixIcon="twitch" data-border="rounded">
        Follow on Twitch
      </Button>
    </Column>
  </Column>
);
