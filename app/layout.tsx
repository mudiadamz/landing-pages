import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RouteProgress } from "@/components/route-progress";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark')})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RouteProgress />
        {children}
      </body>
    </html>
  );
}
