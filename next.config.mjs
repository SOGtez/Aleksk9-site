import mdx from "@next/mdx";

const withMDX = mdx({
  extension: /\.mdx?$/,
  options: {},
});

/* The tournament, bracket, admin and overlay pages are plain HTML in /public. These rewrites keep their
   old addresses (aleksk9.com/tournament, /bracket, …) working exactly as before. */
const STATIC_PAGES = ["tournament", "bracket", "admin", "apply", "overlay", "spooktober", "how-to-draft"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* "js" is for the API routes in src/pages/api (Twitch login, tournament, bracket, screenshots…). */
  pageExtensions: ["ts", "tsx", "js", "md", "mdx"],
  transpilePackages: ["next-mdx-remote"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com", pathname: "**" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net", pathname: "**" },
    ],
  },
  sassOptions: {
    compiler: "modern",
    silenceDeprecations: ["legacy-js-api"],
  },
  async rewrites() {
    return [
      ...STATIC_PAGES.map((p) => ({ source: `/${p}`, destination: `/${p}.html` })),
      /* Test (sandbox) versions: same page, it reads the path to know it is in test mode. */
      { source: "/tournament-test", destination: "/tournament.html" },
      { source: "/bracket-test", destination: "/bracket.html" },
    ];
  },
};

export default withMDX(nextConfig);
