"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Tawk.to live chat loader.
 *
 * Why this exists: Tawk's copy-paste snippet sets `s1.setAttribute('crossorigin','*')`.
 * That invalid value puts the script fetch in CORS mode, and the embed CDN doesn't
 * return an Access-Control-Allow-Origin header for it — so the browser blocks it
 * ("No 'Access-Control-Allow-Origin' header is present"). Loading the same script
 * WITHOUT the crossorigin attribute fetches it in normal (no-cors) mode and runs
 * fine. Keep this out of the custom-JS panel to avoid the broken loader.
 *
 * The property/widget IDs are public (visible in every visitor's browser), so a
 * hardcoded default is safe; override per environment if needed.
 */
const PROPERTY_ID =
  process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || "69b470e17afc871c37be198a";
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || "1jjkdht1t";

export function TawkChat() {
  const pathname = usePathname();
  if (!PROPERTY_ID || !WIDGET_ID || pathname?.startsWith("/panel")) return null;

  return (
    <Script id="tawk-to" strategy="afterInteractive">
      {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}';
s1.charset='UTF-8';
s0.parentNode.insertBefore(s1,s0);
})();`}
    </Script>
  );
}
