import { About, Blog, Gallery, Home, Newsletter, Person, Social, Work } from "@/types";
import { Line, Row, Text } from "@once-ui-system/core";

/* Everything the homepage, About and Blog pages say lives here.
   Social links: only add ones that exist. Anything missing just isn't shown. */

const person: Person = {
  firstName: "Aleks",
  lastName: "K9",
  name: "AleksK9",
  role: "Twitch streamer",
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
  title: "AleksK9 — Twitch streamer",
  description: "AleksK9 on Twitch: Rainbow Six Siege streams, community tournaments and Spooktober.",
  headline: <>Live on Twitch daily.</>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">R6 5v5 Tournament</strong>{" "}
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          See the bracket
        </Text>
      </Row>
    ),
    href: "/bracket",
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
  description: "Meet AleksK9, Twitch streamer and community tournament host",
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
        AleksK9 is a Twitch streamer who plays Rainbow Six Siege and brings the community together
        with events: drafted 5v5 tournaments, live brackets and themed months like Spooktober.
      </>
    ),
  },
  work: {
    display: true,
    title: "Community events",
    experiences: [
      {
        company: "R6 5v5 Tournament",
        timeframe: "September 2026",
        role: "Host, with Notvash30",
        achievements: [
          <>Six captains drafted their teams live on the site in a snake draft.</>,
          <>Single-elimination playoffs with a live bracket. Team Alfie took the title.</>,
        ],
        images: [],
      },
      {
        company: "Spooktober",
        timeframe: "October 2026",
        role: "Stream event",
        achievements: [<>The Halloween event on stream, running all through October.</>],
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
    title: "What I play",
    skills: [
      {
        title: "Rainbow Six Siege",
        description: <>The main game on stream, and the game for the community tournaments.</>,
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
  description: "News about streams, tournaments and community events",
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
