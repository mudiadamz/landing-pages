import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getCustomJs } from "@/lib/actions/site-settings";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RouteProgress } from "@/components/route-progress";
import { CustomJsInjector } from "@/components/custom-js-injector";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ADM.UIUX — Landing Page & Digital Assets",
    template: "%s | ADM.UIUX",
  },
  description:
    "Landing page dan digital assets siap pakai. Template HTML gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun. Support 1 bulan.",
  keywords: [
    "landing page",
    "digital assets",
    "template HTML",
    "landing page template",
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
    title: "ADM.UIUX — Landing Page & Digital Assets",
    description:
      "Landing page dan digital assets siap pakai. Template HTML gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ADM.UIUX — Landing Page & Digital Assets",
    description:
      "Landing page dan digital assets siap pakai. Template HTML gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun.",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(!t){var m=document.cookie.match(/theme=([^;]+)/);if(m){t=m[1].trim();try{localStorage.setItem('theme',t);}catch(e){}}}t=t||'light';var dark=t==='dark';if(document.documentElement.classList.contains('dark')!==dark){document.documentElement.classList.toggle('dark',dark);}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
