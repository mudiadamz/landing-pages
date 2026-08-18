"use client";

/**
 * Everything about this chat that is not the conversation.
 *
 * Four things, one tab each: who they are signed in as, how the page looks and
 * speaks, the standing instructions every answer obeys, and the facts the model
 * is told to remember.
 *
 * They used to be four blocks on ONE scroll, which is how they were written and
 * why they became unreadable. The memory list is the only part that grows, and it
 * grew underneath everything else — so the settings a visitor came for kept
 * sliding further off the bottom the longer they used the chat. The account row
 * had the matching problem across: avatar, name, address, plan, quota, a profile
 * link and a sign-out button in ONE `flex` line with no wrap, which on a phone
 * left the name a few truncated letters. Tabs give each of the four the width and
 * the vertical room it actually needs, and the list can grow without pushing
 * anything.
 *
 * Account and appearance live HERE rather than in the chrome because this theme
 * has no chrome to put them in: the homepage renders no header and no footer, so
 * a control that is not in this dialog is a control the visitor cannot reach.
 * That is also why the dialog opens for signed-out visitors — with only the
 * appearance block, which is the part that does not need an account, and no tab
 * bar, because one tab is not a choice.
 *
 * The legal links sit OUTSIDE the tabs, in a footer that every tab keeps on
 * screen. Behind a tab they would be reachable only by someone already looking
 * for them, and that is the one thing they may not be.
 *
 * What is deliberately NOT here: model and temperature. Those are set once, in the
 * server's environment, and the route ignores whatever a client sends for them.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitch } from "@/components/theme-switch";
import { useLocale, useT } from "@/lib/i18n/client";
import { signOut } from "@/lib/actions/auth";
import { PLANS } from "@/lib/plans";
import {
  addChatMemory,
  deleteChatMemory,
  getChatPrefs,
  listChatMemories,
  saveChatPrefs,
  updateChatMemory,
  type ChatAccount,
  type ChatMemoryRow,
} from "@/lib/actions/chat";

/**
 * The dialog is MOUNTED on open and unmounted on close, rather than staying
 * mounted and hiding itself. Two reasons, one each:
 *
 *   * The panel's state (instructions, memory list) is loaded on mount, so opening
 *     it always shows what is stored now — including memories the chat itself saved
 *     from a "remember this…" while the dialog was closed.
 *   * A `loading` flag can start out true instead of being switched on inside an
 *     effect, which would be a cascading render.
 */
