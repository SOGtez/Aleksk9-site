"use client";

import { usePathname } from "next/navigation";
import { routes } from "@/resources";
import NotFound from "@/app/not-found";

/* Shows "not found" for pages that are switched off in once-ui.config.ts (Work, Gallery).
   The template's password protection is not used here. */
const RouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() ?? "/";
  const enabled =
    pathname in routes
      ? routes[pathname as keyof typeof routes]
      : pathname.startsWith("/blog") && routes["/blog"];
  return <>{enabled ? children : <NotFound />}</>;
};

export { RouteGuard };
