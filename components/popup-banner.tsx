"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePopupEmail } from "@/lib/actions/site-settings";
import type { PopupBanner as PopupConfig } from "@/lib/popup-config";

/**
 * Popup banner over the product preview — a bottom sheet on mobile, a centred
 * card on desktop, opening on a dusk scene with rain and a glowing flower.
 *
 * Built around one rule: the preview must not get slower. It has been paid for
 * once already — a blank reader while a 3.42 MB EPUB parsed cost an entire ad
 * campaign — so:
 *
 *  - Nothing renders until it opens. No markup, no image, no animation is in
 *    the initial HTML.
 *  - The countdown starts on window `load`, not on mount. `load` waits for
 *    iframes, and the preview IS an iframe, so the timer begins when content is
 *    genuinely visible rather than over a spinner.
 *  - The scene is CSS and inline SVG, so the default costs zero requests. An
 *    uploaded WebP replaces it and is warmed 1.5s ahead, off the critical path.
 *  - No web fonts. The design's serif/sans contrast is met with Georgia — the
 *    face the reader already sets for prose — and the app's own sans. Importing
 *    Fraunces and Plus Jakarta Sans would have put two render-blocking font
 *    requests on the page this feature is forbidden to slow down.
 *
 * Timing default (8s) comes from this site's preview telemetry: the last point
 * that still reaches 100% of "curious" and "read" visitors while firing for
 * only ~21% of people already leaving.
 */

// Value pinned through the popup rename: it is already in visitors'
// localStorage, and changing it would re-open the banner for everyone who has
// dismissed it once.
const SEEN_KEY = "lp-promo-seen";
const WARM_LEAD_MS = 1500;
const RAINDROPS = 14;

type Phase = "form" | "done";

