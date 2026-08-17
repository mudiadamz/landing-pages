"use client";

/**
 * Everything about this chat that is not the conversation.
 *
 * Four blocks, in the order a visitor needs them: who they are signed in as, how
 * the page looks and speaks, the standing instructions every answer obeys, and
 * the facts the model is told to remember. The last two are here together
 * because they are the two that change how EVERY chat answers — both go into the
 * system message on each turn.
 *
 * Account and appearance live HERE rather than in the chrome because this theme
 * has no chrome to put them in: the homepage renders no header and no footer, so
 * a control that is not in this dialog is a control the visitor cannot reach.
 * That is also why the dialog opens for signed-out visitors — with only the
 * appearance block, which is the part that does not need an account.
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
import {
  addChatMemory,
  deleteChatMemory,
  getChatPrefs,
  getChatProfile,
  listChatMemories,
  saveChatPrefs,
  updateChatMemory,
  type ChatMemoryRow,
  type ChatProfile,
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
  signedIn,
  onClose,
}: {
  open: boolean;
  /** Signed-out visitors get the appearance block and nothing else. */
  signedIn: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <PrefsPanel signedIn={signedIn} onClose={onClose} />;
}

function PrefsPanel({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [instructions, setInstructions] = useState("");
  const [memories, setMemories] = useState<ChatMemoryRow[]>([]);
  const [status, setStatus] = useState("");
  const [newMemory, setNewMemory] = useState("");
  // Starts true only when there is something to wait for; a signed-out visitor
  // has nothing to load, and switching the flag off inside the effect would be a
  // cascading render.
  const [loading, setLoading] = useState(signedIn);
  const panel = useRef<HTMLDivElement>(null);

  // Three round trips, paid once, and only by the visitors who open this at all.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      const [prefs, stored, who] = await Promise.all([
        getChatPrefs(),
        listChatMemories(),
        getChatProfile(),
      ]);
      if (cancelled) return;
      setInstructions(prefs.responseInstructions);
      setMemories(stored);
      setProfile(who);
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {signedIn && (
            <>
              <h3 className={SECTION}>{t("chat.account")}</h3>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                <Avatar profile={profile} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium">
                    {profile?.fullName || profile?.email || "…"}
                  </p>
                  {/* The name falls back to the address, so only print the address
                      twice-over when there is a real name above it. */}
                  {profile?.fullName && profile.email && (
                    <p className="m-0 truncate text-xs text-[var(--muted)]">{profile.email}</p>
                  )}
                </div>
                <Link
                  href="/panel/profile"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:text-foreground"
                >
                  {t("chat.manageProfile")}
                </Link>
                {/* A form, not an onClick: signOut is a Server Action that clears
                    the cookie and redirects, and a form posts to it without this
                    component having to know either of those things. */}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-red-500 hover:text-red-500"
                  >
                    {t("chat.signOut")}
                  </button>
                </form>
              </div>
            </>
          )}

          <h3 className={signedIn ? SECTION_SPACED : SECTION}>{t("chat.appearance")}</h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">{t("nav.language")}</span>
              <LanguageSwitcher current={locale} label={t("nav.language")} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[var(--muted)]">{t("chat.theme")}</span>
              <ThemeSwitch />
            </div>
          </div>

          {!signedIn ? (
            <p className="mt-3 text-xs text-[var(--muted)]">{t("chat.signInToSave")}</p>
          ) : (
            <>
              <h3 className={SECTION_SPACED}>{t("chat.instructions")}</h3>
              <textarea
                value={instructions}
                disabled={loading}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t("chat.instructionsPlaceholder")}
                className="min-h-24 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
              <div className="mt-2 flex items-center gap-2">
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
              <p className="mt-1.5 text-xs text-[var(--muted)]">{t("chat.instructionsNote")}</p>

              <h3 className={SECTION_SPACED}>{t("chat.memory")}</h3>
              <div className="flex gap-2">
                <input
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (!newMemory.trim()) return;
                    setMemories(await addChatMemory(newMemory));
                    setNewMemory("");
                  }}
                  placeholder={t("chat.memoryPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newMemory.trim()) return;
                    setMemories(await addChatMemory(newMemory));
                    setNewMemory("");
                  }}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--primary)]"
                >
                  {t("common.add")}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{t("chat.memoryNote")}</p>

              <div className="mt-3 space-y-1">
                {memories.length === 0 && !loading && (
                  <p className="text-xs text-[var(--muted)]">{t("chat.memoryEmpty")}</p>
                )}
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                      memory.pinned ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--accent-subtle)]/50"
                    }`}
                  >
                    <div className="flex-1 text-sm [overflow-wrap:anywhere]">
                      {memory.text}
                      <span className="block text-[0.68rem] text-[var(--muted)]">
                        {new Date(memory.created_at).toLocaleString(locale === "en" ? "en-GB" : "id-ID")}
                      </span>
                    </div>
                    <button
                      type="button"
                      title={memory.pinned ? t("chat.pinned") : t("chat.pin")}
                      aria-label={memory.pinned ? t("panel.unpin") : t("chat.pinLabel")}
                      onClick={async () => setMemories(await updateChatMemory(memory.id, { pinned: !memory.pinned }))}
                      className={`rounded px-1 ${memory.pinned ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"}`}
                    >
                      {memory.pinned ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      title={t("chat.forget")}
                      aria-label={t("chat.forgetNamed", { text: memory.text })}
                      onClick={async () => setMemories(await deleteChatMemory(memory.id))}
                      className="rounded px-1 text-[var(--muted)] transition-colors hover:text-red-500"
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
    </div>
  );
}

const SECTION = "mt-0 mb-1.5 font-mono text-[0.72rem] tracking-[0.06em] text-[var(--muted)] uppercase";
const SECTION_SPACED = SECTION.replace("mt-0", "mt-6");

/**
 * The signed-in visitor's face, or the first letter of their name.
 *
 * A plain <img>: the avatar is an uploaded Storage URL, and next/image would need
 * every storage host declared for a 36-pixel circle.
 */
function Avatar({ profile }: { profile: ChatProfile | null }) {
  const initial = (profile?.fullName || profile?.email || "?").trim().charAt(0).toUpperCase();
  if (profile?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-subtle)] text-sm font-semibold text-[var(--primary)]"
    >
      {initial}
    </span>
  );
}
