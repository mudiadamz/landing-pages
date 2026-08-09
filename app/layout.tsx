import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { getCustomJs, getTracking } from "@/lib/actions/site-settings";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RouteProgress } from "@/components/route-progress";
import { CustomJsInjector } from "@/components/custom-js-injector";
import { JsonLd } from "@/components/json-ld";
import { MarketingScripts } from "@/components/marketing-scripts";
import { TawkChat } from "@/components/tawk-chat";
import { PwaRegister } from "@/components/pwa-register";
import { SessionTracker } from "@/components/session-tracker";
import { GtmScripts } from "@/components/gtm-scripts";
import { IOS_SPLASH_TARGETS, splashFile, splashMedia } from "@/lib/ios-splash";
import { currentOrigin, currentSite, type Site } from "@/lib/site-resolve";
import { resolveTemplate } from "@/lib/templates/registry";
import { getSiteContent } from "@/lib/actions/site-settings";
import { paletteCss, paletteFromKey, surfaceCss } from "@/lib/palette";
import { DEFAULT_APPLE_ICON, DEFAULT_ICON } from "@/lib/site-brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


// AumanDisplay: local display face (Regular only). Set as the primary site
// font; Geist stays in the CSS fallback stack for the few glyphs it lacks
// ($, brackets, accents) and to cover heavier weights via faux-bold.
const aumanDisplay = localFont({
  src: "./fonts/AumanDisplay-Regular.woff",
  variable: "--font-auman",
  display: "swap",
  weight: "400",
});

const DEFAULT_DESCRIPTION =
  "Produk digital siap pakai — template, landing page, dan aset digital. Gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun. Support 1 bulan.";

/**
 * Per-domain, because one deployment serves several niche storefronts: the brand
 * name, tagline and metadataBase all follow the host the visitor arrived on.
 * A static `metadata` export can't do that — it is evaluated without a request —
 * so this is generateMetadata even though most of it is constant.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [site, origin] = await Promise.all([currentSite(), currentOrigin()]);
  const name = site.name || "ADM.UIUX";
  const title = site.tagline ? `${name} — ${site.tagline}` : name;
  // The site's own snippet, never one synthesised from the tagline: a tagline is a
  // headline and makes a uselessly short search result.
  const description = site.description?.trim() || DEFAULT_DESCRIPTION;

  return {
    metadataBase: new URL(origin),
    title: { default: title, template: `%s | ${name}` },
    description,
    keywords: [
      "produk digital",
      "aset digital",
      "digital assets",
      "landing page",
      "template HTML",
      "HTML template",
      "Adam Mudianto",
      name,
    ],
    authors: [{ name: "Adam Mudianto", url: origin }],
    creator: "Adam Mudianto",
    openGraph: {
      type: "website",
      locale: "id_ID",
      siteName: name,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
    icons: siteIcons(site),
  };
}

/**
 * The browser-tab and home-screen icon, per storefront.
 *
 * Declared here rather than by file convention — and app/icon.svg + app/favicon.ico
 * were MOVED to public/ to make that possible. Those filenames are a build-time
 * convention: Next emits their link tags for every response, and a build-time
 * asset cannot vary by host, so a niche domain would have worn the ADM.UIUX mark
 * in its tab no matter what this function returned. In public/ they are ordinary
 * static files, referenced below as the fallback and still served at /favicon.ico
 * for browsers that ask for it without being told to.
 */
function siteIcons(site: Site): Metadata["icons"] {
  if (site.icon_url) {
    // One entry, not the site's plus the default: two <link rel="icon"> tags let the
    // browser choose, and it sometimes chooses the wrong one.
    return { icon: site.icon_url, shortcut: site.icon_url, apple: site.icon_url };
  }
  return {
    icon: DEFAULT_ICON,
    shortcut: "/favicon.ico",
    apple: DEFAULT_APPLE_ICON,
  };
}

/**
 * Tag-manager + custom JS, both of which need a settings lookup. Kept out of the
 * layout body so a database round trip can't delay the document's first byte.
 */
