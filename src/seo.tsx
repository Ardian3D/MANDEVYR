import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://www.mandevyr.my.id";
const pages = {
  home: {
    path: "/",
    title: "MANDEVYR | Explore Morpho Vaults on Arc",
    description: "MANDEVYR is an Arc decision workspace. Explore curated Morpho vaults with live onchain source checks, an optional wallet view, and a personal watchlist.",
    robots: "index,follow,max-image-preview:large",
  },
  docs: {
    path: "/docs",
    title: "MANDEVYR Docs | Arc Vault Research & Product Roadmap",
    description: "Read how MANDEVYR checks Arc vault sources, what the read-only workspace can do today, its trust boundaries, and the product roadmap.",
    robots: "index,follow,max-image-preview:large",
  },
  app: {
    path: "/app",
    title: "Explore Arc Vaults | MANDEVYR",
    description: "Explore curated Morpho vaults on Arc with live onchain source checks and a personal watchlist in MANDEVYR.",
    robots: "noindex,follow",
  },
  actions: {
    path: "/app/actions",
    title: "Morpho Vault Actions on Arc | MANDEVYR",
    description: "Review deposits and withdrawals for curated Morpho Vault V2 vaults on Arc Mainnet with wallet confirmation and contract checks.",
    robots: "noindex,follow",
  },
} as const;

function meta(selector: string, value: string) {
  const node = document.querySelector<HTMLMetaElement>(selector);
  node?.setAttribute("content", value);
}

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = pathname === "/docs" ? pages.docs : pathname === "/app/actions" ? pages.actions : pathname.startsWith("/app") ? pages.app : pages.home;
    const url = `${ORIGIN}${page.path}`;
    document.title = page.title;
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", url);
    meta('meta[name="description"]', page.description);
    meta('meta[name="robots"]', page.robots);
    meta('meta[property="og:title"]', page.title);
    meta('meta[property="og:description"]', page.description);
    meta('meta[property="og:url"]', url);
    meta('meta[name="twitter:title"]', page.title);
    meta('meta[name="twitter:description"]', page.description);
  }, [pathname]);

  return null;
}
