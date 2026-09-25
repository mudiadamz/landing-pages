"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateLegalContent } from "@/lib/actions/site-settings";
import { RichEditor, type RichEditorHandle } from "../pages/rich-editor";
import {
  LEGAL_KEYS,
  LEGAL_ROUTES,
  type LegalContent,
  type LegalDocument,
  type LegalKey,
} from "@/lib/legal-config";
import { useT } from "@/lib/i18n/client";
import { LOCALE_OPTIONS } from "@/lib/i18n/locales";
import type { Locale, MessageKey } from "@/lib/i18n";

const TAB_LABEL: Record<LegalKey, MessageKey> = {
  privacy: "nav.privacyPolicy",
  terms: "nav.termsOfService",
  refund: "nav.refund",
};

/**
 * The three legal pages, in each language, one tab each.
 *
 * Tabs rather than three panel screens: they are edited together — a change to
 * the refund window belongs in the terms as well — and three sidebar entries for
 * three documents nobody opens weekly is three entries too many.
 *
 * Each editor is UNCONTROLLED (see RichEditor), so switching tabs cannot
 * re-mount one without losing what is in it. The bodies are therefore read out
 * of every editor on save, not on change, and every tab is mounted at once with
 * the inactive ones hidden. Adding the language axis multiplied that: three
 * documents × the languages this app has dictionaries for, all mounted. That is
 * the price of an uncontrolled editor, and it is cheaper than a switch that
 * eats a paragraph somebody just wrote.
 *
 * A language with nothing written yet starts from the SHIPPED DEFAULTS rather
 * than blank. A blank privacy policy that saves is worse than an untranslated
 * one: the untranslated one at least says something true.
 */
export function LegalForm({
  initial,
  siteId,
  siteLocale,
}: {
  initial: LegalContent;
  siteId: string;
  /** This storefront's own language — the one that cannot be left unwritten. */
  siteLocale: Locale;
}) {
  const t = useT();
  const [tab, setTab] = useState<LegalKey>("privacy");
  const [locale, setLocale] = useState<Locale>(siteLocale);
  const [draft, setDraft] = useState<LegalContent>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Languages to show: the ones the app can render at all. A language with no
  // stored copy still gets a tab — that tab is how it comes to have one.
  const languages = LOCALE_OPTIONS;

  /**
   * One handle per (language, document), so save can read every editor
   * whichever one is on screen. Built once and keyed by string because the set
   * of languages is fixed at module load; hooks are not called in the loop.
   */
  const editors = useRef<Record<string, RichEditorHandle | null>>({});
  const handleFor = (loc: Locale, key: LegalKey) => ({
    get current() {
      return editors.current[`${loc}:${key}`] ?? null;
    },
    set current(v: RichEditorHandle | null) {
      editors.current[`${loc}:${key}`] = v;
    },
  });

  const docFor = (loc: Locale): LegalDocument =>
    draft.locales[loc] ?? initial.locales[siteLocale] ?? initial.locales[loc]!;

  function setField(loc: Locale, key: LegalKey, field: "title" | "description", value: string) {
    setDraft((d) => {
      const doc = d.locales[loc] ?? docFor(loc);
      return {
        locales: { ...d.locales, [loc]: { ...doc, [key]: { ...doc[key], [field]: value } } },
      };
    });
    setMsg(null);
  }

  function save() {
    setMsg(null);
    const locales: LegalContent["locales"] = {};
    for (const { key: loc } of languages) {
      const doc = { ...docFor(loc) };
      let touched = !!draft.locales[loc];
      for (const key of LEGAL_KEYS) {
        const html = editors.current[`${loc}:${key}`]?.getHtml();
        if (html !== undefined) {
          if (html !== doc[key].body) touched = true;
          doc[key] = { ...doc[key], body: html };
        }
      }
      // A language nobody has touched is NOT written out. Otherwise opening the
      // screen once would silently publish a full set of default-copy policies
      // in every language the app supports, each looking like a deliberate
      // document somebody wrote.
      if (touched || loc === siteLocale) locales[loc] = doc;
    }

    const next: LegalContent = { locales };
    start(async () => {
      const res = await updateLegalContent(next, siteId);
      setMsg(
        res.ok
          ? { ok: true, text: t("sites.savedPublicLater") }
          : { ok: false, text: res.error ?? t("common.failed") },
      );
      if (res.ok) setDraft(next);
    });
  }

  const input =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

  return (
    <div className="space-y-4">
      {/* Language first, document second. The language is the coarser choice —
          you are editing the English policies or the Indonesian ones — and
          putting it above the document tabs keeps "which language am I in"
          answerable without reading the tab labels. */}
      <div className="flex flex-wrap items-center gap-2">
        {languages.map((opt) => {
          const written = !!draft.locales[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setLocale(opt.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                locale === opt.key
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-foreground"
              }`}
            >
              <span aria-hidden>{opt.flag}</span>
              {opt.native}
              {/* Says which languages actually have a document, so a policy that
                  exists only in one language is visible as a gap rather than
                  discovered by a reader. */}
              {!written && (
                <span className="text-xs opacity-70">· {t("legal.notWritten")}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {LEGAL_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-foreground"
            }`}
          >
            {t(TAB_LABEL[key])}
          </button>
        ))}
      </div>

      {languages.map((opt) =>
        LEGAL_KEYS.map((key) => {
          const doc = docFor(opt.key);
          const visible = locale === opt.key && tab === key;
          return (
            <div key={`${opt.key}:${key}`} className={visible ? "space-y-4" : "hidden"}>
              <div className="space-y-1.5">
                <label
                  htmlFor={`legal-${opt.key}-${key}-title`}
                  className="block text-sm font-medium text-foreground"
                >
                  {t("content.pageTitle")}
                </label>
                <input
                  id={`legal-${opt.key}-${key}-title`}
                  value={doc[key].title}
                  onChange={(e) => setField(opt.key, key, "title", e.target.value)}
                  className={input}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={`legal-${opt.key}-${key}-description`}
                  className="block text-sm font-medium text-foreground"
                >
                  {t("legal.metaDescription")}
                </label>
                <textarea
                  id={`legal-${opt.key}-${key}-description`}
                  rows={2}
                  value={doc[key].description}
                  onChange={(e) => setField(opt.key, key, "description", e.target.value)}
                  className={`${input} resize-y`}
                />
                <p className="text-xs text-[var(--muted)]">{t("legal.metaHint")}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {t("editor.pageBody")}
                </label>
                <RichEditor
                  initialHtml={doc[key].body}
                  editorRef={handleFor(opt.key, key)}
                  onDirty={() => setMsg(null)}
                />
              </div>

              <Link
                href={LEGAL_ROUTES[key]}
                target="_blank"
                className="inline-block text-sm text-[var(--primary)] hover:underline"
              >
                {t("legal.viewPage", { route: LEGAL_ROUTES[key] })}
              </Link>
            </div>
          );
        }),
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <Button size="md" onClick={save} disabled={pending} loading={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        {/* Saving writes all three, so say so — an admin who edited two tabs
            should not have to guess whether the hidden one went with it. */}
        <span className="text-xs text-[var(--muted)]">{t("legal.savesAllLangs")}</span>
        {msg && (
          <span
            className={`text-sm ${msg.ok ? "text-[var(--primary)]" : "text-red-600 dark:text-red-400"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
