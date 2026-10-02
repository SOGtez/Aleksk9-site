import { Column, Heading, Meta, Text } from "@once-ui-system/core";
import { baseURL, calendar } from "@/resources";
import { CalendarView } from "@/components/calendar/CalendarView";

export async function generateMetadata() {
  return Meta.generate({
    title: calendar.title,
    description: calendar.description,
    baseURL: baseURL,
    path: calendar.path,
    image: "/og-image.png",
  });
}

export default function Calendar() {
  return (
    <Column maxWidth="l" fillWidth gap="24" paddingTop="24">
      <Column gap="8" paddingX="4">
        <Heading variant="display-strong-s">{calendar.title}</Heading>
        <Text onBackground="neutral-weak" variant="body-default-l">
          {calendar.description}
        </Text>
      </Column>
      <CalendarView />
    </Column>
  );
}
