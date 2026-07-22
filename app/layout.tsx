import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getCustomJs } from "@/lib/actions/site-settings";
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

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://admuiux.com").replace(/\/$/, "");

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ADM.UIUX",
  url: SITE_URL,
  logo: `${SITE_URL}/logo-adm-100.jpg`,
  email: "admin@admuiux.com",
  founder: { "@type": "Person", name: "Adam Mudianto" },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ADM.UIUX — Produk Digital Siap Pakai",
    template: "%s | ADM.UIUX",
  },
  description:
    "Produk digital siap pakai — template, landing page, dan aset digital. Gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun. Support 1 bulan.",
  keywords: [
    "produk digital",
    "aset digital",
    "digital assets",
    "landing page",
    "template HTML",
    "HTML template",
    "Adam Mudianto",
    "ADM.UIUX",
  ],
  authors: [{ name: "Adam Mudianto", url: SITE_URL }],
  creator: "Adam Mudianto",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "ADM.UIUX",
    title: "ADM.UIUX — Produk Digital Siap Pakai",
    description:
      "Produk digital siap pakai — template, landing page, dan aset digital. Gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ADM.UIUX — Produk Digital Siap Pakai",
    description:
      "Produk digital siap pakai — template, landing page, dan aset digital. Gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme");
  const isDark = themeCookie?.value === "dark";
  const customJs = await getCustomJs();

  return (
    <html lang="id" suppressHydrationWarning className={isDark ? "dark" : undefined}>
      <head>
        {/* Tints the iOS Safari toolbar to match the theme (kept in sync by the
            inline script below and lib/use-theme on toggle) so the browser chrome
            doesn't stay light behind a dark page — e.g. on the /lp preview. */}
        <meta name="theme-color" content={isDark ? "#0d0d0f" : "#fdfcfb"} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(!t){var m=document.cookie.match(/theme=([^;]+)/);if(m){t=m[1].trim();try{localStorage.setItem('theme',t);}catch(e){}}}t=t||'light';var dark=t==='dark';if(document.documentElement.classList.contains('dark')!==dark){document.documentElement.classList.toggle('dark',dark);}var mc=document.querySelector('meta[name="theme-color"]');if(mc){mc.setAttribute('content',dark?'#0d0d0f':'#fdfcfb');}})()`,
          }}
        />
      </head>
      <body
        className={`${aumanDisplay.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <JsonLd data={organizationJsonLd} />
        <MarketingScripts />
        <TawkChat />
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
        <Analytics />
        <SpeedInsights />
        {customJs ? <CustomJsInjector script={customJs} /> : null}
      </body>
    </html>
  );
}
