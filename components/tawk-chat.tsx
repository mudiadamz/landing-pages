"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isTawkHidden } from "@/lib/tawk-visibility";

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
 * The ids come from this storefront's own tracking settings (/panel/tracking,
 * lib/tracking-config.ts) and arrive as props. They used to be hardcoded
 * Storefront values, which meant every niche domain on this one deployment opened
 * a support chat belonging to a different business — the same leak a shared
 * favicon or splash screen would be, and it is fixed the same way: per site.
 */

/** Set by the effect below; read by the inline script when the widget finishes loading. */
const HIDDEN_FLAG = "__tawkHidden";

type TawkApi = {
  hideWidget?: () => void;
  showWidget?: () => void;
};

/**
 * @param propertyId  Tawk property for THIS storefront; "" switches the chat off.
 * @param widgetId    Its widget id. Both or neither — see normalizeTracking.
 * @param fullscreenHome This storefront's homepage is a full-viewport app.
 *   A property of the SITE, not of the request — which is the point: the layout
 *   used to decide `{!fullscreenHome && <TawkChat/>}` from the x-pathname header,
 *   and a header is only read on a full document load.
 */
export function TawkChat({
  propertyId,
  widgetId,
  fullscreenHome = false,
}: {
  propertyId: string;
  widgetId: string;
  fullscreenHome?: boolean;
}) {
  const pathname = usePathname();
  const configured = !!propertyId && !!widgetId;
  const hidden = isTawkHidden(pathname, fullscreenHome);

  /**
   * Unmounting does NOT remove the widget.
   *
   * This component rendering `null` only stops the script being INJECTED. Once it
   * has run — on the homepage, say — Tawk owns an iframe on <body> that React
   * never created and will never clean up, so client-side navigating into /panel
   * left the bubble floating over the admin UI. Reloading looked fine, which is
   * exactly what made it look like it was already handled.
   *
   * So the visibility is driven here instead, through Tawk's own API, on every
   * route change.
   */
  useEffect(() => {
    if (!configured) return;
    const w = window as unknown as Record<string, unknown>;
    w[HIDDEN_FLAG] = hidden;
    const api = w.Tawk_API as TawkApi | undefined;
    // No API yet means the script is still loading (or never loaded on this page).
    // The flag above is what the inline `onLoad` reads, so a widget that finishes
    // loading after we've already navigated away comes up hidden rather than
    // flashing onto the panel.
    if (!api) return;
    try {
      if (hidden) api.hideWidget?.();
      else api.showWidget?.();
    } catch {
      /* API present but not ready — onLoad will apply the flag. */
    }
  }, [hidden, configured]);

  // Not rendered on a hidden route: a visitor who lands straight on /panel should
  // never pay for the script at all. The effect above covers the other direction.
  if (!configured || hidden) return null;

  return (
    <Script id="tawk-to" strategy="afterInteractive">
      {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();
// Shrink only the minimized launcher bubble. Tawk sizes are set in its dashboard
// and the widget lives in a cross-origin iframe, so we scale the (same-origin)
// launcher iframe element itself. The size guard (< 220px) keeps the open chat
// window and the mobile full-screen view untouched.
function tawkShrink(){try{document.querySelectorAll('iframe[title="chat widget"]').forEach(function(f){var r=f.getBoundingClientRect();if(r.width&&r.width<220&&r.height<220){f.style.transformOrigin='100% 100%';f.style.transform='scale(0.72)';}});}catch(e){}}
// The route may have changed while the widget was loading. window.${HIDDEN_FLAG}
// is the React effect's answer to "should it be on screen right now".
Tawk_API.onLoad=function(){if(window.${HIDDEN_FLAG}){try{Tawk_API.hideWidget();}catch(e){}return;}tawkShrink();setTimeout(tawkShrink,500);setTimeout(tawkShrink,1500);};
Tawk_API.onChatMinimized=function(){setTimeout(tawkShrink,50);};
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/${propertyId}/${widgetId}';
s1.charset='UTF-8';
s0.parentNode.insertBefore(s1,s0);
})();`}
    </Script>
  );
}