export function PrefsDialog({
  open,
  account,
  onClose,
}: {
  open: boolean;
  /** Null for a signed-out visitor: they get the appearance block and nothing else. */
  account: ChatAccount | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return <PrefsPanel account={account} onClose={onClose} />;
}

type Tab = "account" | "appearance" | "instructions" | "memory";

function PrefsPanel({ account, onClose }: { account: ChatAccount | null; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const signedIn = !!account;
  const [instructions, setInstructions] = useState("");
  const [memories, setMemories] = useState<ChatMemoryRow[]>([]);
  const [status, setStatus] = useState("");
  const [newMemory, setNewMemory] = useState("");
  // Opens on the account: the row that opens this dialog is the identity row, and
  // the question it is tapped to answer is "which plan am I on, how much is left".
  const [tab, setTab] = useState<Tab>("account");
  // Starts true only when there is something to wait for; a signed-out visitor
  // has nothing to load, and switching the flag off inside the effect would be a
  // cascading render.
  const [loading, setLoading] = useState(signedIn);
  const panel = useRef<HTMLDivElement>(null);

  // Two round trips, paid once, and only by the visitors who open this at all.
  // Both tabs' worth: switching to Memory should not be a spinner.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      // Only what the dialog itself owns. Identity and plan arrive as a prop —
      // the sidebar already loaded them to draw the row that opens this.
      const [prefs, stored] = await Promise.all([getChatPrefs(), listChatMemories()]);
      if (cancelled) return;
      setInstructions(prefs.responseInstructions);
      setMemories(stored);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The heading names what the dialog actually holds: a signed-out visitor sees
  // the appearance block alone, and calling that "Preferences & memory" would
  // promise two sections that are not there.
  const heading = signedIn ? t("chat.prefs") : t("chat.appearance");

  const flash = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(""), 2000);
  };

  const addMemory = async () => {
    if (!newMemory.trim()) return;
    setMemories(await addChatMemory(newMemory));
    setNewMemory("");
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "account", label: t("chat.account") },
    { key: "appearance", label: t("chat.appearance") },
    { key: "instructions", label: t("chat.instructions") },
    { key: "memory", label: t("chat.memory"), count: memories.length },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (!panel.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-[var(--background)] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="m-0 text-sm font-semibold">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
          >
            {t("common.close")}
          </button>
        </div>

        {signedIn && (
          <div
            role="tablist"
            aria-label={heading}
            className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3"
          >
            {tabs.map(({ key, label, count }) => {
              const active = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`prefs-tab-${key}`}
                  aria-selected={active}
                  aria-controls="prefs-panel"
                  onClick={() => setTab(key)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const step = e.key === "ArrowRight" ? 1 : tabs.length - 1;
                    const next = tabs[(tabs.findIndex((x) => x.key === key) + step) % tabs.length];
                    setTab(next.key);
                    // Selection and focus move together, or the arrow keys leave the
                    // ring behind on a tab that is no longer the open one.
                    document.getElementById(`prefs-tab-${next.key}`)?.focus();
                  }}
                  className={`-mb-px shrink-0 border-b-2 px-2.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "border-[var(--primary)] text-foreground"
                      : "border-transparent text-[var(--muted)] hover:text-foreground"
                  }`}
                >
                  {label}
                  {/* The count earns its place: it is the one tab whose contents the
                      visitor cannot guess, and "0" is worth seeing too. */}
                  {count !== undefined && !loading && (
                    <span className="ml-1.5 text-xs text-[var(--muted)]">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div
          id="prefs-panel"
          role={signedIn ? "tabpanel" : undefined}
          aria-labelledby={signedIn ? `prefs-tab-${tab}` : undefined}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        >
          {/* A floor under the shortest tab, so switching does not resize the dialog
              out from under the pointer that switched it. It sits on the CONTENT and
              not on the scroll box, which needs its `min-h-0` to be allowed to shrink
              — a floor there would push the dialog past a short viewport instead. */}
          <div className="sm:min-h-[18rem]">
            {!signedIn ? (
              <>
                <Appearance />
                <p className="mt-4 text-xs text-[var(--muted)]">{t("chat.signInToSave")}</p>
              </>
            ) : tab === "account" ? (
              <Account account={account} />
            ) : tab === "appearance" ? (
              <Appearance />
            ) : tab === "instructions" ? (
              <>
                <textarea
                  value={instructions}
                  disabled={loading}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={t("chat.instructionsPlaceholder")}
                  className="min-h-40 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                />
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await saveChatPrefs(instructions);
                      flash(result.error ?? t("common.saved"));
                    }}
                    className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                  >
                    {t("common.save")}
                  </button>
                  <span className="text-xs text-[var(--muted)]">{status}</span>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">{t("chat.instructionsNote")}</p>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      void addMemory();
                    }}
                    placeholder={t("chat.memoryPlaceholder")}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => void addMemory()}
                    className="shrink-0 rounded-xl border border-[var(--border)] px-3.5 text-xs transition-colors hover:border-[var(--primary)]"
                  >
                    {t("common.add")}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{t("chat.memoryNote")}</p>

                <div className="mt-4 space-y-0.5">
                  {memories.length === 0 && !loading && (
                    <p className="text-xs text-[var(--muted)]">{t("chat.memoryEmpty")}</p>
                  )}
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${
                        memory.pinned ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--accent-subtle)]/50"
                      }`}
                    >
                      <span
                        className="flex-1 text-sm [overflow-wrap:anywhere]"
                        // The date is context, not content: one line of it under every
                        // memory turned the list into a wall. Still there on hover.
                        title={new Date(memory.created_at).toLocaleString(locale === "en" ? "en-GB" : "id-ID")}
                      >
                        {memory.text}
                      </span>
                      <button
                        type="button"
                        title={memory.pinned ? t("chat.pinned") : t("chat.pin")}
                        aria-label={memory.pinned ? t("panel.unpin") : t("chat.pinLabel")}
                        onClick={async () => setMemories(await updateChatMemory(memory.id, { pinned: !memory.pinned }))}
                        // Quiet, not hidden. Hiding these behind `group-hover` would
                        // put them out of reach on every touch screen: Tailwind v4
                        // gates `hover:` behind `@media (hover: hover)`, so on a phone
                        // the class that reveals them never applies at all.
                        className={`rounded px-1 transition-colors ${
                          memory.pinned
                            ? "text-[var(--primary)]"
                            : "text-[var(--muted)]/50 hover:text-foreground"
                        }`}
                      >
                        {memory.pinned ? "★" : "☆"}
                      </button>
                      <button
                        type="button"
                        title={t("chat.forget")}
                        aria-label={t("chat.forgetNamed", { text: memory.text })}
                        onClick={async () => setMemories(await deleteChatMemory(memory.id))}
                        className="rounded px-1 text-[var(--muted)]/50 transition-colors hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* The pages a visitor is entitled to be able to find.
            This theme's homepage renders no footer — the composer owns the
            bottom edge — so without this row the legal pages exist on the
            domain and are reachable from nowhere on it. Shown signed out too:
            the obligation does not depend on having an account. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            {t("nav.privacy")}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            {t("nav.terms")}
          </Link>
          <Link href="/refund" className="transition-colors hover:text-foreground">
            {t("nav.refund")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Who is signed in, on what plan, and the two things they can do about it.
 *
 * Three rows down the tab rather than one row across: identity, then the plan and
 * what is left of it, then the actions. The single row this replaced fitted on a
 * desktop and nowhere else.
 */
function Account({ account }: { account: ChatAccount | null }) {
  const t = useT();
  const locale = useLocale();
  if (!account) return null;

  const limit = account.limits.chatMessagesPerDay;
  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar account={account} size="h-12 w-12" />
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-medium">{account.fullName || account.email || "…"}</p>
          {/* The name falls back to the address, so only print the address
              twice-over when there is a real name above it. */}
          {account.fullName && account.email && (
            <p className="m-0 truncate text-xs text-[var(--muted)]">{account.email}</p>
          )}
        </div>
      </div>

      {/* The plan sits one click from the composer that refused a message, because
          "why was that refused" is asked here and nowhere else. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
        <div>
          <span className="rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
            {PLANS[account.plan].label}
          </span>
          {account.planExpiresAt && (
            <span className="mt-1.5 block text-xs text-[var(--muted)]">
              {t("plan.activeUntil", {
                date: new Date(account.planExpiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "id-ID"),
              })}
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--muted)]">
          {limit === null
            ? t("chat.quotaUnlimited")
            : t("chat.quotaLeft", { used: Math.min(account.used, limit), limit })}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href="/panel/profile"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          {t("chat.manageProfile")}
        </Link>
        {/* A form, not an onClick: signOut is a Server Action that clears the
            cookie and redirects, and a form posts to it without this component
            having to know either of those things. */}
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:border-red-500 hover:text-red-500"
          >
            {t("chat.signOut")}
          </button>
        </form>
      </div>
    </>
  );
}

/** Language and theme — the two controls that need no account. */
function Appearance() {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
        <span className="text-sm">{t("nav.language")}</span>
        <LanguageSwitcher current={locale} label={t("nav.language")} />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
        <span className="text-sm">{t("chat.theme")}</span>
        <ThemeSwitch />
      </div>
    </div>
  );
}

/**
 * The signed-in visitor's face, or the first letter of their name.
 *
 * A plain <img>: the avatar is an uploaded Storage URL, and next/image would need
 * every storage host declared for a 36-pixel circle.
 */
export function Avatar({ account, size = "h-9 w-9" }: { account: ChatAccount | null; size?: string }) {
  const initial = (account?.fullName || account?.email || "?").trim().charAt(0).toUpperCase();
  if (account?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={account.avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`grid ${size} shrink-0 place-items-center rounded-full bg-[var(--accent-subtle)] text-sm font-semibold text-[var(--primary)]`}
    >
      {initial}
    </span>
  );
}
