"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Fade, Flex, Line, Row, ToggleButton, Text } from "@once-ui-system/core";

import { routes, about, blog, calendar } from "@/resources";
import styles from "./Header.module.scss";

/* The tournament, bracket and admin pages are plain HTML (in /public), not Next.js pages,
   so these buttons do a normal page load instead of a client-side route change. */
const go = (href: string) => () => window.location.assign(href);

type Me = { user: { login: string; name?: string; avatar?: string } | null; role: string };

/* Twitch login (right side): "Log in", or the user's picture with Admin / Log out. */
const Account = () => {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null, role: "viewer" }));
  }, []);
  if (!me) return null;
  const here = typeof window !== "undefined" ? window.location.pathname : "/";
  if (!me.user) {
    return (
      <ToggleButton
        prefixIcon="twitch"
        label="Log in"
        onClick={go(`/api/auth/login?scope=chat&next=${encodeURIComponent(here)}`)}
      />
    );
  }
  return (
    <Row gap="4" vertical="center">
      {me.role === "admin" && <ToggleButton prefixIcon="admin" label="Admin" onClick={go("/admin")} />}
      <ToggleButton onClick={go(`/api/auth/logout?next=${encodeURIComponent(here)}`)} aria-label="Log out">
        <Row gap="8" vertical="center">
          {me.user.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.user.avatar} alt="" width={20} height={20} style={{ borderRadius: "50%" }} />
          )}
          <Text variant="body-default-s">Log out</Text>
        </Row>
      </ToggleButton>
    </Row>
  );
};

/* Nav item that shows a label on wide screens and just the icon on phones. */
const NavItem = ({ icon, label, href, selected, page }: { icon: string; label: string; href: string; selected: boolean; page?: boolean }) => {
  const link = page ? { onClick: go(href) } : { href };
  return (
    <>
      <Row s={{ hide: true }}>
        <ToggleButton prefixIcon={icon} label={label} selected={selected} {...link} />
      </Row>
      <Row hide s={{ hide: false }}>
        <ToggleButton prefixIcon={icon} selected={selected} aria-label={label} {...link} />
      </Row>
    </>
  );
};

export const Header = () => {
  const pathname = usePathname() ?? "";

  return (
    <>
      <Fade s={{ hide: true }} fillWidth position="fixed" height="80" zIndex={9} />
      <Fade hide s={{ hide: false }} fillWidth position="fixed" bottom="0" to="top" height="80" zIndex={9} />
      <Row
        fitHeight
        className={styles.position}
        position="sticky"
        as="header"
        zIndex={9}
        fillWidth
        padding="8"
        horizontal="center"
        data-border="rounded"
        s={{ position: "fixed" }}
      >
        <Row paddingLeft="12" fillWidth vertical="center" s={{ hide: true }}>
          <a href="/" aria-label="AleksK9 home" style={{ display: "inline-flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/ak9-logo-nav.png" alt="AleksK9" height={40} style={{ height: 40, width: "auto" }} />
          </a>
        </Row>
        <Row fillWidth horizontal="center">
          <Row background="page" border="neutral-alpha-weak" radius="m-4" shadow="l" padding="4" horizontal="center" zIndex={1}>
            <Row gap="4" vertical="center" textVariant="body-default-s" suppressHydrationWarning>
              {routes["/"] && <ToggleButton prefixIcon="home" href="/" selected={pathname === "/"} aria-label="Home" />}
              <Line background="neutral-alpha-medium" vert maxHeight="24" />
              {routes["/about"] && <NavItem icon="person" label={about.label} href="/about" selected={pathname === "/about"} />}
              {routes["/blog"] && <NavItem icon="book" label={blog.label} href="/blog" selected={pathname.startsWith("/blog")} />}
              {routes["/calendar"] && <NavItem icon="calendar" label={calendar.label} href="/calendar" selected={pathname === "/calendar"} />}
              <Line background="neutral-alpha-medium" vert maxHeight="24" />
              <NavItem icon="trophy" label="Tournament" href="/tournament" selected={false} page />
              <NavItem icon="bracket" label="Bracket" href="/bracket" selected={false} page />
              <NavItem icon="game" label="Game" href="/game" selected={false} page />
            </Row>
          </Row>
        </Row>
        <Flex fillWidth horizontal="end" vertical="center" paddingRight="12" s={{ hide: true }}>
          <Account />
        </Flex>
      </Row>
    </>
  );
};