async function DeferredScripts() {
  const [customJs, tracking] = await Promise.all([getCustomJs(), getTracking()]);
  return (
    <>
      <GtmScripts gtmId={tracking.gtmId} />
      {customJs ? <CustomJsInjector script={customJs} /> : null}
    </>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Only the theme cookie is read inline — it's local to the request, so the
  // document can start streaming straight away. The marketing/custom scripts
  // need database round trips, so they stream in behind a Suspense boundary
  // rather than holding up the first byte of every page.
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme");
  // Which storefront: drives the JSON-LD org name and the iOS home-screen title.
  const [site, origin] = await Promise.all([currentSite(), currentOrigin()]);
  // Some templates ship light only. The theme cookie is shared across storefronts
  // (one browser, one cookie), so without this a visitor who turned dark on
  // another domain would arrive here to a half-dark page with no way back.
  const template = resolveTemplate(site.template);
  const lightOnly = !!template.lightOnly;

  // The homepage may tint the browser toolbar to match its cover. Read only for
  // "/" — every other route would pay for a lookup it never uses, and the header
  // comes from middleware (see app/panel/layout.tsx, which reads the same one).
  const pathname = (await headers()).get("x-pathname") ?? "";
  const coverTheme =
    pathname === "/" ? (await getSiteContent()).founder.coverThemeColor : "";
  const isDark = themeCookie?.value === "dark" && !lightOnly;

  return (
    <html lang="id" suppressHydrationWarning className={isDark ? "dark" : undefined}>
      <head>
        {/* Tints the iOS Safari toolbar to match the theme (kept in sync by the
            inline script below and lib/use-theme on toggle) so the browser chrome
            doesn't stay light behind a dark page — e.g. on the /lp preview. */}
        {/* A cover colour wins over the page colour, and is marked so the script
            below leaves it alone — otherwise the toolbar would blend for one
            frame and then snap back to the page background. */}
        <meta
          name="theme-color"
          content={coverTheme || (isDark ? "#0d0d0f" : "#fdfcfb")}
          {...(coverTheme ? { "data-locked": "true" } : {})}
        />
        {/* Add-to-home-screen support: manifest (auto-linked by app/manifest.ts)
            drives Chrome/Android/desktop installs; these tags cover iOS Safari,
            which has no install API and uses the apple-touch-icon + Share sheet.
            The apple-touch-icon link itself is emitted by generateMetadata, which
            is where it has to live to follow the storefront's own icon. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={site.name || "ADM.UIUX"} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Launch images for an iOS home-screen install. iOS ignores the web
            manifest here, so without an exactly-matching startup image it shows
            a blank white screen while the app boots. */}
        {IOS_SPLASH_TARGETS.map((t) =>
          (["light", "dark"] as const).map((scheme) => (
            <link
              key={`${t.w}x${t.h}@${t.r}-${scheme}`}
              rel="apple-touch-startup-image"
              media={splashMedia(t, scheme)}
              href={splashFile(t, scheme)}
            />
          )),
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var lightOnly=${lightOnly ? "true" : "false"};var t=localStorage.getItem('theme');if(!t){var m=document.cookie.match(/theme=([^;]+)/);if(m){t=m[1].trim();try{localStorage.setItem('theme',t);}catch(e){}}}t=t||'light';var dark=!lightOnly&&t==='dark';if(document.documentElement.classList.contains('dark')!==dark){document.documentElement.classList.toggle('dark',dark);}var mc=document.querySelector('meta[name="theme-color"]');if(mc&&!mc.hasAttribute('data-locked')){mc.setAttribute('content',dark?'#0d0d0f':'#fdfcfb');}})()`,
          }}
        />
      </head>
      <body
        className={`${aumanDisplay.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Per-storefront palette. In the BODY to match app/panel/layout.tsx, which
            puts the panel palette here so it lands after Next's hoisted stylesheet
            and so portalled dialogs still get the tokens. The panel's own <style>
            renders inside this one, so it still wins on panel routes.

            Overrides only the four mood tokens; backgrounds, text and borders stay
            fixed, which is where the contrast lives. */}
        <style
          id="site-palette"
          dangerouslySetInnerHTML={{
            __html:
              paletteCss(paletteFromKey(site.palette)) +
              // The template's own page/card colours, after the palette so they
              // win. The panel re-asserts its own inside this one.
              (template.surfaces ? surfaceCss(template.surfaces) : ""),
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: site.name || "ADM.UIUX",
            url: origin,
            // Absolute, as schema.org requires. A site's own upload is already an
            // absolute Supabase URL; the fallback needs the origin prefixed.
            logo: site.logo_url || site.icon_url || `${origin}/logo-adm-100.jpg`,
            email: "admin@admuiux.com",
            founder: { "@type": "Person", name: "Adam Mudianto" },
          }}
        />
        <Suspense fallback={null}>
          <DeferredScripts />
        </Suspense>
        <MarketingScripts />
        <TawkChat />
        <PwaRegister />
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <SessionTracker />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