export function PopupBanner({ config, slug }: { config: PopupConfig; slug: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const closedRef = useRef(false);

  const show = useCallback(() => {
    if (closedRef.current) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      // Private mode — showing once per page load beats never showing.
    }
    setOpen(true);
  }, []);

  const remember = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const close = useCallback(() => {
    closedRef.current = true;
    remember();
    setOpen(false);
  }, [remember]);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* ignore */
    }

    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let warmTimer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      if (config.imageUrl) {
        warmTimer = setTimeout(
          () => {
            const img = new Image();
            img.decoding = "async";
            img.src = config.imageUrl;
          },
          Math.max(0, config.delayMs - WARM_LEAD_MS),
        );
      }
      delayTimer = setTimeout(show, config.delayMs);
    };

    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });

    const onExit = (e: MouseEvent) => {
      if (e.clientY <= 0) show();
    };
    if (config.exitIntent) document.addEventListener("mouseout", onExit);

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(warmTimer);
      window.removeEventListener("load", arm);
      document.removeEventListener("mouseout", onExit);
    };
  }, [config.delayMs, config.exitIntent, config.imageUrl, show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setBusy(true);
    // The address is stored server-side; a failure there should not rob the
    // reader of the acknowledgement they just earned, so the thank-you shows
    // either way and the error is logged rather than shouted at them.
    await subscribePopupEmail(v, slug).catch(() => undefined);
    setBusy(false);
    setPhase("done");
    remember();
    setTimeout(close, 2600);
  }

  if (!open) return null;

  return (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
      onClick={close}
    >
      <div className="popup-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="popup-x" onClick={close} aria-label="Tutup">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="popup-scene" aria-hidden>
          <span className="popup-grabber" />
          {config.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={config.imageUrl}
              alt=""
              width={config.width || undefined}
              height={config.height || undefined}
              decoding="async"
              className="popup-scene-img"
            />
          ) : (
            <>
              <div className="popup-rain">
                {Array.from({ length: RAINDROPS }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      left: `${(i * 37) % 100}%`,
                      animationDuration: `${0.7 + ((i * 13) % 9) / 10}s`,
                      animationDelay: `${((i * 29) % 15) / 10}s`,
                      opacity: 0.3 + ((i * 17) % 5) / 10,
                    }}
                  />
                ))}
              </div>
              <svg className="popup-flower" width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden>
                <g fill="#8FA6F2">
                  <ellipse cx="23" cy="11" rx="6.2" ry="9" />
                  <ellipse cx="23" cy="35" rx="6.2" ry="9" />
                  <ellipse cx="11" cy="23" rx="9" ry="6.2" />
                  <ellipse cx="35" cy="23" rx="9" ry="6.2" />
                  <ellipse cx="14.4" cy="14.4" rx="8" ry="5.4" transform="rotate(45 14.4 14.4)" />
                  <ellipse cx="31.6" cy="31.6" rx="8" ry="5.4" transform="rotate(45 31.6 31.6)" />
                  <ellipse cx="31.6" cy="14.4" rx="8" ry="5.4" transform="rotate(-45 31.6 14.4)" />
                  <ellipse cx="14.4" cy="31.6" rx="8" ry="5.4" transform="rotate(-45 14.4 31.6)" />
                </g>
                <circle cx="23" cy="23" r="5.5" fill="#FBF7F0" />
                <circle cx="23" cy="23" r="3" fill="#E8960C" />
              </svg>
            </>
          )}
        </div>

        <div className="popup-body">
          {phase === "done" ? (
            <div className="popup-done" aria-live="polite">
              <div className="popup-tick">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3>{config.doneTitle}</h3>
              <p>{config.doneBody}</p>
            </div>
          ) : (
            <>
              <p className="popup-eyebrow">{config.eyebrow}</p>
              <h2 className="popup-title" id="popup-title">
                {config.title}
              </h2>
              <p className="popup-text">{config.body}</p>

              {config.emailCapture ? (
                <form className="popup-form" onSubmit={submit} noValidate>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setInvalid(false);
                    }}
                    placeholder="email kamu"
                    aria-label="Alamat email"
                    autoComplete="email"
                    className={invalid ? "is-invalid" : undefined}
                  />
                  <button type="submit" disabled={busy}>
                    {busy ? "…" : config.ctaLabel}
                  </button>
                </form>
              ) : (
                config.href && (
                  <a
                    className="popup-cta"
                    href={config.href}
                    target={config.href.startsWith("/") ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    onClick={close}
                  >
                    {config.ctaLabel}
                  </a>
                )
              )}

              {config.instagramUrl && (
                <a className="popup-ig" href={config.instagramUrl} target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  {config.instagramLabel}
                </a>
              )}

              <button type="button" className="popup-dismiss" onClick={close}>
                {config.dismissLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .popup-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;
          justify-content:center;background:rgba(28,27,48,.42);
          backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
          animation:popupFade .35s ease both}
        .popup-sheet{position:relative;width:100%;max-width:480px;background:#FBF7F0;
          border-radius:26px 26px 0 0;overflow:hidden;box-shadow:0 -12px 44px rgba(28,27,48,.28);
          animation:popupRise .42s cubic-bezier(.22,1,.36,1) both;color:#2B2620}
        .popup-x{position:absolute;top:12px;right:12px;z-index:3;width:34px;height:34px;border:none;
          border-radius:50%;background:rgba(251,247,240,.9);color:#2B2620;cursor:pointer;
          display:grid;place-items:center;line-height:0;box-shadow:0 2px 8px rgba(0,0,0,.12)}
        .popup-x:hover{background:#fff}
        .popup-x svg{width:16px;height:16px}
        .popup-scene{position:relative;height:132px;overflow:hidden;
          background:linear-gradient(170deg,#2A2A48 0%,#4C4A73 62%,#6E5E86 100%)}
        .popup-scene-img{width:100%;height:100%;object-fit:cover;display:block}
        .popup-grabber{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:40px;
          height:4px;border-radius:99px;background:rgba(255,255,255,.4);z-index:2}
        .popup-rain{position:absolute;inset:0;z-index:1;opacity:.5}
        .popup-rain span{position:absolute;top:-20%;width:1px;height:38px;
          background:linear-gradient(rgba(255,255,255,0),rgba(201,199,224,.85));
          animation:popupFall linear infinite}
        @keyframes popupFall{to{transform:translateY(180px)}}
        .popup-flower{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);z-index:2;
          filter:drop-shadow(0 0 10px #AEBEF7) drop-shadow(0 0 22px rgba(143,166,242,.5));
          animation:popupBob 4.5s ease-in-out infinite}
        @keyframes popupBob{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,-58%)}}
        .popup-body{padding:22px 24px calc(24px + env(safe-area-inset-bottom))}
        .popup-eyebrow{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#E8960C;
          font-weight:600;margin:0 0 8px}
        .popup-title{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:25px;
          line-height:1.15;margin:0 0 10px;color:#2B2620}
        .popup-text{font-size:14.5px;line-height:1.6;color:#6E6659;margin:0 0 18px}
        .popup-form{display:flex;gap:8px;margin:0 0 12px}
        .popup-form input{flex:1;min-width:0;font:500 15px/1 inherit;color:#2B2620;background:#fff;
          border:1.5px solid #ECE4D6;border-radius:13px;padding:14px 15px;outline:none;
          transition:border-color .2s}
        .popup-form input::placeholder{color:#A79C8B}
        .popup-form input:focus,.popup-form input.is-invalid{border-color:#E8960C}
        .popup-form button,.popup-cta{flex:none;font:600 15px/1 inherit;color:#fff;cursor:pointer;
          background:#E8960C;border:none;border-radius:13px;padding:14px 18px;white-space:nowrap;
          transition:background .18s,transform .06s;text-decoration:none;display:inline-block}
        .popup-form button:hover,.popup-cta:hover{background:#C97F09}
        .popup-form button:active{transform:scale(.97)}
        .popup-form button:disabled{opacity:.6;cursor:default}
        .popup-cta{margin:0 0 12px}
        .popup-ig{display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:600;
          color:#4C4A73;text-decoration:none;padding:4px 0}
        .popup-ig:hover{color:#E8960C}
        .popup-ig svg{width:17px;height:17px}
        .popup-dismiss{display:block;width:100%;margin-top:6px;background:none;border:none;
          cursor:pointer;font:500 13.5px/1 inherit;color:#A79C8B;padding:10px}
        .popup-dismiss:hover{color:#6E6659}
        .popup-done{text-align:center;padding:8px 0 4px}
        .popup-tick{width:52px;height:52px;border-radius:50%;background:#FCEFD6;color:#E8960C;
          display:grid;place-items:center;margin:0 auto 14px}
        .popup-tick svg{width:26px;height:26px}
        .popup-done h3{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:21px;
          margin:0 0 6px;color:#2B2620}
        .popup-done p{font-size:14px;color:#6E6659;margin:0}
        @keyframes popupFade{from{opacity:0}to{opacity:1}}
        @keyframes popupRise{from{transform:translateY(102%)}to{transform:translateY(0)}}
        @media (min-width:600px){
          .popup-backdrop{align-items:center;padding:20px}
          .popup-sheet{border-radius:24px}
          .popup-grabber{display:none}
        }
        @media (prefers-reduced-motion:reduce){
          .popup-backdrop,.popup-sheet{animation:none}
          .popup-rain,.popup-flower{animation:none}
        }
      `}</style>
    </div>
  );
}
