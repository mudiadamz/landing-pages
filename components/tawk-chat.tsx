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
  // Hide on the admin panel and on preview pages (/preview/[slug]) — the preview is a
  // full-bleed demo where the chat bubble would overlap the content and CTA.
  if (
    !PROPERTY_ID ||
    !WIDGET_ID ||
    pathname?.startsWith("/panel") ||
    pathname?.startsWith("/lp")
  )
    return null;

  return (
    <Script id="tawk-to" strategy="afterInteractive">
      {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();
// Shrink only the minimized launcher bubble. Tawk sizes are set in its dashboard
// and the widget lives in a cross-origin iframe, so we scale the (same-origin)
// launcher iframe element itself. The size guard (< 220px) keeps the open chat
// window and the mobile full-screen view untouched.
function tawkShrink(){try{document.querySelectorAll('iframe[title="chat widget"]').forEach(function(f){var r=f.getBoundingClientRect();if(r.width&&r.width<220&&r.height<220){f.style.transformOrigin='100% 100%';f.style.transform='scale(0.72)';}});}catch(e){}}
Tawk_API.onLoad=function(){tawkShrink();setTimeout(tawkShrink,500);setTimeout(tawkShrink,1500);};
Tawk_API.onChatMinimized=function(){setTimeout(tawkShrink,50);};
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
