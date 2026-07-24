"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/use-theme";
import { trackCta, type TrackPage } from "@/lib/track";
import { signInWithGoogle, signOut } from "@/lib/actions/auth";
import { toggleLike } from "@/lib/actions/likes";
import { readEpubFont, setEpubFont, type EpubFontLevel } from "@/lib/epub-font";

/** Minimal shape of the (non-standard but widely supported) install prompt event. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  /** Product title, used as the share text / event summary. */
  title: string;
  /** Public view count (as of page load). */
  viewCount: number;
  /** "floating" = fixed pill (preview page); "inline" = normal button (checkout). */
  variant?: "floating" | "inline";
  /** When set, a "Back" item is shown that navigates here. */
  backHref?: string | null;
  backLabel?: string;
  /** Product slug + surface for analytics (share / add-to-home / bookmark). */
  slug?: string;
  page?: TrackPage;
  /** When false, a "Masuk dengan Google" item is shown (returns to this page). */
  isLoggedIn?: boolean;
  /** Display name of the signed-in user, shown at the top of the menu. */
  userName?: string | null;
  /** Product id + initial like state for the in-menu like toggle. */
  pageId?: string;
  liked?: boolean;
  likeCount?: number;
  /** When true (EPUB preview), the menu shows an EPUB font-size control. */
  epub?: boolean;
};

/**
 * Single grouped actions menu shown on the preview and checkout pages: back,
 * theme toggle, add-to-home-screen, view count, save (browser bookmark) and
 * share (WhatsApp / Threads / X / native). Replaces the separate back + theme
 * pills that used to float over the preview.
 */
