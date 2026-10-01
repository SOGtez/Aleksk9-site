import { About, Blog, Gallery, Home, Newsletter, Person, Social, Work } from "@/types";
import { Line, Row, Text } from "@once-ui-system/core";

/* Everything the homepage, About and Blog pages say lives here.
   Social links: only add ones that exist. Anything missing just isn't shown. */

const person: Person = {
  firstName: "Aleks",
  lastName: "K9",
  name: "AleksK9",
  role: "Variety streamer",
  avatar: "/assets/ak9-logo.png",
  email: "",
  location: "America/Los_Angeles", // only used if display.location / display.time are turned on
  languages: [],
  locale: "en",
};

const newsletter: Newsletter = {
  display: false,
  title: <>Stay in the loop</>,
  description: <>Stream and event updates</>,
};

const social: Social = [
  {
    name: "Twitch",
    icon: "twitch",
    link: "https://twitch.tv/aleksk9_",
    essential: true,
  },
];

const home: Home = {
  path: "/",
  image: "/og-image.png",
  label: "Home",
  title: "AleksK9 — Variety streamer on Twitch",
  description: "AleksK9 is a variety streamer on Twitch, live daily with a little bit of everything.",
  headline: <>Live on Twitch daily.</>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">Spooktober</strong>{" "}
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          All October on stream
        </Text>
      </Row>
    ),
    href: "/blog/spooktober",
  },
  subline: (
    <>
      I'm <Text as="span" size="xl" weight="strong">AleksK9</Text>. I do a little bit of everything on stream:
      games, hanging out with chat, community events and whatever comes next.
    </>
  ),
};

const about: About = {
  path: "/about",
  label: "About",
  title: "About AleksK9",
  description: "Meet AleksK9, variety streamer on Twitch",
  tableOfContent: {
    display: true,
    subItems: false,
  },
  avatar: {
    display: true,
  },
  calendar: {
    display: false,
    link: "",
  },
  intro: {
    display: true,
    title: "Introduction",
    description: (
      <>
        AleksK9 is a variety streamer on Twitch, live daily with a little bit of everything: whatever game
        is on the menu that day, hanging out with chat, and community events like Spooktober.
      </>
    ),
  },
  work: {
    display: true,
    title: "Community events",
    experiences: [
      /* Newest first: older events are further down the list. */
      {
        company: "Spooktober",
        timeframe: "October 2026 · Now",
        role: "Stream event",
        achievements: [<>The Halloween event on stream, running all through October.</>],
        images: [],
      },
      {
        company: "R6 5v5 Tournament",
        timeframe: "September 2026",
        role: "One-time event, co-hosted with Notvash30",
        achievements: [
          <>Six captains drafted their teams live on the site in a snake draft.</>,
          <>Single-elimination playoffs with a live bracket. Team Alfie took the title.</>,
        ],
        images: [],
      },
    ],
  },
  studies: {
    display: false,
    title: "Studies",
    institutions: [],
  },
  technical: {
    display: true,
    title: "On stream",
    skills: [
      {
        title: "Variety",
        description: <>A little bit of everything: different games, hanging out with chat and the occasional community event.</>,
        tags: [],
        images: [],
      },
    ],
  },
};

const blog: Blog = {
  path: "/blog",
  label: "Blog",
  title: "Updates from AleksK9",
  description: "News about streams and community events",
  // Add a post by adding a new .mdx file to src/app/blog/posts
};

/* Work and Gallery pages are turned off (see routes in once-ui.config.ts). */
const work: Work = {
  path: "/work",
  label: "Work",
  title: "Projects",
  description: "",
};

const gallery: Gallery = {
  path: "/gallery",
  label: "Gallery",
  title: "Gallery",
  description: "",
  images: [],
};

export { person, social, newsletter, home, about, blog, work, gallery };