export function ProductActionsMenu({
  title,
  viewCount,
  variant = "inline",
  backHref,
  backLabel = "Kembali",
  slug,
  page = "checkout",
  isLoggedIn,
  userName,
  pageId,
  liked: likedInitial = false,
  likeCount: likeCountInitial = 0,
  epub = false,
}: Props) {
  const router = useRouter();
  const { dark, toggle } = useTheme();

  // EPUB font size — the control the reader is driven by. Lazy init from
  // localStorage is SSR-safe (readEpubFont guards); the font rows only render
  // once the menu is opened, so there's no hydration mismatch.
  const [fontLevel, setFontLevel] = useState<EpubFontLevel>(readEpubFont);
  const onFont = useCallback((level: EpubFontLevel) => {
    setFontLevel(level);
    setEpubFont(level);
  }, []);
  const logCta = useCallback(
    (action: string) => {
      if (slug) trackCta(slug, page, action);
    },
    [slug, page],
  );

  const nextPath = page === "checkout" ? `/checkout/${slug}` : `/lp/${slug}`;

  // In-menu like toggle (login-gated; optimistic). Count doubles as the total.
  const [liked, setLiked] = useState(likedInitial);
  const [likeCount, setLikeCount] = useState(likeCountInitial);
  const [likePending, setLikePending] = useState(false);

  const onToggleLike = useCallback(async () => {
    if (likePending || !pageId) return;
    setLikePending(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    logCta(next ? "like" : "unlike");
    try {
      const res = await toggleLike(pageId);
      if (res.ok) {
        setLiked(res.liked);
        setLikeCount(res.count);
      } else {
        setLiked(!next);
        setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setLikePending(false);
    }
  }, [likePending, pageId, liked, logCta]);

  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [iosHelp, setIosHelp] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add-to-home-screen state. isIOS / standalone are read once from the browser
  // via lazy initializers (false during SSR) — they only affect menu content
  // that renders after the menu is opened, so there's no hydration mismatch.
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return (
      /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS 13+ reports as Mac but is touch-capable.
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  });
  const [standalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  });

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => {
      deferredPrompt.current = null;
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const showHint = useCallback((text: string) => {
    setHint(text);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 3200);
  }, []);

  const shareUrl = () => (typeof window !== "undefined" ? window.location.href : "");

  const addToHome = useCallback(async () => {
    setOpen(false);
    logCta("add_to_home");
    if (deferredPrompt.current) {
      const ev = deferredPrompt.current;
      await ev.prompt();
      await ev.userChoice.catch(() => undefined);
      deferredPrompt.current = null;
      return;
    }
    // No install API available (iOS always; some desktop states) → instructions.
    setIosHelp(true);
  }, [logCta]);

  const nativeShare = useCallback(async () => {
    setOpen(false);
    logCta("share_native");
    const url = shareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showHint("Link disalin ke clipboard");
    } catch {
      showHint(url);
    }
  }, [title, showHint, logCta]);

  const shareTo = useCallback(
    (target: "wa" | "threads" | "x") => {
      setOpen(false);
      logCta(`share_${target}`);
      const url = shareUrl();
      const text = `${title} — ${url}`;
      const map: Record<typeof target, string> = {
        wa: `https://wa.me/?text=${encodeURIComponent(text)}`,
        threads: `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`,
        x: `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      };
      window.open(map[target], "_blank", "noopener,noreferrer");
    },
    [title, logCta],
  );

  const views = new Intl.NumberFormat("id-ID").format(Math.max(0, viewCount || 0));

  const menu = (
    <div
      role="menu"
      className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl"
    >
      {/* Top row: back (icon only, far left) + signed-in profile (inline, opens
          the panel) + logout on the right. */}
      {(backHref || (isLoggedIn && userName)) && (
        <>
          <div className="flex items-center gap-1 px-1.5 py-1.5">
            {backHref && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(backHref);
                }}
                aria-label={backLabel}
                title={backLabel}
                className="-ml-0.5 flex h-7 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-all duration-150 hover:-translate-x-0.5 hover:bg-[var(--background)] hover:text-foreground active:scale-90"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
            )}
            {isLoggedIn && userName && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/panel");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-all duration-150 hover:bg-[var(--background)] active:scale-[0.98]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-semibold text-[var(--primary)]">
                    {userName.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{userName}</span>
                    <span className="block text-[11px] text-[var(--muted)]">Masuk</span>
                  </span>
                </button>
                <form action={signOut} className="shrink-0">
                  <button
                    type="submit"
                    onClick={() => logCta("logout")}
                    aria-label="Logout"
                    title="Logout"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-all duration-150 hover:bg-[var(--background)] hover:text-foreground active:scale-90"
                  >
                    <LogoutIcon className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}
          </div>
          <div className="my-1 h-px bg-[var(--border)]" />
        </>
      )}

      {/* Google sign-in — only when logged out; returns to this page after auth. */}
      {isLoggedIn === false && slug && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={nextPath} />
            <button
              type="submit"
              role="menuitem"
              // NB: do not setOpen(false) here — closing the menu unmounts this
              // form before the server action dispatches, killing the sign-in.
              onClick={() => logCta("login_google")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-all duration-150 hover:bg-[var(--background)] active:scale-[0.98]"
            >
              <GoogleIcon className="h-4 w-4" />
              Masuk dengan Google
            </button>
          </form>
          <div className="my-1 h-px bg-[var(--border)]" />
        </>
      )}

      {/* View count — informational row */}
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)]">
        <EyeIcon className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">{views}</span> kali dilihat
        </span>
      </div>

      {/* Like — toggles when signed in, else starts Google sign-in. Shows total. */}
      {pageId &&
        (isLoggedIn ? (
          <button
            type="button"
            role="menuitem"
            onClick={onToggleLike}
            disabled={likePending}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-all duration-150 hover:bg-[var(--background)] active:scale-[0.98] disabled:opacity-60"
          >
            <HeartIcon
              filled={liked}
              className={`h-4 w-4 shrink-0 transition-transform duration-150 ${liked ? "scale-110 text-red-500" : "text-[var(--muted)]"}`}
            />
            {liked ? "Disukai" : "Suka"} · {new Intl.NumberFormat("id-ID").format(likeCount)}
          </button>
        ) : (
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={nextPath} />
            <button
              type="submit"
              role="menuitem"
              onClick={() => logCta("like")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-all duration-150 hover:bg-[var(--background)] active:scale-[0.98]"
            >
              <HeartIcon filled={false} className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              Suka · {new Intl.NumberFormat("id-ID").format(likeCount)}
            </button>
          </form>
        ))}

      <div className="my-1 h-px bg-[var(--border)]" />

      <MenuButton
        onClick={toggle}
        icon={dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        label={dark ? "Mode terang" : "Mode gelap"}
      />

      {/* EPUB font size — only for EPUB previews. */}
      {epub && (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <TextSizeIcon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <div className="flex flex-1 items-center gap-1">
            {FONT_LEVELS.map((f) => {
              const active = f.level === fontLevel;
              return (
                <button
                  key={f.level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  title={`Font ${f.label}`}
                  aria-label={`Ukuran font ${f.label}`}
                  onClick={() => onFont(f.level)}
                  className={`flex flex-1 items-center justify-center rounded-md py-1 font-semibold leading-none transition-all duration-150 active:scale-95 ${f.cls} ${
                    active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
                  }`}
                >
                  A
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!standalone && (
        <MenuButton
          onClick={addToHome}
          icon={<HomePlusIcon className="h-4 w-4" />}
          label="Pasang aplikasi (layar utama)"
        />
      )}
      <div className="my-1 h-px bg-[var(--border)]" />

      <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        Bagikan
      </p>
      <MenuButton onClick={() => shareTo("wa")} icon={<WhatsAppIcon className="h-4 w-4" />} label="WhatsApp" />
      <MenuButton onClick={() => shareTo("threads")} icon={<ThreadsIcon className="h-4 w-4" />} label="Threads" />
      <MenuButton onClick={() => shareTo("x")} icon={<XIcon className="h-4 w-4" />} label="X" />
      <MenuButton onClick={nativeShare} icon={<ShareIcon className="h-4 w-4" />} label="Bagikan lainnya…" />
    </div>
  );

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Menu tindakan"
      title="Menu tindakan"
      className={
        variant === "floating"
          ? "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:text-foreground active:scale-95"
          : "flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-foreground transition-all hover:bg-[var(--background)] active:scale-95"
      }
    >
      {open ? (
        <CloseIcon className={variant === "floating" ? "h-4 w-4" : "h-5 w-5"} />
      ) : (
        <DotsIcon className={variant === "floating" ? "h-4 w-4" : "h-5 w-5"} />
      )}
    </button>
  );

  const body = (
    <div ref={rootRef} className="relative">
      {variant === "floating" ? (
        // Fully transparent wrapper — just the dots icon floats over the preview.
        <div className="flex items-center bg-transparent p-1">{trigger}</div>
      ) : (
        trigger
      )}
      {open && menu}
      {hint && (
        <div className="absolute right-0 top-full z-10 mt-2 w-max max-w-[80vw] rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-[var(--background)] shadow-lg">
          {hint}
        </div>
      )}
    </div>
  );

  return (
    <>
      {variant === "floating" ? (
        <div className="fixed right-4 top-4 z-50">{body}</div>
      ) : (
        body
      )}

      {/* Instructions sheet for platforms with no install API (iOS, some desktop). */}
      {iosHelp && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <HomePlusIcon className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="text-sm font-semibold text-foreground">Pasang aplikasi ke layar utama</h3>
            </div>
            {isIOS ? (
              <ol className="space-y-2 text-sm text-[var(--muted)]">
                <li>
                  1. Ketuk tombol <strong className="text-foreground">Bagikan</strong> di Safari
                  (ikon kotak dengan panah ke atas).
                </li>
                <li>
                  2. Pilih <strong className="text-foreground">Tambahkan ke Layar Utama</strong>.
                </li>
                <li>
                  3. Ketuk <strong className="text-foreground">Tambah</strong>.
                </li>
              </ol>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Buka menu browser Anda lalu pilih{" "}
                <strong className="text-foreground">Install</strong> atau{" "}
                <strong className="text-foreground">Add to Home screen</strong>. Jika tidak ada,
                halaman ini sudah terpasang atau browser Anda belum mendukungnya.
              </p>
            )}
            <button
              type="button"
              onClick={() => setIosHelp(false)}
              className="mt-4 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

const FONT_LEVELS: { level: EpubFontLevel; label: string; cls: string }[] = [
  { level: "small", label: "Kecil", cls: "text-[11px]" },
  { level: "medium", label: "Sedang", cls: "text-sm" },
  { level: "large", label: "Besar", cls: "text-lg" },
];

function MenuButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-all duration-150 hover:bg-[var(--background)] active:scale-[0.98]"
    >
      <span className="shrink-0 text-[var(--muted)] transition-transform duration-150 group-hover:scale-110 group-active:scale-95">
        {icon}
      </span>
      {label}
    </button>
  );
}

/* --------------------------------- Icons ---------------------------------- */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}
function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function HomePlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m6 0h3a1 1 0 001-1V10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-6m-3 3h6" />
    </svg>
  );
}
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TextSizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5h10v2M9 5v14m-2 0h4M15 13v-1h6v1m-3-1v7m-1 0h2" />
    </svg>
  );
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.18-1.14l-.3-.18-3.11.82.83-3.04-.2-.31a8.23 8.23 0 01-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.55-3.7 8.25-8.24 8.25zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01a.92.92 0 00-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}
function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12.19 22h-.02c-2.7-.02-4.78-.92-6.17-2.68C4.76 17.76 4.13 15.48 4.1 12.6v-.02c.03-2.88.66-5.16 1.9-6.72C7.4 4.09 9.48 3.19 12.17 3.17h.02c2.07.01 3.8.55 5.15 1.6 1.27.99 2.16 2.4 2.66 4.2l-1.86.52c-.82-2.94-2.9-4.44-5.96-4.46-2.02.02-3.55.66-4.55 1.92-.94 1.18-1.42 2.88-1.45 5.05.03 2.17.51 3.87 1.45 5.05 1 1.26 2.53 1.9 4.55 1.92 1.82-.01 3.03-.44 4.03-1.43.99-.98 1.14-2.18 1.14-2.94 0-.05 0-.11-.01-.16-.32.17-.7.3-1.15.4-.94.19-2 .21-2.98.06-1.4-.22-2.51-.83-3.13-1.72-.6-.87-.7-1.98-.28-3.05.45-1.15 1.6-1.94 3.09-2.11 1.09-.13 2.09.02 2.94.42.14.06.27.14.4.21-.02-.53-.1-.98-.24-1.34-.28-.71-.85-1.13-1.74-1.29a4.7 4.7 0 00-.85-.07c-1.06 0-1.9.34-2.5 1.01l-1.4-1.25c.95-1.06 2.3-1.6 3.9-1.6.42 0 .84.04 1.24.11 1.6.29 2.74 1.2 3.29 2.63.45 1.16.5 2.66.51 3.86v.24c0 .04 0 .08.01.12.94.6 1.63 1.42 2 2.4l-1.79.68c-.24-.63-.66-1.16-1.24-1.58-.06.9-.36 2.24-1.47 3.34-1.36 1.35-3.06 1.98-5.35 2z" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
